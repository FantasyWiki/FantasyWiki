import { describe, it, expect, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { Temporal } from "@js-temporal/polyfill";
import router from "@/router/index";
import MarketPage from "@/views/MarketPage.vue";
import { useLeagueStore } from "@/stores/league";
import { useMarket } from "@/composables/useMarket";
import type { LeagueDTO } from "../../../dto/leagueDTO";
import i18n from "@/i18n";

const fakeLeague: LeagueDTO = {
  id: "global",
  title: "Global League",
  description: "",
  domain: "en",
  icon: "🌍",
  startDate: Temporal.Now.instant(),
  endDate: Temporal.Now.instant(),
  teams: [],
};

function makePlugins() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const leagueStore = useLeagueStore();
  leagueStore.currentLeague = fakeLeague;

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

describe("MarketPage.vue", () => {
  beforeEach(async () => {
    await router.push("/market");
    await router.isReady();
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

  it("shows every article as a free agent", async () => {
    const { plugins } = makePlugins();
    const wrapper = mount(MarketPage, { global: { plugins } });
    await flushPromises();
    expect(wrapper.text()).not.toContain("CryptoKing42");
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

  it("filters to owned articles only returns empty (all are free agents)", async () => {
    const { plugins } = makePlugins();
    const { filteredArticles, setStatusFilter } = withSetup(plugins, useMarket);
    await flushPromises();

    setStatusFilter("owned");
    expect(filteredArticles.value.length).toBe(0);
  });

  it("filters by search query", async () => {
    const { plugins } = makePlugins();
    const { filteredArticles, setSearch } = withSetup(plugins, useMarket);
    await flushPromises();

    setSearch("bitcoin");
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
});
