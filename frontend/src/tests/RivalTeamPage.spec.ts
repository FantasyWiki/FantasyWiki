import { describe, it, expect, afterEach, beforeAll, beforeEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import router from "@/router/index";
import RivalTeamPage from "@/views/RivalTeamPage.vue";
import { useAppStore } from "@/stores/app";
import { useLeagueStore } from "@/stores/league";
import { leagues } from "@/mocks/data/leagues";
import i18n from "@/i18n";
import type { LeaderboardEntryDTO } from "../../../dto/leaderboardDTO";

// The viewer in the Global League fixture — see src/mocks/data/leagues.ts.
const MY_TEAM_ID = "team-2";
const RIVAL_TEAM_ID = "team-4";

function entry(
  id: string,
  name: string,
  rank: number,
  points: number,
  rankDelta: number | null = 0
): LeaderboardEntryDTO {
  return {
    team: {
      id,
      name,
      credits: 500,
      player: { id: `player-${id}`, name: `Player ${id}` },
    },
    cumulativePoints: points,
    rank,
    rankDelta,
  };
}

/** Board where the rival leads the viewer by 40 points. */
function board(): LeaderboardEntryDTO[] {
  return [
    entry(RIVAL_TEAM_ID, "Wiki Masters", 1, 140, 2),
    entry(MY_TEAM_ID, "Global Warriors", 2, 100),
  ];
}

function stubBoard(entries: LeaderboardEntryDTO[]) {
  server.use(
    http.get("*/api/leagues/:leagueId/leaderboard", () =>
      HttpResponse.json(entries)
    )
  );
}

function makePlugins() {
  const pinia = createPinia();
  setActivePinia(pinia);

  // The route is auth-gated, so an unauthenticated store bounces the push to
  // /home and the page mounts with no params at all.
  useAppStore().setUserFromData({
    sub: "player-1",
    email: "player@example.com",
    name: "Player One",
    picture: "",
    features: { articleGenie: false },
  });

  const leagueStore = useLeagueStore();
  leagueStore.availableLeagues = leagues;
  leagueStore.currentLeague = leagues[0];

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugins: any[] = [
    pinia,
    [VueQueryPlugin, { queryClient }],
    router,
    i18n,
  ];
  return plugins;
}

/**
 * Torn down between tests for the same reason LeaguePage's spec does it: the
 * router is a module singleton while each test gets a fresh pinia, so a page
 * left mounted keeps watching a route it no longer owns.
 */
let mounted: VueWrapper | undefined;

async function mountAt(teamId: string) {
  const path = `/leagues/global/teams/${teamId}`;
  const plugins = makePlugins();
  await router.push(path);
  await router.isReady();
  mounted = mount(RivalTeamPage, { global: { plugins } });
  await flushPromises();
  await flushPromises();
  return mounted;
}

describe("RivalTeamPage.vue", () => {
  beforeAll(() => {
    // The pitch anchors its chemistry lines off a ResizeObserver, which jsdom
    // does not ship — same stub the TeamFormation spec installs.
    if (!window.ResizeObserver) {
      window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
  });

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
  });

  it("names the team and its rank from the standings row", async () => {
    stubBoard(board());
    const wrapper = await mountAt(RIVAL_TEAM_ID);

    expect(wrapper.text()).toContain("Wiki Masters");
    expect(wrapper.text()).toContain("#1");
  });

  it("states the gap from the viewer's side when they are behind", async () => {
    stubBoard(board());
    const wrapper = await mountAt(RIVAL_TEAM_ID);

    expect(wrapper.text()).toContain("Ahead of you by 40 points");
  });

  it("flips the gap wording when the viewer leads", async () => {
    stubBoard([
      entry(RIVAL_TEAM_ID, "Wiki Masters", 2, 60),
      entry(MY_TEAM_ID, "Global Warriors", 1, 100),
    ]);
    const wrapper = await mountAt(RIVAL_TEAM_ID);

    expect(wrapper.text()).toContain("Behind you by 40 points");
  });

  it("renders the line-up read-only — no save or swap affordance", async () => {
    stubBoard(board());
    const wrapper = await mountAt(RIVAL_TEAM_ID);

    // The pitch is present…
    expect(wrapper.findComponent({ name: "TeamFormation" }).exists()).toBe(
      true
    );
    // …and hosted in its non-editable mode, which is what withholds drag-to-move.
    expect(
      wrapper.findComponent({ name: "TeamFormation" }).props("editable")
    ).toBe(false);
  });

  /**
   * A team id that is not in this league is a wrong link, not a failed request:
   * the page must not offer a retry that cannot succeed.
   */
  it("treats a team outside the league as not found, not as an error", async () => {
    stubBoard(board());
    const wrapper = await mountAt("team-not-in-this-league");

    expect(wrapper.text()).toContain("Team not found");
    expect(wrapper.text()).not.toContain("Retry");
  });
});
