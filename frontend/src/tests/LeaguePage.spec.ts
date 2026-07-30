import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { Temporal } from "@js-temporal/polyfill";
import router from "@/router/index";
import LeaguePage from "@/views/LeaguePage.vue";
import { useAppStore } from "@/stores/app";
import { useLeagueStore } from "@/stores/league";
import { leagues } from "@/mocks/data/leagues";
import i18n from "@/i18n";
import type { LeaderboardEntryDTO } from "../../../dto/leaderboardDTO";

// The Global League fixture runs 12 teams deep, with the current player's
// team-2 ("Global Warriors") 5th — see src/mocks/data/{leagues,performances}.ts.
const GLOBAL_TEAM_COUNT = 12;
const MY_TEAM_NAME = "Global Warriors";

function makePlugins(seedStore = true) {
  const pinia = createPinia();
  setActivePinia(pinia);

  // The guard on /leagues/:leagueId resolves the app store outside any
  // component, so an unauthenticated store bounces the push to /home and the
  // page mounts with no route params at all.
  useAppStore().setUserFromData({
    sub: "player-1",
    email: "player@example.com",
    name: "Player One",
    picture: "",
  });

  // Seeded the way NavBar's initialize() leaves it: the page must still read the
  // league from its own route, not from this selection. Unseeded reproduces a
  // cold deep link, where the store settles a tick after the page mounts.
  if (seedStore) {
    const leagueStore = useLeagueStore();
    leagueStore.availableLeagues = leagues;
    leagueStore.currentLeague = leagues[0];
  }

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
 * The page mounted by the test at hand. Held here so it can be torn down: the
 * router is a module singleton shared by every test, while each test gets a
 * fresh pinia, so a page left mounted keeps watching a route it no longer owns
 * with a store nobody else can see. Two survivors pinned to different leagues
 * then `replace` each other's league back forever — a microtask loop that
 * starves the event loop, so not even vitest's own timeout can fire.
 */
let mounted: VueWrapper | undefined;

async function mountAt(path: string, seedStore = true) {
  const plugins = makePlugins(seedStore);
  await router.push(path);
  await router.isReady();
  expect(router.currentRoute.value.path).toBe(path);
  mounted = mount(LeaguePage, { global: { plugins } });
  await flushPromises();
  await flushPromises();
  return mounted;
}

/**
 * Ionic emits its events off the host element, and the handlers read
 * `event.target`. Test-utils' `trigger` refuses to fake a target, so the value
 * goes on the real element before a plain CustomEvent is dispatched from it.
 */
async function search(wrapper: VueWrapper, value: string) {
  const el = wrapper.find("ion-searchbar").element as HTMLIonSearchbarElement;
  el.value = value;
  el.dispatchEvent(new CustomEvent("ionInput"));
  await flushPromises();
}

async function scrollToEnd(wrapper: VueWrapper) {
  const el = wrapper.find("ion-infinite-scroll")
    .element as HTMLIonInfiniteScrollElement;
  // `complete()` is defined by the Ionic custom element, which never upgrades
  // in jsdom — the handler calls it, so it has to exist.
  el.complete = vi.fn().mockResolvedValue(undefined);
  el.dispatchEvent(new CustomEvent("ionInfinite"));
  await flushPromises();
}

/** A synthetic board deep enough to need more than one reveal batch. */
function deepBoard(size: number): LeaderboardEntryDTO[] {
  return Array.from({ length: size }, (_, i) => ({
    team: {
      id: `team-deep-${i + 1}`,
      name: `Deep Team ${i + 1}`,
      credits: 500,
      player: { id: `player-deep-${i + 1}`, name: `DeepPlayer${i + 1}` },
    },
    cumulativePoints: (size - i) * 10,
    rank: i + 1,
    rankDelta: 0,
  }));
}

describe("LeaguePage.vue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
  });

  it("renders the league's identity from the id in the route", async () => {
    const wrapper = await mountAt("/leagues/italy");

    expect(wrapper.find(".page-title").text()).toBe("Italia League");
    expect(wrapper.find(".league-icon").text()).toBe("🍕");

    // The facts are the reason to open this page, so they are on the factsheet
    // as figures — not folded into a caption.
    const facts = wrapper.find(".facts").text();
    expect(facts).toContain("it.wikipedia.org");
    // Dates on the UTC calendar, so they agree with the season count below.
    expect(facts).toContain("Jan 1, 2024");
    expect(facts).toContain("Feb 28, 2024");
  });

  it("reports the season's run instead of a bare status word", async () => {
    // A league still in flight: what is left to play is the number that matters.
    // 10 UTC days in, 20 to go, so the season is 31 days counted inclusively.
    const today = Temporal.Now.plainDateISO("UTC");
    server.use(
      http.get("*/api/leagues/:leagueId", () =>
        HttpResponse.json({
          ...leagues[0],
          startDate: `${today.subtract({ days: 10 })}T00:00:00Z`,
          endDate: `${today.add({ days: 20 })}T23:59:59Z`,
        })
      )
    );

    const wrapper = await mountAt("/leagues/global");

    const run = wrapper.find(".run").text();
    expect(run).toContain("20 days left");
    expect(run).toContain("Day 11 of 31");
    // The top three lead the page all season, staged as provisional.
    expect(wrapper.find(".podium-wrap--live").exists()).toBe(true);
    expect(wrapper.find(".podium-wrap").text()).toContain("Top three");
  });

  it("withholds the podium until the first scoring day has closed", async () => {
    server.use(
      http.get("*/api/leagues/:leagueId/leaderboard", () =>
        HttpResponse.json(
          deepBoard(6).map((e) => ({
            ...e,
            cumulativePoints: 0,
            rankDelta: null,
          }))
        )
      )
    );

    const wrapper = await mountAt("/leagues/global");

    // Everyone tied on zero — the ranks are an ordering, not a standing.
    expect(wrapper.find(".podium").exists()).toBe(false);
    expect(wrapper.findAll(".standings-row")).toHaveLength(6);
  });

  it("counts down to kick-off and lists the entrants for a league that has not started", async () => {
    const today = Temporal.Now.plainDateISO("UTC");
    server.use(
      http.get("*/api/leagues/:leagueId", () =>
        HttpResponse.json({
          ...leagues[0],
          startDate: `${today.add({ days: 5 })}T00:00:00Z`,
          endDate: `${today.add({ days: 35 })}T23:59:59Z`,
        })
      ),
      http.get("*/api/leagues/:leagueId/leaderboard", () =>
        HttpResponse.json(
          deepBoard(4).map((e) => ({
            ...e,
            cumulativePoints: 0,
            rankDelta: null,
          }))
        )
      )
    );

    const wrapper = await mountAt("/leagues/global");

    expect(wrapper.find(".run").text()).toContain("Starts in 5 days");
    // Nothing has been played, so nobody is staged — but the entrants are here.
    expect(wrapper.find(".podium").exists()).toBe(false);
    expect(wrapper.findAll(".standings-row")).toHaveLength(4);
    expect(wrapper.text()).toContain("The league hasn't started yet");
  });

  it("crowns the top three on a podium once the season has ended", async () => {
    // The Italia fixture ended in 2024, with three teams.
    const wrapper = await mountAt("/leagues/italy");

    expect(wrapper.find(".run").text()).toContain("Season complete");

    const podium = wrapper.find(".podium");
    expect(wrapper.find(".podium-wrap--final").exists()).toBe(true);
    expect(wrapper.findAll(".step")).toHaveLength(3);
    expect(podium.text()).toContain("👑");
    expect(podium.text()).toContain("🥉");
    // Rank movement is meaningless once the season is over.
    expect(wrapper.find(".step-trend").exists()).toBe(false);

    // The full table still follows the podium.
    expect(wrapper.findAll(".standings-row")).toHaveLength(3);
  });

  it("keeps the podium off a finished league with no standings to crown", async () => {
    server.use(
      http.get("*/api/leagues/:leagueId/leaderboard", () =>
        HttpResponse.json([])
      )
    );

    const wrapper = await mountAt("/leagues/italy");

    expect(wrapper.find(".podium").exists()).toBe(false);
  });

  it("reads the league from the route rather than the selected league", async () => {
    // The store is seeded with the Global League; the route names Europe. The
    // NavBar's selector still says Global — that is the selection, not the page.
    const wrapper = await mountAt("/leagues/europe");

    expect(wrapper.find(".page-title").text()).toBe("Europe League");
    // Europe's teams, not Global's.
    expect(wrapper.find(".standings-table").text()).toContain("Euro Champions");
    expect(wrapper.find(".standings-table").text()).not.toContain(
      "Global Warriors"
    );
  });

  // The store settles on its own default a tick after a cold mount. Treating
  // that as a league switch used to bounce a deep link to the default league.
  it("stays on the deep-linked league while the store settles", async () => {
    const wrapper = await mountAt("/leagues/europe", false);
    await flushPromises();
    await flushPromises();

    expect(router.currentRoute.value.params.leagueId).toBe("europe");
    expect(wrapper.find(".page-title").text()).toBe("Europe League");
    // ...and the switcher is moved onto it, so chrome and page agree.
    expect(useLeagueStore().currentLeagueId).toBe("europe");
  });

  it("follows the NavBar league switcher to the newly selected league", async () => {
    const wrapper = await mountAt("/leagues/global");
    expect(wrapper.find(".page-title").text()).toBe("Global League");

    // What NavBar's selector does when a league is picked.
    useLeagueStore().setCurrentLeague(leagues[1]);
    await flushPromises();
    await flushPromises();

    expect(router.currentRoute.value.params.leagueId).toBe("italy");
    expect(wrapper.find(".page-title").text()).toBe("Italia League");
  });

  it("shows the whole leaderboard, not the dashboard card's window", async () => {
    const wrapper = await mountAt("/leagues/global");

    expect(wrapper.findAll(".standings-row")).toHaveLength(GLOBAL_TEAM_COUNT);
    expect(wrapper.find(".facts").text()).toContain(String(GLOBAL_TEAM_COUNT));
  });

  it("marks the viewer's own team", async () => {
    const wrapper = await mountAt("/leagues/global");

    const mine = wrapper.findAll(".standings-row--me");
    expect(mine).toHaveLength(1);
    expect(mine[0].text()).toContain(MY_TEAM_NAME);
    expect(mine[0].text()).toContain("You");
  });

  it("leaves every row unmarked in a league the viewer has no team in", async () => {
    server.use(
      http.get("*/api/leagues/:leagueId/my-team", () =>
        HttpResponse.json(
          { error: "No team found for this league" },
          { status: 404 }
        )
      )
    );

    const wrapper = await mountAt("/leagues/global");

    expect(wrapper.findAll(".standings-row")).toHaveLength(GLOBAL_TEAM_COUNT);
    expect(wrapper.findAll(".standings-row--me")).toHaveLength(0);
  });

  // Day one: every team is enrolled, nobody has been scored. The board is the
  // only place the roster is visible, so it lists them all rather than showing
  // an empty state.
  it("lists every team before the first scoring day has closed", async () => {
    server.use(
      http.get("*/api/leagues/:leagueId/leaderboard", () =>
        HttpResponse.json(
          deepBoard(GLOBAL_TEAM_COUNT).map((e) => ({
            ...e,
            cumulativePoints: 0,
            rankDelta: null,
          }))
        )
      )
    );

    const wrapper = await mountAt("/leagues/global");

    expect(wrapper.findAll(".standings-row")).toHaveLength(GLOBAL_TEAM_COUNT);
    expect(wrapper.text()).toContain("Scoring hasn't run yet");
    expect(wrapper.text()).not.toContain("No teams have joined");
  });

  it("shows the empty state only when the league has no teams at all", async () => {
    server.use(
      http.get("*/api/leagues/:leagueId/leaderboard", () =>
        HttpResponse.json([])
      )
    );

    const wrapper = await mountAt("/leagues/global");

    expect(wrapper.findAll(".standings-row")).toHaveLength(0);
    expect(wrapper.text()).toContain("No teams have joined this league yet");
  });

  it("says the standings failed rather than claiming the league is empty", async () => {
    server.use(
      http.get("*/api/leagues/:leagueId/leaderboard", () =>
        HttpResponse.json({ error: "boom" }, { status: 500 })
      )
    );

    const wrapper = await mountAt("/leagues/global");

    expect(wrapper.text()).toContain("Couldn't load the standings");
    expect(wrapper.text()).not.toContain("No teams have joined");
  });

  it("filters the standings by team name", async () => {
    const wrapper = await mountAt("/leagues/global");

    await search(wrapper, "cache");

    const rows = wrapper.findAll(".standings-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain("Cache Kings");
  });

  it("tells the reader when a search matches nothing", async () => {
    const wrapper = await mountAt("/leagues/global");

    await search(wrapper, "zzz-no-such-team");

    expect(wrapper.findAll(".standings-row")).toHaveLength(0);
    expect(wrapper.text()).toContain("No team matches that search");
  });

  it("reveals a long board in batches and extends it on infinite scroll", async () => {
    server.use(
      http.get("*/api/leagues/:leagueId/leaderboard", () =>
        HttpResponse.json(deepBoard(60))
      ),
      // The viewer has no row here, so nothing forces extra batches open.
      http.get("*/api/leagues/:leagueId/my-team", () =>
        HttpResponse.json(
          { error: "No team found for this league" },
          { status: 404 }
        )
      )
    );

    const wrapper = await mountAt("/leagues/global");

    expect(wrapper.findAll(".standings-row")).toHaveLength(25);
    expect(wrapper.text()).toContain("Showing 25 of 60");

    await scrollToEnd(wrapper);

    expect(wrapper.findAll(".standings-row")).toHaveLength(50);
    expect(wrapper.text()).toContain("Showing 50 of 60");
  });

  it("surfaces a retry when the league cannot be resolved", async () => {
    const wrapper = await mountAt("/leagues/no-such-league");

    expect(wrapper.text()).toContain("Couldn't load this league");
    expect(wrapper.findAll(".standings-row")).toHaveLength(0);
  });

  it("goes back to the dashboard from the back arrow", async () => {
    const wrapper = await mountAt("/leagues/global");
    const push = vi.spyOn(router, "push");

    await wrapper.find(".back-btn").trigger("click");

    expect(push).toHaveBeenCalledWith({ name: "Dashboard" });
    push.mockRestore();
  });
});
