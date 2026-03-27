/**
 * LeagueLeaderboard.vue — unit tests
 *
 * Key facts about the component (after reading the actual source):
 * - CSS classes used:  .player-item, .player-item--me, .rank-badge,
 *   .rank-badge--top, .player-change, .player-change--up, .player-change--down
 * - crownIcon / medalIcon are NOT exposed on the component instance — they are
 *   template-only emoji literals.
 * - The component receives pre-sliced `leaderBoardEntry` from the parent.
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import LeagueLeaderboard from "@/modules/TeamDashboard/LeagueLeaderboard.vue";
import type { LeaderboardEntry, League, Team } from "@/types/models";

// ── Router ─────────────────────────────────────────────────────────────────────

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/", component: { template: "<div/>" } },
    { path: "/leagues", component: { template: "<div/>" } },
    { path: "/market", component: { template: "<div/>" } },
  ],
});

// ── Fixtures ───────────────────────────────────────────────────────────────────

const mockLeague: League = {
  id: "italy",
  name: "Italia League",
  icon: "🍕",
  season: "2024",
  language: "Italiano",
  totalPlayers: 523,
  endDate: "Feb 28, 2024",
};

const mockTeam: Team = {
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

const mockLeaderboard: LeaderboardEntry[] = [
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

function mountComponent(
  entries: LeaderboardEntry[] = mockLeaderboard,
  league: League | null = mockLeague,
  team: Team | null = mockTeam
) {
  return mount(LeagueLeaderboard, {
    props: {
      leaderBoardEntry: entries,
      currentLeague: league,
      currentTeam: team,
    },
    global: { plugins: [router] },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("LeagueLeaderboard.vue", () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  it("mounts without errors", () => {
    expect(mountComponent().exists()).toBe(true);
  });

  // ── League header ──────────────────────────────────────────────────────────

  it("shows the league name", () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("Italia League");
  });

  it("shows the league icon", () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("🍕");
  });

  it("shows the language meta-chip", () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("Italiano");
  });

  it("shows the total players meta-chip", () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("523 players");
  });

  it("shows the end-date meta-chip", () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("Ends Feb 28, 2024");
  });

  // ── Skeleton / empty list ─────────────────────────────────────────────────

  it("renders skeleton items when leaderBoardEntry is empty", () => {
    const wrapper = mountComponent([]);
    expect(wrapper.find(".skeleton-list").exists()).toBe(true);
  });

  it("does not render the skeleton when entries are present", () => {
    const wrapper = mountComponent();
    expect(wrapper.find(".skeleton-list").exists()).toBe(false);
  });

  // ── Player list ────────────────────────────────────────────────────────────

  it("renders a .player-item for each entry", () => {
    const wrapper = mountComponent();
    expect(wrapper.findAll(".player-item").length).toBe(mockLeaderboard.length);
  });

  it("shows all player usernames", () => {
    const wrapper = mountComponent();
    const text = wrapper.text();
    expect(text).toContain("WikiMaster");
    expect(text).toContain("DataKing");
    expect(text).toContain("Mario_Rossi");
  });

  // ── Points ────────────────────────────────────────────────────────────────

  it("displays points for all players (with or without locale comma)", () => {
    const wrapper = mountComponent();
    const text = wrapper.text();
    expect(text.includes("8950") || text.includes("8,950")).toBe(true);
    expect(text.includes("8420") || text.includes("8,420")).toBe(true);
  });

  // ── Current-user highlight ─────────────────────────────────────────────────

  it("applies .player-item--me to the current user's row", () => {
    const wrapper = mountComponent();
    const myItems = wrapper.findAll(".player-item--me");
    expect(myItems.length).toBe(1);
  });

  it("shows a 'You' badge on the current user's row", () => {
    const wrapper = mountComponent();
    const myItem = wrapper.find(".player-item--me");
    expect(myItem.text()).toContain("You");
  });

  it("applies .player-name--me to the current user's name", () => {
    const wrapper = mountComponent();
    expect(wrapper.find(".player-name--me").text()).toContain("Mario_Rossi");
  });

  // ── Top-rank styling ──────────────────────────────────────────────────────

  it("applies .rank-badge--top to rank 1, 2, 3", () => {
    const wrapper = mountComponent();
    const topBadges = wrapper.findAll(".rank-badge--top");
    // Two of the three fixtures have rank ≤ 3
    expect(topBadges.length).toBe(2);
  });

  // ── Change indicators ──────────────────────────────────────────────────────

  it("applies .player-change--up for positive changes", () => {
    const wrapper = mountComponent();
    const upItems = wrapper.findAll(".player-change--up");
    expect(upItems.length).toBeGreaterThan(0);
  });

  it("applies .player-change--down for negative changes", () => {
    const negativeEntry: LeaderboardEntry = {
      rank: 3,
      teamId: "team-x",
      playerId: "player-x",
      username: "DropBot",
      teamName: "Drop",
      points: 7000,
      change: -5.2,
      isCurrentUser: false,
    };
    const wrapper = mountComponent([
      mockLeaderboard[0],
      negativeEntry,
      mockLeaderboard[2],
    ]);
    expect(wrapper.findAll(".player-change--down").length).toBeGreaterThan(0);
  });

  // ── Navigation buttons ────────────────────────────────────────────────────

  it("renders the 'View League Details' button", () => {
    const wrapper = mountComponent();
    const buttons = wrapper.findAll("ion-button");
    expect(buttons.some((b) => b.text().includes("View League Details"))).toBe(
      true
    );
  });

  it("renders the 'Buy Articles' button", () => {
    const wrapper = mountComponent();
    const buttons = wrapper.findAll("ion-button");
    expect(buttons.some((b) => b.text().includes("Buy Articles"))).toBe(true);
  });

  // ── Null league / team ─────────────────────────────────────────────────────

  it("does not throw when currentLeague is null", () => {
    expect(() => mountComponent(mockLeaderboard, null, null)).not.toThrow();
  });
});
