import { describe, it, expect, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import router from "@/router/index";
import LeagueLeaderboard from "@/components/teamDashboard/LeagueLeaderboard.vue";
import type { LeaderboardEntryDTO } from "../../../../dto/leaderboardDTO";
import type { TeamDTO } from "../../../../dto/teamDTO";

const SLICE = 5;

function team(rank: number): TeamDTO {
  return {
    id: `team-${rank}`,
    name: `Team ${rank}`,
    credits: 0,
    player: { id: `player-${rank}`, name: `Player ${rank}` },
  };
}

/** A leaderboard of `size` teams, already ranked 1..size like the API returns it. */
function leaderboardOf(size: number): LeaderboardEntryDTO[] {
  return Array.from({ length: size }, (_, i) => ({
    team: team(i + 1),
    cumulativePoints: (size - i) * 100,
    rank: i + 1,
    rankDelta: 0,
  }));
}

function mountBoard(
  entries: LeaderboardEntryDTO[],
  myRank: number | null,
  loading = false
) {
  return mount(LeagueLeaderboard, {
    props: {
      leaderboard: entries,
      // Skips the meta chips (and their endDate formatting) so the spec stays
      // on the windowing logic.
      currentLeague: null,
      currentTeam: myRank === null ? null : team(myRank),
      slice: SLICE,
      loading,
    },
    global: { plugins: [router] },
  });
}

/** Rank badge + team name of every rendered row, top to bottom. */
function renderedRows(wrapper: ReturnType<typeof mountBoard>) {
  return wrapper.findAll(".player-item").map((item) => ({
    badge: item.find(".rank-badge").text(),
    name: item.find(".player-name").text(),
  }));
}

/**
 * The window used to be applied with a `v-if` on the row *inside* each
 * `ion-item`, so excluded entries still rendered as empty item shells — a team
 * placed 5th of 5 saw two blank rows where 1st and 2nd should have been. The
 * assertions below are on rendered row count and badge text, because any
 * text-only assertion passes against that bug.
 */
describe("teamDashboard/LeagueLeaderboard.vue", () => {
  beforeAll(async () => {
    router.push("/");
    await router.isReady();
  });

  it("renders no blank rows when the window is clamped at the top", () => {
    // The reported bug: 5-team league, viewer is 5th.
    const wrapper = mountBoard(leaderboardOf(5), 5);

    expect(renderedRows(wrapper)).toEqual([
      { badge: "👑", name: "Team 1" },
      { badge: "🥈", name: "Team 2" },
      { badge: "🥉", name: "Team 3" },
      { badge: "4", name: "Team 4" },
      { badge: "5", name: "Team 5" },
    ]);
  });

  it("renders every team when the league is smaller than the window", () => {
    const wrapper = mountBoard(leaderboardOf(3), 3);

    expect(renderedRows(wrapper).map((r) => r.name)).toEqual([
      "Team 1",
      "Team 2",
      "Team 3",
    ]);
  });

  it("centres the window on the viewer mid-league", () => {
    const wrapper = mountBoard(leaderboardOf(20), 10);

    expect(renderedRows(wrapper).map((r) => r.badge)).toEqual([
      "👑",
      "8",
      "9",
      "10",
      "11",
      "12",
    ]);
  });

  it("shows a full window, with true ranks, for the league leader", () => {
    const wrapper = mountBoard(leaderboardOf(20), 1);

    expect(renderedRows(wrapper)).toEqual([
      { badge: "👑", name: "Team 1" },
      { badge: "🥈", name: "Team 2" },
      { badge: "🥉", name: "Team 3" },
      { badge: "4", name: "Team 4" },
      { badge: "5", name: "Team 5" },
    ]);
  });

  it("shows a full window, with true ranks, for the team in last place", () => {
    const wrapper = mountBoard(leaderboardOf(20), 20);

    expect(renderedRows(wrapper).map((r) => r.badge)).toEqual([
      "👑",
      "16",
      "17",
      "18",
      "19",
      "20",
    ]);
  });

  it("falls back to the top of the table when the viewer has no team in it", () => {
    const wrapper = mountBoard(leaderboardOf(20), null);

    expect(renderedRows(wrapper).map((r) => r.name)).toEqual([
      "Team 1",
      "Team 2",
      "Team 3",
      "Team 4",
      "Team 5",
    ]);
  });

  it("centres the window in an 11-team league on the team sitting 4th", () => {
    const wrapper = mountBoard(leaderboardOf(11), 4);

    // The window starts at rank 2, so the pinned leader runs straight on into
    // it — nothing is skipped, so no gap marker.
    expect(renderedRows(wrapper).map((r) => r.badge)).toEqual([
      "👑",
      "🥈",
      "🥉",
      "4",
      "5",
      "6",
    ]);
    expect(wrapper.findAll(".rank-gap")).toHaveLength(0);
  });

  it("marks the viewer's own row", () => {
    const wrapper = mountBoard(leaderboardOf(20), 10);

    const mine = wrapper.findAll(".player-item--me");
    expect(mine).toHaveLength(1);
    expect(mine[0].find(".rank-badge").text()).toBe("10");
    expect(mine[0].find(".player-name").text()).toBe("Team 10");
  });

  /**
   * A window that has scrolled past rank 1 hides the league leader, which
   * reads as a broken table. The leader is pinned on top instead, with a
   * marker for the ranks skipped between them and the window.
   */
  describe("pinned leader", () => {
    it("pins the leader above a gap marker when ranks are skipped", () => {
      const wrapper = mountBoard(leaderboardOf(20), 5);

      // Rank 2 is skipped, so the gap marker sits between 👑 and 🥉.
      expect(renderedRows(wrapper).map((r) => r.badge)).toEqual([
        "👑",
        "🥉",
        "4",
        "5",
        "6",
        "7",
      ]);
      expect(wrapper.findAll(".rank-gap")).toHaveLength(1);

      // ...and it sits directly under the pinned row, not anywhere else.
      const lines = wrapper.findAll(".player-item, .rank-gap");
      expect(lines[1].classes()).toContain("rank-gap");
    });

    it("pins the leader exactly once", () => {
      const wrapper = mountBoard(leaderboardOf(20), 5);

      // Guards against a refactor that prepends the leader unconditionally and
      // duplicates them into a window that already starts at rank 1.
      expect(
        renderedRows(wrapper).filter((r) => r.badge === "👑")
      ).toHaveLength(1);
    });

    it("does not pin or mark a gap when the window already shows the leader", () => {
      const wrapper = mountBoard(leaderboardOf(20), 3);

      expect(renderedRows(wrapper).map((r) => r.badge)).toEqual([
        "👑",
        "🥈",
        "🥉",
        "4",
        "5",
      ]);
      expect(wrapper.findAll(".rank-gap")).toHaveLength(0);
    });

    it("does not mark a gap for the leader themselves", () => {
      const wrapper = mountBoard(leaderboardOf(20), 1);

      expect(wrapper.findAll(".rank-gap")).toHaveLength(0);
      expect(
        renderedRows(wrapper).filter((r) => r.badge === "👑")
      ).toHaveLength(1);
    });
  });

  /**
   * The card used to key the skeleton off `leaderboard.length === 0`, using
   * emptiness as a stand-in for loading — so a league that genuinely has no
   * scored standings yet showed an animated skeleton that never resolved.
   */
  describe("empty vs loading", () => {
    it("shows the skeleton while the standings query is in flight", () => {
      const wrapper = mountBoard([], 1, true);

      expect(wrapper.findAll(".skeleton-item")).toHaveLength(SLICE);
      expect(wrapper.find(".leaderboard-empty").exists()).toBe(false);
    });

    it("shows an empty state, not a skeleton, once the query settles empty", () => {
      const wrapper = mountBoard([], 1, false);

      expect(wrapper.findAll(".skeleton-item")).toHaveLength(0);
      expect(wrapper.find(".leaderboard-empty").text()).toContain(
        "No standings yet"
      );
    });

    it("gives the skeleton precedence over any rows already in the prop", () => {
      const wrapper = mountBoard(leaderboardOf(11), 4, true);

      expect(wrapper.findAll(".skeleton-item")).toHaveLength(SLICE);
      expect(wrapper.findAll(".player-item")).toHaveLength(0);
    });
  });
});
