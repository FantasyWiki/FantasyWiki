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
}
