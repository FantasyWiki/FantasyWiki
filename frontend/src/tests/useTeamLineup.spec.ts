import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, type ShallowUnwrapRef } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { Temporal } from "@js-temporal/polyfill";
import i18n from "@/i18n";
import { useTeamLineup } from "@/composables/useTeamLineup";
import { useLeagueStore } from "@/stores/league";
import { ChemistryLevel } from "../../../model/enums";
import { createDraftFormation } from "../../../dto/formationDTO";
import { ContractDTO } from "../../../dto/contractDTO";
import type { TeamDTO } from "../../../dto/teamDTO";
import type { LeagueDTO } from "../../../dto/leagueDTO";
import type { TeamLineUp } from "@/types/team";

const fetchTeam = vi.hoisted(() => vi.fn());
const saveTeamApi = vi.hoisted(() => vi.fn());

vi.mock("@/services/teamService", () => ({ fetchTeam, saveTeamApi }));

// Alpha and Beta link to each other, so the LW–ST chemistry link resolves to a
// non-EMPTY level — the client-side recomputation the backend never persists.
vi.mock("@/services/wikimediaClient", () => ({
  createWikimediaClient: () => ({
    article: {
      getLinkedArticles: (_domain: string, title: string) =>
        Promise.resolve({
          title,
          linkedArticles: title === "Alpha" ? ["Beta"] : ["Alpha"],
        }),
    },
  }),
}));

const team: TeamDTO = {
  id: "team-1",
  name: "My FC",
  credits: 1000,
  player: { id: "player-1", name: "Me" },
};

const league: LeagueDTO = {
  id: "league-1",
  title: "League",
  domain: "en",
  icon: "L",
  startDate: Temporal.Now.instant(),
  endDate: Temporal.Now.instant().add({ hours: 1 }),
  teams: [team],
};

function contract(title: string): ContractDTO {
  return new ContractDTO(
    `contract-${title}`,
    team,
    { id: `article-${title}`, title, domain: "en" },
    Temporal.Now.instant(),
    Temporal.Duration.from({ days: 7 }),
    100
  );
}

/** A server lineup: real placements, but EMPTY chemistry — exactly what the backend returns. */
function serverLineup(placements: Record<string, ContractDTO>): TeamLineUp {
  return {
    formation: {
      ...createDraftFormation("4-3-3", placements),
      date: Temporal.Now.instant(),
    },
    bench: [],
  } as unknown as TeamLineUp;
}

const TestComponent = defineComponent({
  setup: () => useTeamLineup(),
  render: () => null,
});

/** `vm` exposes the composable's refs already unwrapped, so drop the `.value`. */
type LineupVm = ShallowUnwrapRef<ReturnType<typeof useTeamLineup>>;

function mountLineup(pinia: Pinia, queryClient: QueryClient) {
  return mount(TestComponent, {
    global: { plugins: [pinia, [VueQueryPlugin, { queryClient }], i18n] },
  }).vm as unknown as LineupVm;
}

describe("useTeamLineup", () => {
  let pinia: Pinia;
  let queryClient: QueryClient;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    useLeagueStore().currentLeague = league;

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    fetchTeam
      .mockReset()
      .mockResolvedValue(
        serverLineup({ LW: contract("Alpha"), ST: contract("Beta") })
      );
    saveTeamApi.mockReset().mockResolvedValue(undefined);
  });

  it("stays clean once client-computed chemistry is applied to a freshly loaded lineup", async () => {
    const lineup = mountLineup(pinia, queryClient);
    await flushPromises();

    // Guard against a vacuous pass: chemistry must actually have been recomputed.
    const lwStLink = lineup.draftFormation.chemistry.find(
      (link) => link.from === "LW" && link.to === "ST"
    );
    expect(lwStLink?.level).not.toBe(ChemistryLevel.EMPTY);

    // Chemistry is derived, not edited — it must not count as an unsaved change,
    // or the draft would refuse every later server sync.
    expect(lineup.isDirty).toBe(false);
  });

  it("re-syncs a second consumer's draft after a save invalidates the lineup query", async () => {
    // The dashboard and the team page each hold their own useTeamLineup draft
    // over one shared lineup query.
    const dashboard = mountLineup(pinia, queryClient);
    const teamPage = mountLineup(pinia, queryClient);
    await flushPromises();

    expect(dashboard.draftFormation.formation.ST?.article.title).toBe("Beta");

    fetchTeam.mockResolvedValue(
      serverLineup({ LW: contract("Alpha"), ST: contract("Gamma") })
    );
    teamPage.saveTeam();
    await flushPromises();

    expect(dashboard.draftFormation.formation.ST?.article.title).toBe("Gamma");
  });

  it("keeps unsaved edits when the lineup query refetches", async () => {
    const lineup = mountLineup(pinia, queryClient);
    await flushPromises();

    lineup.removeFromPosition("ST");
    expect(lineup.isDirty).toBe(true);

    await queryClient.invalidateQueries();
    await flushPromises();

    expect(lineup.draftFormation.formation.ST).toBeUndefined();
  });
});
