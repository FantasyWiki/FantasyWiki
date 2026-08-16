import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { alertController } from "@ionic/vue";
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

/**
 * Ionic's alert element never upgrades in jsdom, so the controller is stubbed
 * with the smallest object the composable actually drives: it presents, and it
 * reports a dismissal. `dismissed: false` leaves that promise pending, which is
 * the state a dialog is in while the player is still looking at it.
 */
function fakeAlert({ dismissed = false } = {}) {
  return {
    present: vi.fn().mockResolvedValue(undefined),
    onDidDismiss: vi
      .fn()
      .mockReturnValue(dismissed ? Promise.resolve({}) : new Promise(() => {})),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/** The handler behind the alert's destructive button. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function confirmOf(opts: any): (() => void) | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const button = opts?.buttons?.find((b: any) => b.role === "destructive");
  return button?.handler;
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
    expect(facts).toContain("Dec 31, 2099");
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
    // Americas is the one fixture whose season is over — see
    // mocks/data/leagues.ts, where the rest run on so that mock mode can reach
    // the lifecycle controls at all.
    const wrapper = await mountAt("/leagues/americas");

    expect(wrapper.find(".run").text()).toContain("Season complete");

    const podium = wrapper.find(".podium");
    expect(wrapper.find(".podium-wrap--final").exists()).toBe(true);
    expect(wrapper.findAll(".step")).toHaveLength(3);
    expect(podium.text()).toContain("👑");
    expect(podium.text()).toContain("🥉");
    // Rank movement is meaningless once the season is over.
    expect(wrapper.find(".step-trend").exists()).toBe(false);

    // The full table still follows the podium — all four, not just the three
    // on the steps.
    expect(wrapper.findAll(".standings-row")).toHaveLength(4);
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

  // A league the player has no team in is legitimately readable while one of
  // theirs stays selected — that is the whole of arriving from the featured
  // shelf or an invitation link. Treating "the selection is not this league"
  // as "the player switched leagues" redirected off it the instant anything
  // touched the store, which made the join card unreachable: the page appeared
  // for a frame and was then replaced by the selected league.
  it("stays on a league the player has not joined while the store churns", async () => {
    const wrapper = await mountAt("/leagues/open-science");
    expect(wrapper.find(".page-title").text()).toBe("Open Science League");

    // Anything that re-publishes the league list — a refresh, a second mount —
    // used to be read as a switch, because the selection had never matched.
    await useLeagueStore().fetchLeagues();
    await flushPromises();
    await flushPromises();

    expect(router.currentRoute.value.params.leagueId).toBe("open-science");
    expect(wrapper.find(".page-title").text()).toBe("Open Science League");
    // The switcher is untouched: an unjoined league is not selectable.
    expect(useLeagueStore().currentLeagueId).not.toBe("open-science");
  });

  it("stays on an ended league of the player's while the store churns", async () => {
    // Same rule for the archive: an ended league is readable but never
    // selectable, since the picker only offers leagues still being played.
    const wrapper = await mountAt("/leagues/americas");
    expect(wrapper.find(".page-title").text()).toBe("Americas League");

    await useLeagueStore().fetchLeagues();
    await flushPromises();
    await flushPromises();

    expect(router.currentRoute.value.params.leagueId).toBe("americas");
    expect(useLeagueStore().currentLeagueId).not.toBe("americas");
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

  // ── Lifecycle controls ────────────────────────────────────────────────────
  //
  // Who is offered what is the server's answer (`my-role`), not something the
  // page works out — see docs/domain/league-lifecycle.md. Every fixture league
  // but Global has already finished, so these run the clock forward to a league
  // that is still being played.

  /** A running season, so the footer is offered at all. */
  function runningLeague(overrides: Record<string, unknown> = {}) {
    const today = Temporal.Now.plainDateISO("UTC");
    return http.get("*/api/leagues/:leagueId", () =>
      HttpResponse.json({
        ...leagues[1],
        startDate: `${today.subtract({ days: 3 })}T00:00:00Z`,
        endDate: `${today.add({ days: 20 })}T23:59:59Z`,
        ...overrides,
      })
    );
  }

  function roleIs(isMember: boolean, isAdmin: boolean) {
    return http.get("*/api/leagues/:leagueId/my-role", () =>
      HttpResponse.json({ isMember, isAdmin })
    );
  }

  it("offers a member the way out, and not the admin's", async () => {
    server.use(runningLeague(), roleIs(true, false));

    const wrapper = await mountAt("/leagues/italy");

    const footer = wrapper.find(".lifecycle");
    expect(footer.exists()).toBe(true);
    expect(footer.text()).toContain("Leave this league");
    expect(footer.text()).not.toContain("Close this league");
  });

  it("offers the admin the close, and not the leave", async () => {
    // An admin who left would leave a league nobody could end.
    server.use(runningLeague(), roleIs(true, true));

    const wrapper = await mountAt("/leagues/italy");

    const footer = wrapper.find(".lifecycle");
    expect(footer.text()).toContain("Close this league");
    expect(footer.text()).not.toContain("Leave this league");
  });

  it("offers nothing to someone who only watches the league", async () => {
    server.use(runningLeague(), roleIs(false, false));

    const wrapper = await mountAt("/leagues/italy");

    expect(wrapper.find(".lifecycle").exists()).toBe(false);
  });

  it("never offers to leave the Global League", async () => {
    // First run enrols every player into it and would route them straight
    // back, so there is no way out to offer.
    server.use(roleIs(true, false));

    const wrapper = await mountAt("/leagues/global");

    expect(wrapper.find(".lifecycle").exists()).toBe(false);
  });

  it("says a closed league is closed, and offers neither action", async () => {
    server.use(
      runningLeague({ closedAt: "2026-08-01T00:00:00Z" }),
      roleIs(true, true)
    );

    const wrapper = await mountAt("/leagues/italy");

    const footer = wrapper.find(".lifecycle");
    expect(footer.text()).toContain("closed early");
    expect(footer.findAll(".lifecycle-btn")).toHaveLength(0);
  });

  it("confirms through Ionic rather than a blocking native dialog", async () => {
    // `confirm()` freezes the page and the automation harness with it, and
    // cannot be read the way the rest of the app can.
    server.use(runningLeague(), roleIs(true, false));
    const nativeConfirm = vi.spyOn(window, "confirm");
    const create = vi
      .spyOn(alertController, "create")
      .mockResolvedValue(fakeAlert());

    const wrapper = await mountAt("/leagues/italy");
    await wrapper.find(".lifecycle-btn").trigger("click");
    await flushPromises();

    expect(create).toHaveBeenCalled();
    expect(nativeConfirm).not.toHaveBeenCalled();
    create.mockRestore();
    nativeConfirm.mockRestore();
  });

  it("leaves the league once the confirmation is accepted", async () => {
    server.use(runningLeague(), roleIs(true, false));
    let left = false;
    server.use(
      http.post("*/api/leagues/:leagueId/my-departure", () => {
        left = true;
        return HttpResponse.json({ success: true });
      })
    );
    // Take the destructive button's handler off the alert and press it, which
    // is what a player tapping "Leave" in the dialog does.
    const create = vi
      .spyOn(alertController, "create")
      .mockImplementation(async (opts) => {
        confirmOf(opts)?.();
        return fakeAlert();
      });

    const wrapper = await mountAt("/leagues/italy");
    await wrapper.find(".lifecycle-btn").trigger("click");
    await flushPromises();

    expect(left).toBe(true);
    create.mockRestore();
  });

  it("does not leave when the confirmation is dismissed", async () => {
    server.use(runningLeague(), roleIs(true, false));
    let left = false;
    server.use(
      http.post("*/api/leagues/:leagueId/my-departure", () => {
        left = true;
        return HttpResponse.json({ success: true });
      })
    );
    // Neither button pressed — the dialog was dismissed by backdrop or Escape.
    const create = vi
      .spyOn(alertController, "create")
      .mockResolvedValue(fakeAlert({ dismissed: true }));

    const wrapper = await mountAt("/leagues/italy");
    await wrapper.find(".lifecycle-btn").trigger("click");
    await flushPromises();

    expect(left).toBe(false);
    create.mockRestore();
  });
});
