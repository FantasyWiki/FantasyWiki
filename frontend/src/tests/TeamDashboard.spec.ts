/**
 * TeamDashboard.vue — integration tests
 *
 * Environment notes:
 * - MSW intercepts all /api/* calls via setup.ts.
 * - "No League Selected" test: TeamDashboard's NavBar child calls
 *   `leagueStore.initialize()` on mount which fetches leagues from MSW and
 *   sets currentLeague to the first result — overwriting our null.
 *   We stub `initialize` to a no-op so the store stays null after mount.
 * - `trigger()` cannot set event.target — emit events on the component vm.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import TeamDashboard from "@/views/TeamDashboard.vue";
import { useLeagueStore } from "@/stores/league";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/", component: { template: "<div/>" } },
    { path: "/dashboard", component: TeamDashboard },
    { path: "/market", component: { template: "<div/>" } },
    { path: "/leagues", component: { template: "<div/>" } },
  ],
});

function mountDashboard() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return {
    wrapper: mount(TeamDashboard, {
      global: {
        plugins: [
          pinia,
          router,
          [VueQueryPlugin, { queryClient: makeQueryClient() }],
        ],
      },
    }),
    pinia,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("TeamDashboard.vue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── Mounting ───────────────────────────────────────────────────────────────

  it("mounts without errors", () => {
    const { wrapper } = mountDashboard();
    expect(wrapper.exists()).toBe(true);
  });

  it("hides the loading spinner after data has loaded", async () => {
    const { wrapper } = mountDashboard();
    await flushPromises();
    expect(wrapper.find(".loading-container").exists()).toBe(false);
  });

  // ── Child components ───────────────────────────────────────────────────────

  it("renders DashboardHero after data loads", async () => {
    const { wrapper } = mountDashboard();
    await flushPromises();
    expect(wrapper.findComponent({ name: "DashboardHero" }).exists()).toBe(
      true
    );
  });

  it("renders NeededAttention after data loads", async () => {
    const { wrapper } = mountDashboard();
    await flushPromises();
    expect(wrapper.findComponent({ name: "NeededAttention" }).exists()).toBe(
      true
    );
  });

  it("renders LeagueLeaderboard after data loads", async () => {
    const { wrapper } = mountDashboard();
    await flushPromises();
    expect(wrapper.findComponent({ name: "LeagueLeaderboard" }).exists()).toBe(
      true
    );
  });

  // ── No league selected ────────────────────────────────────────────────────
  // NavBar.vue calls leagueStore.initialize() on mount which fetches leagues
  // from MSW and sets currentLeague — overwriting our null.
  // We stub initialize() to a no-op before mounting so the store stays null.

  it("shows 'No League Selected' when currentLeague stays null", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const leagueStore = useLeagueStore();
    // Keep currentLeague null and prevent NavBar from overwriting it
    leagueStore.currentLeague = null;
    vi.spyOn(leagueStore, "initialize").mockResolvedValue(undefined);

    const wrapper = mount(TeamDashboard, {
      global: {
        plugins: [
          pinia,
          router,
          [VueQueryPlugin, { queryClient: makeQueryClient() }],
        ],
      },
    });

    await flushPromises();
    expect(wrapper.text()).toContain("No League Selected");
  });

  // ── Prop values passed to children ────────────────────────────────────────

  it("passes only urgent contracts (expiresIn ≤ 3) to NeededAttention", async () => {
    const { wrapper } = mountDashboard();
    await flushPromises();
    const urgent = wrapper
      .findComponent({ name: "NeededAttention" })
      .props("urgentContract") as Array<{ expiresIn: number }>;
    expect(Array.isArray(urgent)).toBe(true);
    urgent.forEach((c) => expect(c.expiresIn).toBeLessThanOrEqual(3));
  });

  it("passes leaderboard entries that include the current user", async () => {
    const { wrapper } = mountDashboard();
    await flushPromises();
    const entries = wrapper
      .findComponent({ name: "LeagueLeaderboard" })
      .props("leaderBoardEntry") as Array<{ isCurrentUser: boolean }>;
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.some((e) => e.isCurrentUser)).toBe(true);
  });

  it("passes the same league object to DashboardHero and LeagueLeaderboard", async () => {
    const { wrapper } = mountDashboard();
    await flushPromises();
    const heroLeague = wrapper
      .findComponent({ name: "DashboardHero" })
      .props("currentLeague");
    const lbLeague = wrapper
      .findComponent({ name: "LeagueLeaderboard" })
      .props("currentLeague");
    expect(heroLeague).not.toBeNull();
    expect(heroLeague).toStrictEqual(lbLeague);
  });

  // ── Pull-to-refresh ───────────────────────────────────────────────────────

  it("has an IonRefresher element", async () => {
    const { wrapper } = mountDashboard();
    await flushPromises();
    expect(wrapper.findComponent({ name: "IonRefresher" }).exists()).toBe(true);
  });

  it("handleRefresh does not throw when ionRefresh fires", async () => {
    const { wrapper } = mountDashboard();
    await flushPromises();
    const refresher = wrapper.findComponent({ name: "IonRefresher" });
    // Use vm.$emit — trigger() cannot set event.target
    await refresher.vm.$emit("ionRefresh", { target: { complete: vi.fn() } });
    expect(wrapper.exists()).toBe(true);
  });
});
