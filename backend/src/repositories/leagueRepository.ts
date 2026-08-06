import { League } from "../../../model";
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

export interface LeagueRepository {
  getById(id: string): Promise<Result<League>>;
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
