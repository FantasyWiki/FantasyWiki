import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { Temporal } from "@js-temporal/polyfill";
import router from "@/router/index";
import MarketPage from "@/views/MarketPage.vue";
import { useLeagueStore } from "@/stores/league";
import { useAppStore } from "@/stores/app";
import { useMarket } from "@/composables/useMarket";
import type { LeagueDTO } from "../../../dto/leagueDTO";
import type { TeamDTO } from "../../../dto/teamDTO";
import i18n from "@/i18n";
import { LeagueVisibility } from "../../../model/enums";

vi.mock("@/composables/useArticleSummary", () => ({
  useArticleSummary: () => ({
    summary: ref(null),
    isLoading: ref(false),
    error: ref(null),
  }),
}));

// The viewer's team comes from the my-team query; mock it with mutable state
// so each test controls whose team the viewer is without racing the MSW
// my-team fixture.
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

// Same rationale as ArticleDetail.spec.ts: IonModal never "presents" in
// jsdom, so its slotted content stays unmounted unless replaced with a
// plain passthrough.
vi.mock("@ionic/vue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ionic/vue")>();
  return {
    ...actual,
    IonModal: { name: "IonModal", template: "<div><slot /></div>" },
  };
});

const fakeLeague: LeagueDTO = {
  id: "global",
  title: "Global League",
  domain: "en",
  languageScale: 1.0,
  icon: "🌍",
  startDate: Temporal.Now.instant(),
  endDate: Temporal.Now.instant(),
  visibility: LeagueVisibility.PUBLIC,
  teamCount: 0,
  closedAt: null,
};

// Matches the "global" league fixture in src/mocks/data/{leagues,teams,contracts}.ts:
// team-2 ("Global Warriors") holds a real contract on "Blockchain", which is
// also present in the mocked Wikimedia top-read list — the one row where the
// two data sources overlap.
const ownerTeam: TeamDTO = {
  id: "team-2",
  name: "Global Warriors",
  credits: 800,
  player: { id: "player-owner", name: "OwnerPlayer" },
};

const otherLeagueTeam: TeamDTO = {
  id: "team-6",
  name: "Wiki Warriors",
  credits: 600,
  player: { id: "player-other", name: "OtherPlayer" },
};

function makePlugins(currentTeam: TeamDTO | null = null) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const leagueStore = useLeagueStore();
  leagueStore.currentLeague = fakeLeague;
  myTeamMock.team = currentTeam;

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
  return { plugins, pinia };
}

/**
 * The Article Genie is optional — a backend with no Workers AI binding reports
 * it off on the session — so signing in has to say which kind of backend this
 * is (docs/development/local-dev-setup.md).
 */
function signIn(articleGenie: boolean) {
  useAppStore().setUserFromData({
    sub: "player-1",
    email: "player@example.com",
    name: "Player One",
    picture: "",
    features: { articleGenie },
  });
}

describe("MarketPage.vue", () => {
  beforeEach(async () => {
    await router.push("/market");
    await router.isReady();
  });

  it("offers the Genie when the backend has the model bound", async () => {
    const { plugins } = makePlugins();
    signIn(true);
    const wrapper = mount(MarketPage, { global: { plugins } });
    await flushPromises();
    expect(wrapper.find(".genie-trigger").exists()).toBe(true);
  });

  it("shows no trace of the Genie when the backend cannot wake it", async () => {
    const { plugins } = makePlugins();
    signIn(false);
    const wrapper = mount(MarketPage, { global: { plugins } });
    await flushPromises();
    expect(wrapper.find(".genie-trigger").exists()).toBe(false);
    expect(wrapper.findComponent({ name: "ArticleGenie" }).exists()).toBe(
      false
    );
  });

  it("mounts and renders article rows from the wikimedia top-read list", async () => {
    const { plugins } = makePlugins();
    const wrapper = mount(MarketPage, { global: { plugins } });
    await flushPromises();
    expect(wrapper.text()).toContain("Artificial Intelligence");
    expect(wrapper.text()).toContain("Bitcoin");
  });

  it("shows the league badge", async () => {
    const { plugins } = makePlugins();
    const wrapper = mount(MarketPage, { global: { plugins } });
    await flushPromises();
    const badge = wrapper.find("ion-badge");
    expect(badge.exists()).toBe(true);
  });

  it("displays Free Agent chip for articles without an owner", async () => {
    const { plugins } = makePlugins();
    const wrapper = mount(MarketPage, { global: { plugins } });
    await flushPromises();
    expect(wrapper.text()).toContain("Free Agent");
  });

  it("upgrades the matched row's chip once the league-contracts fetch resolves", async () => {
    const { plugins } = makePlugins();
    const wrapper = mount(MarketPage, { global: { plugins } });
    await flushPromises();
    await flushPromises();
    // "Blockchain" is owned by team-2 in the league fixture — its chip shows
    // the Owner Team ("Global Warriors"), not "Free Agent".
    expect(wrapper.text()).toContain("Global Warriors");
  });

  it("renders the listing from the top-read payload before the per-article views land", async () => {
    // The top-read result is localStorage-cached, and a cache hit resolves
    // fully-hydrated in one step — there would be no partial to observe.
    localStorage.clear();

    let releaseViews!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseViews = resolve;
    });
    server.use(
      http.get(
        "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/*",
        async () => {
          await gate;
          return HttpResponse.json({
            items: Array.from({ length: 365 }, () => ({ views: 100 })),
          });
        }
      )
    );

    const { plugins } = makePlugins();
    const wrapper = mount(MarketPage, { global: { plugins } });
    await flushPromises();

    // Every row is already on screen off the single top-read request, with its
    // yesterday count real and the derived columns still placeholders.
    const rows = wrapper.findAll(".market-row");
    expect(rows.length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain("Bitcoin");
    expect(rows[0].text()).toContain("—");

    releaseViews();
    await flushPromises();

    // Same rows, now carrying figures — and each article exactly once.
    const titles = wrapper
      .findAll(".market-row .article-title")
      .map((el) => el.text());
    expect(new Set(titles).size).toBe(titles.length);
    expect(wrapper.findAll(".market-row")[0].text()).not.toContain("—");
  });

  it("never names the player behind a rival team in the status chip", async () => {
    const { plugins } = makePlugins(otherLeagueTeam);
    const wrapper = mount(MarketPage, { global: { plugins } });
    await flushPromises();
    await flushPromises();

    // team-2's player is "Mario_Rossi" in the fixture — an account's Google
    // profile name in production, and not the market's to publish.
    expect(wrapper.text()).not.toContain("Mario_Rossi");
  });

  it("opens ArticleDetail as a free agent for an unmatched row", async () => {
    const { plugins } = makePlugins(ownerTeam);
    const wrapper = mount(MarketPage, { global: { plugins } });
    await flushPromises();
    await flushPromises();

    const bitcoinRow = wrapper
      .findAll(".market-row")
      .find((row) => row.text().includes("Bitcoin"));
    expect(bitcoinRow).toBeDefined();
    await bitcoinRow!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Buy Contract");
  });

  it("opens ArticleDetail as owned-by-viewer when the clicked row's contract belongs to the viewer's team", async () => {
    const { plugins } = makePlugins(ownerTeam);
    const wrapper = mount(MarketPage, { global: { plugins } });
    await flushPromises();
    await flushPromises();

    const blockchainRow = wrapper
      .findAll(".market-row")
      .find((row) => row.text().includes("Blockchain"));
    expect(blockchainRow).toBeDefined();
    await blockchainRow!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Sell Contract");
    expect(wrapper.text()).toContain("Renew");
  });

  it("opens ArticleDetail as locked-by-other when the clicked row's contract belongs to another team", async () => {
    const { plugins } = makePlugins(otherLeagueTeam);
    const wrapper = mount(MarketPage, { global: { plugins } });
    await flushPromises();
    await flushPromises();

    const blockchainRow = wrapper
      .findAll(".market-row")
      .find((row) => row.text().includes("Blockchain"));
    expect(blockchainRow).toBeDefined();
    await blockchainRow!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Request Trade");
    expect(wrapper.text()).toContain("Global Warriors");
  });
});

// Helper: run a composable inside a real Vue setup() context.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withSetup<T>(plugins: any[], composable: () => T): T {
  let result!: T;
  const Wrapper = defineComponent({
    setup() {
      result = composable();
      return {};
    },
    template: "<div/>",
  });
  mount(Wrapper, { global: { plugins } });
  return result;
}

describe("useMarket composable", () => {
  it("filters to free agents only", async () => {
    const { plugins } = makePlugins();
    const { filteredArticles, setStatusFilter } = withSetup(plugins, useMarket);
    await flushPromises();

    setStatusFilter("free");
    const owned = filteredArticles.value.filter((a) => a.owner !== null);
    expect(owned.length).toBe(0);
    expect(filteredArticles.value.length).toBeGreaterThan(0);
  });

  it("filters to owned articles only once the league-contracts fetch resolves", async () => {
    const { plugins } = makePlugins();
    const { filteredArticles, setStatusFilter } = withSetup(plugins, useMarket);
    await flushPromises();
    await flushPromises();

    setStatusFilter("owned");
    await flushPromises();
    await flushPromises();

    // Every contract in the "global" league fixture: "Blockchain" and "Cloud
    // computing" (team-2, mine), "GPT-4" and "Quantum computing" (team-6).
    const titles = filteredArticles.value.map((a) => a.title).sort();
    expect(titles).toEqual(
      ["Blockchain", "Cloud computing", "GPT-4", "Quantum computing"].sort()
    );
  });

  it("includes owned articles that are absent from the top-read snapshot", async () => {
    const { plugins } = makePlugins();
    const { filteredArticles, setStatusFilter } = withSetup(plugins, useMarket);
    await flushPromises();
    await flushPromises();

    setStatusFilter("owned");
    await flushPromises();
    await flushPromises();

    // "Cloud computing" is held by team-2 but is not in the mocked top-read
    // list — the row the owned filter used to drop.
    const cloud = filteredArticles.value.find(
      (a) => a.title === "Cloud computing"
    );
    expect(cloud).toBeDefined();
    expect(cloud!.owner).not.toBeNull();
    // Views come from the per-article fixture (365 days at 100 views/day), so
    // the row is priced off live pageviews — not left at the contract's
    // purchase price (180). Sub-2,000-view articles floor at 0 (ADR 0005).
    expect(cloud!.yearViews).toBe(36500);
    expect(cloud!.averageViews30d).toBe(100);
    expect(cloud!.price).toBe(0);
  });

  it("falls back to the purchase price when Wikimedia has no history for an owned article", async () => {
    server.use(
      http.get(
        "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/*",
        () => HttpResponse.json({ items: [] })
      )
    );
    const { plugins } = makePlugins();
    const { filteredArticles, setStatusFilter } = withSetup(plugins, useMarket);
    await flushPromises();
    await flushPromises();

    setStatusFilter("owned");
    await flushPromises();
    await flushPromises();

    // ctr-5: team-2's "Cloud computing", bought at 180. Pricing an article
    // with no usable history at 0 would read as a free giveaway.
    const cloud = filteredArticles.value.find(
      (a) => a.title === "Cloud computing"
    );
    expect(cloud?.price).toBe(180);
  });

  it("narrows owned articles locally instead of searching Wikipedia", async () => {
    const { plugins } = makePlugins();
    const { filteredArticles, isSearchFallback, setStatusFilter, setSearch } =
      withSetup(plugins, useMarket);
    await flushPromises();
    await flushPromises();

    setStatusFilter("owned");
    setSearch("Cloud");
    await flushPromises();
    await flushPromises();

    expect(isSearchFallback.value).toBe(false);
    const titles = filteredArticles.value.map((a) => a.title);
    expect(titles).toEqual(["Cloud computing"]);
  });

  it("filters top-50 locally for short queries (< 3 chars)", async () => {
    const { plugins } = makePlugins();
    const { filteredArticles, setSearch } = withSetup(plugins, useMarket);
    await flushPromises();

    // "bi" is 2 chars — stays in local Top-50 filter mode
    setSearch("bi");
    expect(filteredArticles.value.length).toBe(1);
    expect(filteredArticles.value[0].title).toBe("Bitcoin");
  });

  it("sorts by title ascending", async () => {
    const { plugins } = makePlugins();
    const { filteredArticles, toggleSort, sortDir } = withSetup(
      plugins,
      useMarket
    );
    await flushPromises();

    toggleSort("title");
    if (sortDir.value !== "asc") toggleSort("title");

    const titles = filteredArticles.value.map((a) => a.title);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b));
    expect(titles).toEqual(sorted);
  });

  it("paginates to 10 items per page", async () => {
    const { plugins } = makePlugins();
    const { paginatedArticles, totalPages } = withSetup(plugins, useMarket);
    await flushPromises();

    expect(paginatedArticles.value.length).toBeLessThanOrEqual(10);
    expect(totalPages.value).toBeGreaterThan(1);
  });

  it("switches to Wikipedia search for any query of 3+ chars, including Top-50 matches", async () => {
    const { plugins } = makePlugins();
    const { filteredArticles, isSearchFallback, setSearch } = withSetup(
      plugins,
      useMarket
    );
    await flushPromises();

    // "Photosynthesis" is not in the mock Top-50 but Wikipedia search is always used
    setSearch("Photosynthesis");
    await flushPromises();

    expect(isSearchFallback.value).toBe(true);
    // MSW returns { pages: [{ key: "Photosynthesis", ... }, { key: "Chlorophyll", ... }] }
    const titles = filteredArticles.value.map((a) => a.title);
    expect(titles).toContain("Photosynthesis");
  });

  it("also uses Wikipedia search when query matches something in the Top 50", async () => {
    const { plugins } = makePlugins();
    const { isSearchFallback, setSearch } = withSetup(plugins, useMarket);
    await flushPromises();

    // "Bitcoin" IS in the mock Top-50, but Wikipedia search should still fire
    setSearch("Bitcoin");
    await flushPromises();

    expect(isSearchFallback.value).toBe(true);
  });

  it("does not trigger Wikipedia search when query is shorter than 3 chars", async () => {
    const { plugins } = makePlugins();
    const { isSearchFallback, setSearch } = withSetup(plugins, useMarket);
    await flushPromises();

    setSearch("Ph"); // 2 chars — below the threshold
    await flushPromises();

    expect(isSearchFallback.value).toBe(false);
  });
});
