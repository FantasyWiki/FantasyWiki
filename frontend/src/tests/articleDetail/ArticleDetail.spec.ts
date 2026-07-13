import { describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { Temporal } from "@js-temporal/polyfill";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, ref } from "vue";
import ArticleDetail from "@/components/ArticleDetail.vue";
import { ContractDTO } from "../../../../dto/contractDTO";
import { useLeagueStore } from "@/stores/league";
import { computeCurrentPrice, TIER_DAYS } from "../../../../model/pricing";
import type { TeamDTO } from "../../../../dto/teamDTO";
import type { LeagueDTO } from "../../../../dto/leagueDTO";
import type { ArticleDTO } from "../../../../dto/articleDTO";

const MOCK_AVG_VIEWS = 9000;

vi.mock("@/composables/useArticleSummary", () => ({
  useArticleSummary: () => ({
    summary: ref({
      title: "ChatGPT",
      extract: "ChatGPT summary",
      thumbnailUrl: undefined,
    }),
    isLoading: ref(false),
    error: ref(null),
  }),
}));

// Pin the live views so currentPrice (and the renewal premium derived from it)
// are deterministic, and so isLoadingViews is false (the renew gate is disabled
// while views load).
vi.mock("@/composables/useArticleViews", () => ({
  useArticleViews: () => ({
    views: ref({
      averageViews30d: 9000,
      weekViews: 100,
      previousWeekViews: 90,
    }),
    isLoading: ref(false),
  }),
}));

// The ownership context comes from the my-team query; mock it with mutable
// state so loading/error/ready are each reachable deterministically.
const myTeamMock = vi.hoisted(() => ({
  team: null as { id: string; credits: number } | null,
  isPending: false,
  error: null as Error | null,
}));

vi.mock("@/composables/useMyTeam", async () => {
  const { computed } = await import("vue");
  return {
    useMyTeam: () => ({
      myTeam: computed(() => myTeamMock.team),
      myTeamId: computed(() => myTeamMock.team?.id ?? null),
      isPending: computed(() => myTeamMock.isPending),
      error: computed(() => myTeamMock.error),
      refetch: async () => undefined,
    }),
  };
});

// IonModal teleports its slotted content into an overlay that is only mounted
// once the modal is "presented" — which never happens in jsdom — so the modal
// body renders empty. Replace just IonModal with a plain slot-passthrough; the
// other Ionic components render their slots as light DOM and are left intact.
vi.mock("@ionic/vue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ionic/vue")>();
  return {
    ...actual,
    IonModal: { name: "IonModal", template: "<div><slot /></div>" },
  };
});

const viewerTeam: TeamDTO = {
  id: "team-viewer",
  name: "Viewer FC",
  credits: 1200,
  player: { id: "viewer-player", name: "Viewer" },
};

const otherTeam: TeamDTO = {
  id: "team-other",
  name: "Other FC",
  credits: 1200,
  player: { id: "other-player", name: "Other" },
};

const league: LeagueDTO = {
  id: "league-1",
  title: "League",
  domain: "en",
  icon: "L",
  startDate: Temporal.Now.instant(),
  endDate: Temporal.Now.instant().add({ hours: 1 }),
  teams: [viewerTeam, otherTeam],
};

const article: ArticleDTO = { id: "article-1", title: "ChatGPT", domain: "en" };

function makeContract(team: TeamDTO, purchasePrice = 800): ContractDTO {
  const startDate = Temporal.Now.zonedDateTimeISO("UTC")
    .subtract({ days: 1 })
    .toInstant();
  return new ContractDTO(
    `contract-${team.id}`,
    team,
    article,
    startDate,
    Temporal.Duration.from({ days: 7 }),
    purchasePrice
  );
}

const TIER_DURATION_DAYS = 7;

/**
 * A viewer-owned MEDIUM (7-day) contract with exactly `hoursLeft` remaining, so
 * the final-24h renewal window can be exercised precisely regardless of run time.
 */
function makeContractExpiringInHours(
  team: TeamDTO,
  hoursLeft: number,
  opts: { renewalCount?: number; renewalElected?: boolean } = {}
): ContractDTO {
  const startDate = Temporal.Now.instant()
    .add({ hours: hoursLeft })
    .subtract({ hours: 24 * TIER_DURATION_DAYS });
  return new ContractDTO(
    `contract-${team.id}`,
    team,
    article,
    startDate,
    Temporal.Duration.from({ days: TIER_DURATION_DAYS }),
    800,
    opts.renewalCount ?? 0,
    opts.renewalElected ?? false
  );
}

/** Matches the renew label ("Renew · {price} cr") without also matching "Cancel Renewal". */
function findRenewButton(wrapper: ReturnType<typeof mountWithStores>) {
  return wrapper
    .findAll("ion-button")
    .find((b) => b.text().includes("Renew ·"));
}

/** ion-button reflects `disabled` as a DOM property, not an attribute. */
function isRenewDisabled(
  wrapper: ReturnType<typeof mountWithStores>
): boolean | undefined {
  const btn = findRenewButton(wrapper);
  return (btn?.element as unknown as { disabled?: boolean } | undefined)
    ?.disabled;
}

interface MountOptions {
  currentTeam?: TeamDTO | null;
  isTeamLoading?: boolean;
  teamError?: string | null;
  /** Host-supplied actions. Omitted by default, as most hosts cannot perform them. */
  onSwap?: (contract: ContractDTO) => void;
  onRequestTrade?: (contractId: string) => void;
}

function mountWithStores(
  contract: ContractDTO | null,
  options: MountOptions = {}
) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const leagueStore = useLeagueStore();
  leagueStore.currentLeague = league;
  myTeamMock.team = options.currentTeam ?? viewerTeam;
  myTeamMock.isPending = options.isTeamLoading ?? false;
  myTeamMock.error = options.teamError ? new Error(options.teamError) : null;

  return mount(ArticleDetail, {
    props: {
      article,
      contract,
      isOpen: true,
      onSwap: options.onSwap,
      onRequestTrade: options.onRequestTrade,
    },
    global: {
      plugins: [pinia],
    },
  });
}

describe("ArticleDetail.vue", () => {
  // This contract has 6 days left, so renewal is not yet available — only sell is.
  it("shows the sell action for a viewer-owned contract", () => {
    const wrapper = mountWithStores(makeContract(viewerTeam), {
      currentTeam: viewerTeam,
    });

    expect(wrapper.text()).toContain("Sell Contract");
    expect(findRenewButton(wrapper)).toBeUndefined();
    expect(wrapper.text()).not.toContain("Request Trade");
    expect(wrapper.text()).not.toContain("Buy");
    expect(wrapper.text()).toContain("Availability");
    const wikipediaLink = wrapper.find(".summary-link");
    expect(wikipediaLink.exists()).toBe(true);
    expect(wikipediaLink.attributes("href")).toContain(
      "https://en.wikipedia.org/wiki/ChatGPT"
    );
  });

  // Swap and request-trade are host-specific: swap puts the *team page* into
  // swap mode and nothing else can honour it. Rendering them unconditionally is
  // what produced buttons that did nothing on three of the four hosts, so they
  // now appear only where the host passed a handler.
  it("hides swap unless the host can perform it", () => {
    const withoutHandler = mountWithStores(makeContract(viewerTeam), {
      currentTeam: viewerTeam,
    });
    expect(withoutHandler.text()).not.toContain("Swap Article");

    const onSwap = vi.fn();
    const withHandler = mountWithStores(makeContract(viewerTeam), {
      currentTeam: viewerTeam,
      onSwap,
    });
    expect(withHandler.text()).toContain("Swap Article");
  });

  // TeamPage binds the handler as `@swap="enterSwapMode"`. Vue routes a listener
  // into a same-named declared prop, so that keeps working — but the whole fix
  // rests on it, so bind it through a real template rather than passing the prop
  // directly as the tests above do.
  it("accepts a swap handler bound with @swap listener syntax", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useLeagueStore().currentLeague = league;
    myTeamMock.team = viewerTeam;
    myTeamMock.isPending = false;
    myTeamMock.error = null;

    const onSwap = vi.fn();
    const contract = makeContract(viewerTeam);
    const Host = defineComponent({
      components: { ArticleDetail },
      setup: () => ({ article, contract, onSwap }),
      template: `<ArticleDetail :article="article" :contract="contract"
                   :is-open="true" @swap="onSwap" />`,
    });

    const wrapper = mount(Host, { global: { plugins: [pinia] } });
    const swapBtn = wrapper
      .findAll("ion-button")
      .find((b) => b.text().includes("Swap Article"));

    expect(
      swapBtn,
      "swap should render for a host listening on @swap"
    ).toBeDefined();
    await swapBtn!.trigger("click");
    expect(onSwap).toHaveBeenCalledWith(contract);
  });

  it("hides request-trade unless the host can perform it", () => {
    const withHandler = mountWithStores(makeContract(otherTeam), {
      currentTeam: viewerTeam,
      onRequestTrade: vi.fn(),
    });
    expect(withHandler.text()).toContain("Request Trade");
  });

  // The renew action is shown only when it can actually be taken, rather than
  // rendered disabled for most of the contract's life.
  it("hides the renew action outside the final-24h window", async () => {
    const wrapper = mountWithStores(
      makeContractExpiringInHours(viewerTeam, 48),
      { currentTeam: viewerTeam }
    );
    await flushPromises();

    expect(findRenewButton(wrapper)).toBeUndefined();
    expect(wrapper.text()).not.toContain("Cancel Renewal");
  });

  it("enables the renew action inside the final-24h window and shows the premium-adjusted price", async () => {
    const renewalCount = 2;
    const wrapper = mountWithStores(
      makeContractExpiringInHours(viewerTeam, 12, { renewalCount }),
      { currentTeam: viewerTeam }
    );
    await flushPromises();

    const renewBtn = findRenewButton(wrapper);
    expect(renewBtn).toBeDefined();
    expect(isRenewDisabled(wrapper)).toBe(false);

    // renewalPrice = currentPrice + round(currentPrice × 0.10 × renewalCount).
    const currentPrice = computeCurrentPrice(
      MOCK_AVG_VIEWS,
      "en",
      TIER_DAYS.MEDIUM
    );
    const renewalPrice =
      currentPrice + Math.round(currentPrice * 0.1 * renewalCount);
    expect(renewBtn!.text()).toContain(String(renewalPrice));
  });

  // Election is only an intent until the settlement sweep acts on it, so once
  // elected the renew button is replaced by an undo, and the elected state moves
  // to the contract details block so it stays visible.
  it("replaces renew with an undo action once renewal is elected", async () => {
    const wrapper = mountWithStores(
      makeContractExpiringInHours(viewerTeam, 12, { renewalElected: true }),
      { currentTeam: viewerTeam }
    );
    await flushPromises();

    expect(wrapper.text()).toContain("Renewal Elected");
    expect(findRenewButton(wrapper)).toBeUndefined();
    expect(wrapper.text()).toContain("Cancel Renewal");
  });

  it("shows a tier picker and buy action for a free-agent article", () => {
    const wrapper = mountWithStores(null, { currentTeam: viewerTeam });

    expect(wrapper.text()).toContain("Buy Contract");
    expect(wrapper.text()).toContain("Buy");
    expect(wrapper.text()).not.toContain("Renew Contract");
    expect(wrapper.text()).not.toContain("Swap Article");
    expect(wrapper.text()).not.toContain("Sell Contract");
    expect(wrapper.text()).not.toContain("Request Trade");
    // Current price is shown for every scenario, including free agents.
    expect(wrapper.text()).toContain("Current Price");
  });

  it("shows the lock box for another team's contract", () => {
    const wrapper = mountWithStores(makeContract(otherTeam), {
      currentTeam: viewerTeam,
      onRequestTrade: vi.fn(),
    });

    expect(wrapper.text()).toContain("Locked");
    expect(wrapper.text()).toContain("Request Trade");
    expect(wrapper.text()).toContain("Other FC");
    expect(wrapper.text()).not.toContain("Renew Contract");
    expect(wrapper.text()).not.toContain("Sell Contract");
    // Current price is shown even when the viewer doesn't own the contract;
    // only the owner's purchase price stays private.
    expect(wrapper.text()).toContain("Current Price");
    expect(wrapper.text()).not.toContain("Purchase Price");
  });

  it("delays actions while ownership context is loading", () => {
    const wrapper = mountWithStores(makeContract(otherTeam), {
      currentTeam: null,
      isTeamLoading: true,
    });

    expect(wrapper.text()).toContain("Resolving ownership...");
    expect(wrapper.text()).toContain(
      "Actions will appear when your team context is ready."
    );
    expect(wrapper.text()).not.toContain("Renew Contract");
    expect(wrapper.text()).not.toContain("Request Trade");
  });

  it("shows ownership-unavailable state when team context fails", () => {
    const wrapper = mountWithStores(makeContract(otherTeam), {
      currentTeam: null,
      teamError: "boom",
    });

    expect(wrapper.text()).toContain("Unable to determine ownership");
    expect(wrapper.text()).toContain("Retry ownership check");
    expect(wrapper.text()).not.toContain("Renew Contract");
    expect(wrapper.text()).not.toContain("Request Trade");
  });
});
