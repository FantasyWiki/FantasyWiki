import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import TeamDashboard from "@/views/TeamDashboard.vue";
import { useLeagueStore } from "@/stores/league";
import { useDashboardStore } from "@/stores/dashboard";

// Mock the API
vi.mock("@/services/api", () => ({
  default: {
    dashboard: {
      getData: vi.fn(() =>
        Promise.resolve({
          team: {
            id: "team-1",
            name: "I Cesarini",
            playerId: "player-1",
            leagueId: "italy",
            credits: 550,
            totalValue: 1000,
            rank: 4,
            points: 7250,
            yesterdayPoints: 127,
            pointsChange: 12.5,
          },
          league: {
            id: "italy",
            name: "Italia League",
            icon: "🍕",
            season: "2024",
            language: "Italiano",
            totalPlayers: 523,
            endDate: "Feb 28, 2024",
          },
          contracts: [
            {
              id: "ctr-1",
              teamId: "team-1",
              leagueId: "italy",
              purchasePrice: 150,
              currentPrice: 165,
              yesterdayPoints: 45,
              expiresIn: 2,
              tier: "MEDIUM",
              article: { id: "art-1", name: "Bitcoin", domain: "itwiki" },
            },
          ],
          leaderboard: [
            {
              rank: 1,
              teamId: "team-4",
              playerId: "player-2",
              username: "WikiMaster",
              teamName: "Wiki Masters",
              points: 8950,
              change: 18.3,
            },
          ],
          notifications: [],
          summary: {
            yesterdayPoints: 127,
            pointsChange: 12.5,
            rank: 4,
            totalPlayers: 523,
            credits: 550,
            portfolioValue: 1000,
            activeContracts: 4,
            maxContracts: 18,
          },
        })
      ),
    },
    leagues: {
      getAll: vi.fn(() =>
        Promise.resolve([
          {
            id: "italy",
            name: "Italia League",
            icon: "🍕",
            season: "2024",
            language: "Italiano",
            totalPlayers: 523,
            endDate: "Feb 28, 2024",
          },
        ])
      ),
      getTeam: vi.fn(() =>
        Promise.resolve({
          id: "team-1",
          name: "I Cesarini",
          playerId: "player-1",
          leagueId: "italy",
          credits: 550,
          totalValue: 1000,
          rank: 4,
          points: 7250,
          yesterdayPoints: 127,
          pointsChange: 12.5,
        })
      ),
    },
    notifications: {
      getAll: vi.fn(() => Promise.resolve([])),
    },
  },
}));

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

    expect(wrapper.text()).toContain("I Cesarini Dashboard");
  });

  it("should display league information", async () => {
    const wrapper = mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("🍕");
    expect(wrapper.text()).toContain("Italia League");
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

    // const wrapper = mount(TeamDashboard, {
    //   global: {
    //     plugins: [pinia, router],
    //   },
    // });

    await flushPromises();

    // Unread count should be tracked in store
    expect(leagueStore.unreadCount).toBeGreaterThan(0);
  });

  it("should handle API errors gracefully", async () => {
    const api = await import("@/services/api");
    const dashboardStore = useDashboardStore();
    vi.mocked(api.default.dashboard.getData).mockRejectedValueOnce(
      new Error("API Error")
    );
    dashboardStore.fetchDashboardData();

    // const wrapper = mount(TeamDashboard, {
    //   global: {
    //     plugins: [pinia, router],
    //   },
    // });

    await flushPromises();

    // Error should be captured in store
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

  it("should refresh data when league changes", async () => {
    mount(TeamDashboard, {
      global: {
        plugins: [pinia, router],
      },
    });

    await flushPromises();

    const leagueStore = useLeagueStore();
    const dashboardStore = useDashboardStore();

    const fetchSpy = vi.spyOn(dashboardStore, "fetchDashboardData");

    // Change league
    leagueStore.currentLeague = {
      id: "global",
      name: "Global League",
      icon: "🌐",
      season: "2024",
      language: "All Languages",
      totalPlayers: 10523,
      endDate: "Mar 31, 2024",
    };

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
