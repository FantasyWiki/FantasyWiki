import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { http, HttpResponse } from "msw";
import { Temporal } from "@js-temporal/polyfill";
import { server } from "@/mocks/server";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import router from "@/router/index";
import JoinLeaguePage from "@/views/JoinLeaguePage.vue";
import { useAppStore } from "@/stores/app";
import { LeagueVisibility } from "../../../model/enums";
import i18n from "@/i18n";

/**
 * Both cases serve their own league rather than leaning on a shared fixture's
 * `endDate`. Whether a mock league is running is a decision mock mode makes for
 * its own reasons — it has to reach the lifecycle controls, so most of its
 * leagues run — and a spec about what a *code* resolves to should not move when
 * that changes.
 */
const ENDED_CODE = "M4RSX";
const RUNNING_CODE = "ZK7QW";

function serveLeagueByCode(league: Record<string, unknown>) {
  server.use(
    http.get("*/api/leagues/by-code/:code", () => HttpResponse.json(league))
  );
}

/** A private league whose season has not run out, served for RUNNING_CODE. */
function serveRunningLeague() {
  serveLeagueByCode({
    id: "running-league",
    title: "Sunday Scholars",
    icon: "📚",
    domain: "en",
    startDate: Temporal.Now.instant().subtract({ hours: 24 }).toString(),
    endDate: Temporal.Now.instant()
      .add({ hours: 24 * 30 })
      .toString(),
    visibility: LeagueVisibility.PRIVATE,
    teamCount: 3,
    closedAt: null,
  });
}

/** A private league whose season is over, served for ENDED_CODE. */
function serveEndedLeague() {
  serveLeagueByCode({
    id: "ended-league",
    title: "Last Winter's League",
    icon: "❄️",
    domain: "en",
    startDate: "2024-01-01T00:00:00Z",
    endDate: "2024-03-01T00:00:00Z",
    visibility: LeagueVisibility.PRIVATE,
    teamCount: 3,
    closedAt: null,
  });
}

function makePlugins() {
  const pinia = createPinia();
  setActivePinia(pinia);

  useAppStore().setUserFromData({
    sub: "player-1",
    email: "player@example.com",
    name: "Player One",
    picture: "",
  });

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

let wrapper: VueWrapper | null = null;

async function mountAt(query: Record<string, string> = {}) {
  await router.push({ path: "/leagues/join", query });
  await router.isReady();
  wrapper = mount(JoinLeaguePage, { global: { plugins: makePlugins() } });
  await flushPromises();
  return wrapper;
}

beforeEach(async () => {
  await router.push("/leagues/join");
  await router.isReady();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

describe("JoinLeaguePage", () => {
  it("offers a code field and asks for nothing else up front", async () => {
    const page = await mountAt();

    expect(page.find("#invitation-code").exists()).toBe(true);
    // No league resolved yet, so nothing to name a team in.
    expect(page.find("#team-name").exists()).toBe(false);
  });

  it("resolves a code from an invitation link into a league and a form", async () => {
    serveRunningLeague();

    const page = await mountAt({ code: RUNNING_CODE });

    // The preview — what league this is — which is the whole point of
    // resolving a code before committing to it.
    expect(page.text()).toContain("Sunday Scholars");
    // …and the naming form, because joining is not a one-click action.
    expect(page.find("#team-name").exists()).toBe(true);
  });

  it("accepts a code the way it arrives out of a chat", async () => {
    serveRunningLeague();

    const page = await mountAt({ code: " zk7-qw " });

    expect(page.text()).toContain("Sunday Scholars");
  });

  it("previews a league whose season is over, but offers no way in", async () => {
    serveEndedLeague();

    const page = await mountAt({ code: ENDED_CODE });

    expect(page.text()).toContain("Last Winter's League");
    expect(page.text()).toContain("season is over");
    expect(page.find("#team-name").exists()).toBe(false);
  });

  it("says one thing for every code that opens nothing", async () => {
    // A wrong code and a malformed one are one answer on the server, so they
    // are one answer here too.
    const page = await mountAt({ code: "ZZZZZ" });

    expect(page.text()).toContain("No league opens with that code");
    expect(page.find("#team-name").exists()).toBe(false);
  });

  it("stays quiet while a code is still being typed", async () => {
    // Half a code is not a wrong code — complaining at character three would
    // mark every code wrong on the way to being right.
    const page = await mountAt({ code: "M4R" });

    expect(page.text()).not.toContain("No league opens with that code");
  });
});
