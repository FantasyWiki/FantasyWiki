import { describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { Temporal } from "@js-temporal/polyfill";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
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

function findRenewButton(wrapper: ReturnType<typeof mountWithStores>) {
  return wrapper.findAll("ion-button").find((b) => b.text().includes("Renew"));
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
}

function mountWithStores(
  contract: ContractDTO | null,
  options: MountOptions = {}
) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const leagueStore = useLeagueStore();
  leagueStore.currentLeague = league;
  leagueStore.currentTeam = options.currentTeam ?? viewerTeam;
  leagueStore.isTeamLoading = options.isTeamLoading ?? false;
  leagueStore.teamError = options.teamError ?? null;

  return mount(ArticleDetail, {
    props: {
      article,
      contract,
      isOpen: true,
    },
    global: {
      plugins: [pinia],
    },
  });
}

describe("ArticleDetail.vue", () => {
  it("shows renew, swap and sell actions for a viewer-owned contract", () => {
    const wrapper = mountWithStores(makeContract(viewerTeam), {
      currentTeam: viewerTeam,
    });

    expect(wrapper.text()).toContain("Renew");
    expect(wrapper.text()).toContain("Swap Article");
    expect(wrapper.text()).toContain("Sell Contract");
    expect(wrapper.text()).not.toContain("Request Trade");
    expect(wrapper.text()).not.toContain("Buy");
    expect(wrapper.text()).toContain("Availability");
    const wikipediaLink = wrapper.find(".summary-link");
    expect(wikipediaLink.exists()).toBe(true);
    expect(wikipediaLink.attributes("href")).toContain(
      "https://en.wikipedia.org/wiki/ChatGPT"
    );
  });

  it("disables the renew action outside the final-24h window", async () => {
    const wrapper = mountWithStores(
      makeContractExpiringInHours(viewerTeam, 48),
      { currentTeam: viewerTeam }
    );
    await flushPromises();

    const renewBtn = findRenewButton(wrapper);
    expect(renewBtn).toBeDefined();
    expect(isRenewDisabled(wrapper)).toBe(true);
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

  it("shows an elected state and disables the button once renewal is elected", async () => {
    const wrapper = mountWithStores(
      makeContractExpiringInHours(viewerTeam, 12, { renewalElected: true }),
      { currentTeam: viewerTeam }
    );
    await flushPromises();

    expect(wrapper.text()).toContain("Renewal Elected");
    expect(isRenewDisabled(wrapper)).toBe(true);
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

  it("shows the lock box and request-trade action for another team's contract", () => {
    const wrapper = mountWithStores(makeContract(otherTeam), {
      currentTeam: viewerTeam,
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
