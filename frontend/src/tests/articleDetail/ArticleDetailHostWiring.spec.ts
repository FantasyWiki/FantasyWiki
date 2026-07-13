import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { Temporal } from "@js-temporal/polyfill";
import { createPinia, setActivePinia } from "pinia";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { ref } from "vue";
import NeededAttention from "@/components/teamDashboard/NeededAttention.vue";
import { ContractDTO } from "../../../../dto/contractDTO";
import { useLeagueStore } from "@/stores/league";
import i18n from "@/i18n";
import type { TeamDTO } from "../../../../dto/teamDTO";
import type { LeagueDTO } from "../../../../dto/leagueDTO";
import type { ArticleDTO } from "../../../../dto/articleDTO";

vi.mock("@/composables/useArticleSummary", () => ({
  useArticleSummary: () => ({
    summary: ref(null),
    isLoading: ref(false),
    error: ref(null),
  }),
}));

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

const myTeamMock = vi.hoisted(() => ({
  team: null as { id: string; credits: number } | null,
}));

vi.mock("@/composables/useMyTeam", async () => {
  const { computed } = await import("vue");
  return {
    useMyTeam: () => ({
      myTeam: computed(() => myTeamMock.team),
      myTeamId: computed(() => myTeamMock.team?.id ?? null),
      isPending: computed(() => false),
      error: computed(() => null),
      refetch: async () => undefined,
    }),
  };
});

// The action under test is "did the click reach the API?", so stub the API
// surface and assert on the calls rather than on MSW round-trips.
const apiMock = vi.hoisted(() => ({
  sellMyContract: vi.fn(),
  renewMyContract: vi.fn(),
  cancelRenewMyContract: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  leaguesApi: {
    sellMyContract: apiMock.sellMyContract,
    renewMyContract: apiMock.renewMyContract,
    cancelRenewMyContract: apiMock.cancelRenewMyContract,
  },
}));

// IonModal never "presents" in jsdom, so its slotted content stays unmounted
// unless replaced with a plain passthrough (same rationale as ArticleDetail.spec).
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

const league: LeagueDTO = {
  id: "league-1",
  title: "League",
  domain: "en",
  icon: "L",
  startDate: Temporal.Now.instant(),
  endDate: Temporal.Now.instant().add({ hours: 1 }),
  teams: [viewerTeam],
};

const article: ArticleDTO = { id: "article-1", title: "ChatGPT", domain: "en" };

/** A viewer-owned MEDIUM contract 12h from expiry — inside the renewal window. */
function urgentContract(renewalElected = false): ContractDTO {
  const startDate = Temporal.Now.instant()
    .add({ hours: 12 })
    .subtract({ hours: 24 * 7 });
  return new ContractDTO(
    "contract-1",
    viewerTeam,
    article,
    startDate,
    Temporal.Duration.from({ days: 7 }),
    800,
    0,
    renewalElected
  );
}

async function mountHostAndOpenModal(renewalElected = false) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const leagueStore = useLeagueStore();
  leagueStore.currentLeague = league;
  myTeamMock.team = viewerTeam;

  const wrapper = mount(NeededAttention, {
    props: { urgentContract: [urgentContract(renewalElected)] },
    global: {
      plugins: [
        pinia,
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false } },
            }),
          },
        ],
        i18n,
      ],
    },
  });

  await wrapper.find(".attention-item").trigger("click");
  await flushPromises();
  return wrapper;
}

function clickAction(
  wrapper: Awaited<ReturnType<typeof mountHostAndOpenModal>>,
  label: string
) {
  const btn = wrapper
    .findAll("ion-button")
    .find((b) => b.text().includes(label));
  expect(btn, `expected an action button labelled "${label}"`).toBeDefined();
  return btn!.trigger("click");
}

/**
 * ArticleDetail is mounted from four hosts. It used to emit buy/sell/renew and
 * leave each host to wire them up; an unbound emit is silently dropped by Vue,
 * so sell and renew rendered everywhere but only worked in the market. The modal
 * now owns those mutations, and this suite pins that down at a *host* seam —
 * ArticleDetail.spec mounts the modal directly, where an unwired host is by
 * definition invisible.
 */
describe("ArticleDetail actions reach the API from every host", () => {
  beforeEach(() => {
    apiMock.sellMyContract.mockReset().mockResolvedValue(undefined);
    apiMock.renewMyContract.mockReset().mockResolvedValue(undefined);
    apiMock.cancelRenewMyContract.mockReset().mockResolvedValue(undefined);
  });

  it("withdraws an elected renewal from the dashboard's needed-attention list", async () => {
    const wrapper = await mountHostAndOpenModal(true);
    await clickAction(wrapper, "Cancel Renewal");
    await flushPromises();

    expect(apiMock.cancelRenewMyContract).toHaveBeenCalledWith(
      "league-1",
      "contract-1"
    );
  });

  it("renews from the dashboard's needed-attention list", async () => {
    const wrapper = await mountHostAndOpenModal();
    await clickAction(wrapper, "Renew");
    await flushPromises();

    expect(apiMock.renewMyContract).toHaveBeenCalledWith(
      "league-1",
      "contract-1"
    );
  });

  it("sells from the dashboard's needed-attention list", async () => {
    const wrapper = await mountHostAndOpenModal();
    await clickAction(wrapper, "Sell Contract");
    await flushPromises();

    expect(apiMock.sellMyContract).toHaveBeenCalledWith(
      "league-1",
      "contract-1"
    );
  });

  it("does not offer swap on a host that cannot perform it", async () => {
    const wrapper = await mountHostAndOpenModal();

    expect(wrapper.text()).toContain("Sell Contract");
    expect(wrapper.text()).not.toContain("Swap Article");
  });

  it("submits a mutation only once when the action is double-tapped", async () => {
    let release!: () => void;
    apiMock.sellMyContract.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      })
    );

    const wrapper = await mountHostAndOpenModal();
    await clickAction(wrapper, "Sell Contract");
    await clickAction(wrapper, "Sell Contract");

    release();
    await flushPromises();

    expect(apiMock.sellMyContract).toHaveBeenCalledTimes(1);
  });
});
