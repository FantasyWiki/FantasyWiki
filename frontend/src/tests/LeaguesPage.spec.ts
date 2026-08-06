import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import router from "@/router/index";
import LeaguesPage from "@/views/LeaguesPage.vue";
import { useAppStore } from "@/stores/app";
import { useLeagueStore } from "@/stores/league";
import { leagues } from "@/mocks/data/leagues";
import i18n from "@/i18n";

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

async function mountPage() {
  wrapper = mount(LeaguesPage, { global: { plugins: makePlugins() } });
  await flushPromises();
  return wrapper;
}

beforeEach(async () => {
  await router.push("/leagues");
  await router.isReady();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

describe("LeaguesPage", () => {
  it("lists every league the player is enrolled in", async () => {
    const page = await mountPage();

    const cards = page.findAll(".league-card");
    expect(cards).toHaveLength(leagues.length);
    expect(page.text()).toContain("Global League");
    expect(page.text()).toContain("Italia League");
  });

  it("shows how many teams play each league", async () => {
    const page = await mountPage();

    // The Global League fixture runs 12 teams deep; Americas holds a single
    // team, which is what exercises the singular form.
    expect(page.text()).toContain("12 players");
    expect(page.text()).toContain("1 player");
  });

  it("opens a league when its card is clicked", async () => {
    const page = await mountPage();

    await page.findAll(".league-card")[0].trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe(
      `/leagues/${leagues[0].id}`
    );
  });

  it("marks the league the rest of the app is scoped to", async () => {
    const plugins = makePlugins();
    const store = useLeagueStore();
    await store.fetchLeagues();
    store.setCurrentLeague(leagues[1]);

    wrapper = mount(LeaguesPage, { global: { plugins } });
    await flushPromises();

    const active = wrapper.findAll(".league-card--active");
    expect(active).toHaveLength(1);
    expect(active[0].text()).toContain(leagues[1].title);
  });

  it("offers the two ways into another league", async () => {
    const page = await mountPage();

    const actions = page.find(".actions").text();
    expect(actions).toContain("Join Private League");
    expect(actions).toContain("Create New League");
  });

  it("keeps a place for the public leagues that are not listed yet", async () => {
    const page = await mountPage();

    expect(page.find(".featured").text()).toContain("Featured Public Leagues");
  });

  it("marks a private league and leaves public ones unlabelled", async () => {
    const page = await mountPage();

    const cards = page.findAll(".league-card");
    const italia = cards.find((c) => c.text().includes("Italia League"));
    const global = cards.find((c) => c.text().includes("Global League"));

    expect(italia?.text()).toContain("Private");
    expect(global?.text()).not.toContain("Private");
  });

  it("says the first grid is the leagues the player already plays", async () => {
    const page = await mountPage();

    // The two grids look alike; without the heading the enrolled leagues read
    // as just more public ones to join.
    expect(page.text()).toContain("Leagues You're Playing");
  });

  it("invites a player with no leagues to find one", async () => {
    server.use(http.get("*/api/leagues", () => HttpResponse.json([])));

    const page = await mountPage();

    expect(page.find(".empty-state").exists()).toBe(true);
    expect(page.find(".league-card").exists()).toBe(false);
    // "Leagues You're Playing" over "you are not in any league yet" is the
    // heading contradicting the only line under it.
    expect(page.text()).not.toContain("Leagues You're Playing");
  });

  it("reports a failed fetch as an error, not as an empty league list", async () => {
    // The regression this guards: `availableLeagues` is empty in both cases, so
    // a page keying off the list alone tells an established player they own
    // nothing whenever the server hiccups.
    server.use(
      http.get("*/api/leagues", () =>
        HttpResponse.json({ error: "boom" }, { status: 500 })
      )
    );

    const page = await mountPage();

    expect(page.find(".state-card").exists()).toBe(true);
    expect(page.find(".empty-state").exists()).toBe(false);
    // Nor may the heading caption the error: it asserts leagues we failed to
    // read.
    expect(page.text()).not.toContain("Leagues You're Playing");
  });

  it("recovers when a retry succeeds", async () => {
    let failed = false;
    server.use(
      http.get("*/api/leagues", () => {
        if (failed) return HttpResponse.json(leagues);
        failed = true;
        return HttpResponse.json({ error: "boom" }, { status: 500 });
      })
    );

    const page = await mountPage();
    expect(page.find(".state-card").exists()).toBe(true);

    await page.find(".state-card ion-button").trigger("click");
    await flushPromises();

    expect(page.find(".state-card").exists()).toBe(false);
    expect(page.findAll(".league-card")).toHaveLength(leagues.length);
  });

  it("does not refetch when the store has already loaded", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/leagues", () => {
        calls += 1;
        return HttpResponse.json(leagues);
      })
    );

    const plugins = makePlugins();
    const store = useLeagueStore();
    await store.fetchLeagues();
    expect(calls).toBe(1);

    wrapper = mount(LeaguesPage, { global: { plugins } });
    await flushPromises();

    expect(calls).toBe(1);
    expect(wrapper.findAll(".league-card")).toHaveLength(leagues.length);
  });
});
