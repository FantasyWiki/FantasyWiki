import { Temporal } from "@js-temporal/polyfill";
import { Team } from "../../../model";
import { Result } from "./result";

export const TEAM_ERRORS = {
  /**
   * `getByPlayerAndLeague` returned null: the player has no team in this
   * league. Every self-scoped feature (contracts, lineup, ...) hits the same
   * wall, so they all surface this one message rather than each writing their
   * own — routes compare against it by identity to answer 404.
   */
  NO_TEAM_IN_LEAGUE: "No team found for this league",

  // The four ways `createTeam` can refuse. These were free text until the join
  // gate arrived: the route mapped every failure to 400, which was survivable
  // while every failure really was the client's fault. A permission refusal is
  // a 403 and a missing league a 404, and a status map cannot be built out of
  // message content (docs/architecture/backend-error-constants.md).
  NAME_LENGTH: "Team name must be between 3 and 30 characters.",
  NAME_TAKEN:
    "This team name is already taken in this league. Please choose another.",
  ALREADY_HAS_TEAM: "You already have a team in this league.",
  /**
   * The league is private and the caller offered no invitation code, or the
   * wrong one. Deliberately one error rather than "code required" and "code
   * wrong": telling a stranger which of the two it was tells them whether a
   * code they hold is close.
   */
  LEAGUE_IS_PRIVATE: "This league is private. An invitation code is required.",
  /**
   * The league's season is over, or its admin closed it early — `isLeagueInactive`
   * in model/league.ts is the rule, and it is not restated anywhere else.
   *
   * One error covering both halves, and both directions: there is no longer a
   * league here to walk into or out of, so the joiner and the leaver are told
   * the same thing.
   *
   * Its own error rather than folded into `LEAGUE_IS_PRIVATE` or a 404, because
   * it is the one join refusal that is *not* about the caller: a valid code is
   * turned away by it too, and telling someone their invitation is fine but the
   * season ended is the difference between a dead link and an explanation.
   * Nothing is hidden by saying so — the league page, its standings and its end
   * date are already readable by anyone with the id
   * (docs/domain/league-visibility.md).
   */
  LEAGUE_INACTIVE: "This league is no longer running.",
  /**
   * The guarded INSERT rejected the join. The write cannot know *which* of its
   * conditions failed and must not guess — `TeamService` re-reads to name the
   * cause, the same protocol as `CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT`.
   */
  JOIN_CONFLICT: "Join conditions no longer hold",

  // The ways leaving a league can be refused. See
  // docs/domain/league-lifecycle.md for the rules these name; this file only
  // owns the wording. Leaving an inactive league is refused by
  // `LEAGUE_INACTIVE` above, which serves both directions.
  /** Leaving twice. The first departure is the one that is on the record. */
  ALREADY_LEFT: "You have already left this league.",
  /**
   * The Global League is the one league every player is enrolled in, and the
   * one the first run puts them in. Leaving it would strand them: the app would
   * route them to create the team the join gate then refuses.
   */
  CANNOT_LEAVE_GLOBAL: "The Global League cannot be left.",
  /**
   * The guarded leave `UPDATE` matched no row. Same protocol as
   * `JOIN_CONFLICT`: the write knows only that some condition failed, and
   * `TeamService` re-reads to name which.
   */
  LEAVE_CONFLICT: "Leave conditions no longer hold",
} as const;

export type TeamError = (typeof TEAM_ERRORS)[keyof typeof TEAM_ERRORS];

/**
 * A player's membership row in a league, whether or not they still play it —
 * the audit view that `getByPlayerAndLeague` deliberately does not give.
 */
export interface TeamMembership {
  teamId: string;
  /** When they walked away, or `null` while they are still in the league. */
  leftAt: Temporal.Instant | null;
}

/**
 * What a departure left behind. Only the one fact the caller cannot work out
 * for itself: a league that no longer exists cannot be re-read to discover it
 * is gone, so the write has to say so on the way out.
 */
export interface LeaveOutcome {
  leagueDeleted: boolean;
}

export interface TeamRepository {
  /**
   * credits is not a param: a brand-new team has zero contracts, so its
   * derived credits is trivially STARTING_CREDITS.
   *
   * `invitationCode` is the code the joiner presented, if any. The league's
   * own rules — public, or private and this code matches — are evaluated
   * *inside* the INSERT rather than checked first, because D1 has no
   * interactive transactions and a check followed by a write is a race.
   * Rejection surfaces as `TEAM_ERRORS.JOIN_CONFLICT`.
   *
   * The league's **admin is not a third way in**, and wants none: founding a
   * league writes its founder's team in the same transaction, so an admin is
   * already a member by construction and never joins. If they leave,
   * {@link leave} hands the league on before they can come back, so a founder
   * returning to their own private league is asked for its code like anybody
   * else (docs/domain/league-visibility.md).
   *
   * Two further conditions ride in the same statement: the league is not
   * closed, and this player holds no row here already. A player who *left* does
   * hold one, and comes back through {@link rejoin} instead — this is the path
   * for someone who has never played here.
   */
  create(team: {
    name: string;
    playerId: string;
    leagueId: string;
    invitationCode?: string;
  }): Promise<Result<Team>>;
  /**
   * Clear `leftAt`, putting a departed player back in the league they left.
   *
   * The same row, so the same team: its contracts, its ledger and its place in
   * the standings are all still attached, which is what coming back means here
   * — there is no second row to create, and `UNIQUE (playerId, leagueId)` would
   * refuse one anyway. Only the name is rewritten, since the player fills the
   * join form in again.
   *
   * Guarded like {@link create} and for the same reason: they really did leave,
   * the league is not closed, and its entry rules admit them — a player who
   * left a league that has since gone private needs the code like anyone else,
   * and so does the founder of a private league they walked out of, since
   * leaving handed the adminship on.
   * Rejection surfaces as `TEAM_ERRORS.JOIN_CONFLICT`, classified by the same
   * re-read.
   */
  rejoin(team: {
    name: string;
    playerId: string;
    leagueId: string;
    invitationCode?: string;
  }): Promise<Result<Team>>;
  /**
   * Whether another team in this league already answers to this name.
   *
   * `exceptPlayerId` excludes one player's own row, for the returning player
   * who types the name they had: their departed team is still in the table, and
   * without this it would collide with itself.
   */
  existsByNameInLeague(
    name: string,
    leagueId: string,
    exceptPlayerId?: string,
  ): Promise<Result<boolean>>;
  /**
   * The player's team in this league, or null.
   *
   * "Their team" means the one they are *currently* playing: a team whose
   * player has left answers null, which is what makes every self-scoped
   * feature — contracts, lineup, the market, the invite-code membership check —
   * close behind them without any of them having to know that leaving exists.
   * The record of the team itself is untouched; see {@link getMembership} for
   * the read that can still see it.
   */
  getByPlayerAndLeague(
    playerId: string,
    leagueId: string,
  ): Promise<Result<Team | null>>;
  /**
   * Whether this player has ever fielded a team in this league, and whether
   * they have since left it.
   *
   * `UNIQUE (playerId, leagueId)` means "ever" is the question the join has to
   * ask — one player gets one row per league for good — so this is what routes
   * a joiner: no row is a {@link create}, a row they left is a {@link rejoin},
   * and a row they still hold is `ALREADY_HAS_TEAM`.
   */
  getMembership(
    playerId: string,
    leagueId: string,
  ): Promise<Result<TeamMembership | null>>;
  /**
   * End the player's part in the league, and settle what that leaves behind.
   *
   * Three things happen together, as one transaction:
   *
   *  1. `leftAt` is stamped on their team. The row survives, contracts and all,
   *     so the season stays readable exactly as it was played.
   *  2. If they were the admin, the league passes to the longest-standing
   *     member still in it. Nobody may be left holding a league its admin has
   *     walked out of, since only an admin can close one.
   *  3. If they were the *last* member, the league is deleted outright, and its
   *     teams, contracts, performances, lineups and notifications cascade with
   *     it. The single exception to "nothing is ever deleted", and the reason
   *     is that the exception is not one: an audit trail is reached through a
   *     league, so a league nobody is in cannot be read back by anyone.
   *
   * Whether the leave is *allowed* is decided inside the write — they still
   * have a team here, they have not already left, the league is neither the
   * Global League nor closed — because a check followed by a write would let a
   * second request stamp a second departure, or let a player leave a league in
   * the moment its admin was closing it. Rejection surfaces as
   * `TEAM_ERRORS.LEAVE_CONFLICT`.
   *
   * `teamId` is passed rather than looked up here so steps 2 and 3 can be
   * conditioned on this exact departure having been written — without that, a
   * refused second departure would be read as the one that emptied the league,
   * and step 3 would delete it. That state is unreachable by construction: step
   * 3 is itself why a memberless league never stands, since the last member's
   * departure takes the league with it. The conditioning is kept regardless,
   * for the day something else leaves one standing; the implementation says so
   * at length. See docs/domain/league-lifecycle.md for the rules.
   */
  leave(departure: {
    teamId: string;
    playerId: string;
    leagueId: string;
    leftAt: Temporal.Instant;
  }): Promise<Result<LeaveOutcome>>;
  /**
   * The team a league contains under this id, or null.
   *
   * The league is part of the key, not a redundant filter: this serves reads
   * addressed by team id from a league context, so a team belonging to another
   * league must be indistinguishable from one that does not exist (null), never
   * a row from outside the league the caller asked about.
   */
  getByIdAndLeague(
    teamId: string,
    leagueId: string,
  ): Promise<Result<Team | null>>;
}
