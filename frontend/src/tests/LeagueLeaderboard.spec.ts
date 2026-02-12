import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import LeagueLeaderboard from "@/modules/TeamDashboard/LeagueLeaderboard.vue";
import { LeaderboardEntry, League, Team } from "@/types/models";

// Create a mock router
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/", component: { template: "<div>Home</div>" } },
    { path: "/leagues", component: { template: "<div>Leagues</div>" } },
    { path: "/market", component: { template: "<div>Market</div>" } },
  ],
});

describe("LeagueLeaderboard.vue", () => {
  let mockLeaderboard: LeaderboardEntry[];
  let mockLeague: League;
  let mockTeam: Team;

  beforeEach(() => {
    // Setup mock data
    mockLeaderboard = [
      {
        rank: 1,
        teamId: "team-4",
        playerId: "player-2",
        username: "WikiMaster",
        teamName: "Wiki Masters",
        points: 8950,
        change: 18.3,
        isCurrentUser: false,
      },
      {
        rank: 2,
        teamId: "team-5",
        playerId: "player-3",
        username: "DataKing",
        teamName: "Data Lords",
        points: 8420,
        change: 14.1,
        isCurrentUser: false,
      },
      {
        rank: 4,
        teamId: "team-1",
        playerId: "player-1",
        username: "Mario_Rossi",
        teamName: "I Cesarini",
        points: 7250,
        change: 12.5,
        isCurrentUser: true,
      },
    ];

    mockLeague = {
      id: "italy",
      name: "Italia League",
      icon: "🍕",
      season: "2024",
      language: "Italiano",
      totalPlayers: 523,
      endDate: "Feb 28, 2024",
    };

    mockTeam = {
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
    };
  });

  it("should render league information", () => {
    const wrapper = mount(LeagueLeaderboard, {
      props: {
        leaderBoardEntry: mockLeaderboard,
        currentLeague: mockLeague,
        currentTeam: mockTeam,
      },
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.text()).toContain("Italia League");
    expect(wrapper.text()).toContain("🍕");
  });

  it("should render league badges", () => {
    const wrapper = mount(LeagueLeaderboard, {
      props: {
        leaderBoardEntry: mockLeaderboard,
        currentLeague: mockLeague,
        currentTeam: mockTeam,
      },
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.text()).toContain("Italiano");
    expect(wrapper.text()).toContain("523 players");
    expect(wrapper.text()).toContain("Ends Feb 28, 2024");
  });

  it("should render all leaderboard entries", () => {
    const wrapper = mount(LeagueLeaderboard, {
      props: {
        leaderBoardEntry: mockLeaderboard,
        currentLeague: mockLeague,
        currentTeam: mockTeam,
      },
      global: {
        plugins: [router],
      },
    });

    const items = wrapper.findAllComponents({ name: "IonItem" });
    // 3 leaderboard items (we filter out the buttons)
    expect(items.filter((item) => item.classes("player-item")).length).toBe(3);
  });

  it("should have icon variables defined", () => {
    const wrapper = mount(LeagueLeaderboard, {
      props: {
        leaderBoardEntry: mockLeaderboard,
        currentLeague: mockLeague,
        currentTeam: mockTeam,
      },
      global: {
        plugins: [router],
      },
    });

    // Icons are defined as variables in the component
    const component = wrapper.vm as any;
    expect(component.crownIcon).toBe("👑");
    expect(component.medalIcon).toBe("🏅");
  });

  it("should display top player indicators", () => {
    const wrapper = mount(LeagueLeaderboard, {
      props: {
        leaderBoardEntry: mockLeaderboard,
        currentLeague: mockLeague,
        currentTeam: mockTeam,
      },
      global: {
        plugins: [router],
      },
    });

    // Check for top-rank class
    const topRanks = wrapper.findAll(".rank-badge.top-rank");
    expect(topRanks.length).toBeGreaterThan(0);
  });

  it("should highlight current user entry", () => {
    const wrapper = mount(LeagueLeaderboard, {
      props: {
        leaderBoardEntry: mockLeaderboard,
        currentLeague: mockLeague,
        currentTeam: mockTeam,
      },
      global: {
        plugins: [router],
      },
    });

    const currentUserItem = wrapper.findAll(".player-item.current-user");
    expect(currentUserItem.length).toBe(1);
  });

  it("should show positive changes in green", () => {
    const wrapper = mount(LeagueLeaderboard, {
      props: {
        leaderBoardEntry: mockLeaderboard,
        currentLeague: mockLeague,
        currentTeam: mockTeam,
      },
      global: {
        plugins: [router],
      },
    });

    const positiveChanges = wrapper.findAll(".player-change.positive");
    expect(positiveChanges.length).toBeGreaterThan(0);
  });

  it("should show negative changes in red", () => {
    mockLeaderboard[0].change = -5.2;

    const wrapper = mount(LeagueLeaderboard, {
      props: {
        leaderBoardEntry: mockLeaderboard,
        currentLeague: mockLeague,
        currentTeam: mockTeam,
      },
      global: {
        plugins: [router],
      },
    });

    const negativeChanges = wrapper.findAll(".player-change.negative");
    expect(negativeChanges.length).toBe(1);
  });

  it("should display points for all players", () => {
    const wrapper = mount(LeagueLeaderboard, {
      props: {
        leaderBoardEntry: mockLeaderboard,
        currentLeague: mockLeague,
        currentTeam: mockTeam,
      },
      global: {
        plugins: [router],
      },
    });

    // Points are displayed (may or may not have comma based on locale)
    const text = wrapper.text();
    expect(text.includes("8950") || text.includes("8,950")).toBe(true);
    expect(text.includes("8420") || text.includes("8,420")).toBe(true);
  });

  it("should have navigation buttons", () => {
    const wrapper = mount(LeagueLeaderboard, {
      props: {
        leaderBoardEntry: mockLeaderboard,
        currentLeague: mockLeague,
        currentTeam: mockTeam,
      },
      global: {
        plugins: [router],
      },
    });

    // Find buttons by text content
    const buttons = wrapper.findAll("ion-button");
    const viewButton = buttons.find((btn) =>
      btn.text().includes("View League Details")
    );
    const buyButton = buttons.find((btn) =>
      btn.text().includes("Buy Articles")
    );

    expect(viewButton?.exists()).toBe(true);
    expect(buyButton?.exists()).toBe(true);
  });
});
