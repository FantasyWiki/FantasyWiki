import { Temporal } from "@js-temporal/polyfill";
import { League, Team } from "../../../model";
import { LeagueInvitePolicy, LeagueVisibility } from "../../../model/enums";
import { Result } from "./result";

export const LEAGUE_ERRORS = {
  NOT_FOUND: "League not found",
  /**
   * A write lost the race on `idx_leagues_invitationCode`. Classified inside
   * the repository so no caller ever branches on SQLite's own wording — the
   * same arrangement as `PLAYER_ERRORS.USERNAME_TAKEN`. Callers are expected
   * to draw another code and try again; see `withUniqueInvitationCode`.
   */
  INVITATION_CODE_TAKEN: "Invitation code already taken",
  /**
   * Every code drawn collided. With 24.3 million codes this means something is
   * wrong (a stuck RNG, a duplicated index) rather than bad luck, so it is a
   * failure rather than a longer loop.
   */
  INVITATION_CODE_UNAVAILABLE: "Could not allocate a free invitation code",
  /**
   * The league exists but carries no code — it predates the creation path that
   * issues them. Distinct from NOT_FOUND so the caller is not told the league
   * is missing when it is only uninvitable.
   */
  NO_INVITATION_CODE: "This league has no invitation code",
  /**
   * The guarded close `UPDATE` matched no row. Three conditions ride in that
   * statement — the league exists, the caller is its admin, it is not already
   * closed — and at write time it cannot know which of them failed, so it
   * returns this one sentinel rather than guessing. `LeagueService` re-reads to
   * name the cause, the same protocol as `TEAM_ERRORS.JOIN_CONFLICT` and
   * `CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT`.
   */
  CLOSE_CONFLICT: "Close conditions no longer hold",
} as const;

/**
 * A league as it is about to be written: everything `League` has except the id,
 * which the repository mints, plus the invitation code `League` deliberately
 * does not carry. `null` for a public league, which has nothing to guard.
 */
export interface NewLeague {
  name: string;
  adminId: string;
  startDate: Temporal.Instant;
  endDate: Temporal.Instant;
  domain: string;
  visibility: LeagueVisibility;
  invitePolicy: LeagueInvitePolicy;
  icon: string;
  invitationCode: string | null;
}

export interface LeagueRepository {
  getById(id: string): Promise<Result<League>>;
  /**
   * Public leagues, newest first, for the section that offers a player
   * somewhere else to play.
   *
   * Deliberately not scoped to the caller: it returns every public league,
   * including ones they already field a team in, and the surface that renders
   * it drops those. Keeping the read player-agnostic is what lets it be the
   * same answer for everyone — and a private league is absent for the reason
   * it is private, not as a filter that could be turned off.
   */
  listPublic(limit: number): Promise<Result<League[]>>;
  /**
   * Write a league and the team its founder plays it with, as one transaction.
   *
   * The founding team is not a separate call because a league with nobody in it
   * is not a state this product has a word for: `GET /leagues` lists the
   * leagues a player fields a team in, so a league written without its founder
   * would be invisible to everyone — and if it were private it would hold an
   * invitation code nobody could ever reach. Two writes could leave exactly
   * that behind; one transaction cannot.
   *
   * Returns `LEAGUE_ERRORS.INVITATION_CODE_TAKEN` when the code it was handed
   * lost the race on `idx_leagues_invitationCode`, which is the signal
   * `withUniqueInvitationCode` redraws on.
   */
  createWithFoundingTeam(
    league: NewLeague,
    foundingTeamName: string,
  ): Promise<Result<{ league: League; team: Team }>>;
  /**
   * A league's invitation code, or `null` for a league that has none.
   *
   * Separate from `getById` on purpose: the code is a credential, and every
   * other league read exists to answer something else (which domain, which
   * dates). Keeping it off `League` means no future DTO mapper can leak it by
   * spreading a league it was handed for another reason.
   */
  getInvitationCode(leagueId: string): Promise<Result<string | null>>;
  /**
   * The id of the league a code opens, or `null` for a code that opens none.
   *
   * The inverse of `getInvitationCode`, and deliberately as narrow: it answers
   * with an *id*, not a league, so the caller has to go through the ordinary
   * unscoped read to say anything about it. That keeps one shape — `League`,
   * which carries no code — as the only thing a code can be turned into, and
   * leaves this the single query in the repository that reads the column
   * without being handed the league it belongs to.
   *
   * `null` rather than a failure: "no league has this code" is an ordinary
   * answer on a path whose whole job is to be asked about codes that may not
   * exist. Naming it a failure here would push the caller into telling a
   * missing league apart from a wrong code, which is exactly the distinction
   * ADR 0008 refuses to draw.
   *
   * The code must already be normalized — the comparison is a plain `=` on the
   * stored uppercase form. A codeless league can never match: SQL's `NULL` is
   * equal to nothing, the empty string included.
   */
  findIdByInvitationCode(code: string): Promise<Result<string | null>>;
  /**
   * How many teams play each of the given leagues, keyed by league id; a
   * league with no teams maps to 0 rather than being absent.
   *
   * Its own read rather than a column on `getById`, because the count is a
   * derived number that only the surfaces rendering a `LeagueDTO` care about,
   * whereas `getById` is what five services call to find a league's domain.
   * Taking the ids in bulk is what keeps the league list to one query instead
   * of one per league.
   */
  countTeamsByLeague(
    leagueIds: readonly string[],
  ): Promise<Result<Record<string, number>>>;
  /**
   * Stamp `closedAt` on a league, ending it before its season runs out.
   *
   * Nothing is deleted — the league, its teams and their whole ledger stay
   * exactly as they are (docs/domain/league-lifecycle.md). All this does is
   * shut the door.
   *
   * Both conditions are evaluated *inside* the `UPDATE`: that only
   * `leagues.adminId` may close a league, and that a league closes once. A
   * service-side check followed by a write would be a race on the second one —
   * two concurrent closes would both read `closedAt IS NULL` and the later
   * write would overwrite the moment the season actually stopped, which is the
   * one fact this column exists to record. Rejection surfaces as
   * `LEAGUE_ERRORS.CLOSE_CONFLICT`.
   */
  close(
    leagueId: string,
    adminId: string,
    closedAt: Temporal.Instant,
  ): Promise<Result<void>>;
}
