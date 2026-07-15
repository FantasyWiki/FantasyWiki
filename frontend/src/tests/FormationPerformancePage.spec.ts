import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { Temporal } from "@js-temporal/polyfill";
import router from "@/router/index";
import FormationPerformancePage from "@/views/FormationPerformancePage.vue";
import { useFormationPerformance } from "@/composables/useFormationPerformance";
import { useLeagueStore } from "@/stores/league";
import type { LeagueDTO } from "../../../dto/leagueDTO";
import i18n from "@/i18n";

// TeamFormation measures the pitch with a ResizeObserver, which jsdom lacks.
beforeAll(() => {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

// The "italy" league fixture: the current player (player-1) owns team-1, which
// has two scored days in src/mocks/data/performances.ts — 920 (last night) and
// 870 (the night before), a +5.7% swing.
const italyLeague: LeagueDTO = {
  id: "italy",
  title: "Italy League",
  domain: "it",
  icon: "🇮🇹",
  startDate: Temporal.Now.instant(),
  endDate: Temporal.Now.instant(),
  teams: [],
};

// A league the current player has no scored day in, to exercise the empty state.
const emptyLeague: LeagueDTO = {
  ...italyLeague,
  id: "americas",
  title: "Americas League",
  icon: "🌎",
};

function makePlugins(league: LeagueDTO) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const leagueStore = useLeagueStore();
  leagueStore.currentLeague = league;

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
  return { plugins };
}

describe("FormationPerformancePage.vue", () => {
  beforeEach(async () => {
    await router.push("/performance");
    await router.isReady();
  });

  it("shows last night's score and the league badge", async () => {
    const { plugins } = makePlugins(italyLeague);
    const wrapper = mount(FormationPerformancePage, { global: { plugins } });
    await flushPromises();

    expect(wrapper.text()).toContain("Last Night's Performance");
    expect(wrapper.text()).toContain("920");
    const badge = wrapper.find("ion-badge");
    expect(badge.exists()).toBe(true);
  });

  it("renders a day-over-day delta versus the previous night", async () => {
    const { plugins } = makePlugins(italyLeague);
    const wrapper = mount(FormationPerformancePage, { global: { plugins } });
    await flushPromises();

    // 920 vs 870 → +6% (rounded), shown as an "up" delta.
    expect(wrapper.find(".score-delta--up").exists()).toBe(true);
    expect(wrapper.text()).toContain("+6%");
  });

  it("renders the scored formation on the pitch", async () => {
    const { plugins } = makePlugins(italyLeague);
    const wrapper = mount(FormationPerformancePage, { global: { plugins } });
    await flushPromises();

    // TeamFormation draws a pitch card with the chemistry legend.
    expect(wrapper.find(".pitch-card").exists()).toBe(true);
  });

  it("shows the empty state when the team has no scored day", async () => {
    const { plugins } = makePlugins(emptyLeague);
    const wrapper = mount(FormationPerformancePage, { global: { plugins } });
    await flushPromises();

    expect(wrapper.find(".empty-card").exists()).toBe(true);
    expect(wrapper.find(".pitch-card").exists()).toBe(false);
  });
});

// Helper: run a composable inside a real Vue setup() context.
function withSetup<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: any[],
  composable: () => T
): T {
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

describe("useFormationPerformance composable", () => {
  it("exposes the latest and previous scored days with a positive delta", async () => {
    const { plugins } = makePlugins(italyLeague);
    const { latest, previous, points, pointsDelta, pointsDeltaPercent } =
      withSetup(plugins, useFormationPerformance);
    await flushPromises();

    expect(points.value).toBe(920);
    expect(latest.value?.points).toBe(920);
    expect(previous.value?.points).toBe(870);
    expect(pointsDelta.value).toBe(50);
    expect(pointsDeltaPercent.value).toBe(6);
  });

  it("reports no performance for a league the player hasn't been scored in", async () => {
    const { plugins } = makePlugins(emptyLeague);
    const { hasPerformance, formation } = withSetup(
      plugins,
      useFormationPerformance
    );
    await flushPromises();

    expect(hasPerformance.value).toBe(false);
    expect(formation.value).toBeNull();
  });
});
