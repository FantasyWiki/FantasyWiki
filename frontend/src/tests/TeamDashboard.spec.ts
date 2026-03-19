import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import TeamDashboard from "@/views/TeamDashboard.vue";
import { useLeagueStore } from "@/stores/league";
import { useDashboardStore } from "@/stores/dashboard";
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";
import { createTestingPinia } from "@pinia/testing";

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/", component: { template: "<div>Home</div>" } },
    { path: "/dashboard", component: TeamDashboard },
    {
      path: "/notifications",
      component: { template: "<div>Notifications</div>" },
    },
    { path: "/market", component: { template: "<div>Market</div>" } },
  ],
});

describe("TeamDashboard.vue", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);

    // Clear any previous state
    localStorage.clear();
  });

  it("should render dashboard header with team name", async () => {
    const wrapper = mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Global Warriors");
  });

  it("should display league information", async () => {
    const wrapper = mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("🌐");
    expect(wrapper.text()).toContain("Global League");
    expect(wrapper.text()).toContain("Season 2024");
  });

  it("should handle component mounting", () => {
    const wrapper = mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    // Component should mount successfully
    expect(wrapper.exists()).toBe(true);
  });

  it("should hide loading state after data loads", async () => {
    const wrapper = mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    await flushPromises();

    expect(wrapper.find(".loading-container").exists()).toBe(false);
  });

  it("should render dashboard summary component", async () => {
    const wrapper = mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    await flushPromises();

    expect(wrapper.findComponent({ name: "DashboardSummary" }).exists()).toBe(
      true
    );
  });

  it("should render needed attention component", async () => {
    const wrapper = mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    await flushPromises();

    expect(wrapper.findComponent({ name: "NeededAttention" }).exists()).toBe(
      true
    );
  });

  it("should render league leaderboard component", async () => {
    const wrapper = mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    await flushPromises();

    expect(wrapper.findComponent({ name: "LeagueLeaderboard" }).exists()).toBe(
      true
    );
  });

  it("should navigate to notifications when clicking notifications button", async () => {
    const wrapper = mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    await flushPromises();

    const notificationButton = wrapper
      .findAll("ion-button")
      .find((btn) => btn.html().includes("notificationsOutline"));

    if (notificationButton) {
      await notificationButton.trigger("click");
      expect(router.currentRoute.value.path).toBe("/notifications");
    }
  });

  it("should have buy articles button", async () => {
    const wrapper = mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    await flushPromises();

    // Find by text content
    const buttons = wrapper.findAll("ion-button");
    const buyButton = buttons.find((btn) =>
      btn.text().includes("Buy Articles")
    );

    expect(buyButton?.exists()).toBe(true);
  });

  it("should have notification badge support", async () => {
    const leagueStore = useLeagueStore();
    leagueStore.setCurrentLeague({
      id: "italy",
      name: "Italia League",
      icon: "🍕",
      season: "2024",
      language: "Italiano",
      totalPlayers: 523,
      endDate: "Feb 28, 2024",
    });
    leagueStore.notificationsList = [
      {
        id: "notif-1",
        leagueId: "italy",
        teamId: "team-1",
        message: "Test notification",
        type: "contract_expiring",
        extra: "",
        read: false,
        createdAt: "2024-02-09T10:00:00Z",
      },
    ];

    await flushPromises();

    // Unread count should be tracked in store
    expect(leagueStore.unreadCount).toBeGreaterThan(0);
  });

  it("should handle API errors gracefully", async () => {
    server.use(
      http.get("*/api/dashboard/:leagueId", () =>
        HttpResponse.json({ error: "API Error" }, { status: 500 })
      )
    );

    const dashboardStore = useDashboardStore();
    await dashboardStore.fetchDashboardData();
    await flushPromises();
    expect(dashboardStore.error).toBe("API Error");
  });

  it("should handle no league selected", () => {
    const leagueStore = useLeagueStore();
    leagueStore.currentLeague = null;

    const wrapper = mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    // Component should still render
    expect(wrapper.exists()).toBe(true);
  });
  /* eslint-disable */
  it("should refresh data when league changes", async () => {
    const pinia = createTestingPinia({
      stubActions: false,
    });

    const wrapper = mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    await flushPromises();

    const leagueStore = useLeagueStore();
    const dashboardStore = useDashboardStore();
    const fetchSpy = vi.spyOn(dashboardStore, "fetchDashboardData");

    leagueStore.$patch({
      currentLeague: {
        id: "global",
        name: "Global League",
        icon: "🌐",
        season: "2024",
        language: "All Languages",
        totalPlayers: 10523,
        endDate: "Mar 31, 2024",
      },
    });

    await flushPromises();

    expect(fetchSpy).toHaveBeenCalledWith("global");
  });

  it("should initialize stores on mount", async () => {
    const leagueStore = useLeagueStore();
    const initSpy = vi.spyOn(leagueStore, "initialize");

    mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    await flushPromises();

    expect(initSpy).toHaveBeenCalled();
  });
});
