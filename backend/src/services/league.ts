import { Temporal } from "@js-temporal/polyfill";
import { GLOBAL_LEAGUE_ID, League } from "../../../model";
import {
  CreateLeagueRequest,
  LeagueDTO,
  LeagueInviteDTO,
  LeagueRoleDTO,
} from "../../../dto/leagueDTO";
import {
  Domain,
  LeagueInvitePolicy,
  LeagueVisibility,
  isLeagueInvitePolicy,
  isLeagueVisibility,
} from "../../../model/enums";
import {
  LEAGUE_NAME_MAX_LENGTH,
  LEAGUE_NAME_MIN_LENGTH,
  isInvitationCode,
  isLeagueDomain,
  isLeagueDuration,
  isLeagueIcon,
  isLeagueName,
  leagueEndDate,
  normalizeInvitationCode,
} from "../../../model/league";
import {
  TEAM_NAME_MAX_LENGTH,
  TEAM_NAME_MIN_LENGTH,
  isTeamName,
} from "../../../model/team";
import {
  LEAGUE_ERRORS,
  LeagueRepository,
} from "../repositories/leagueRepository";
import { LeagueRepositoryD1 } from "../repositories/d1/leagueRepositoryD1";
import { Result, failure, success } from "../repositories/result";
import { withUniqueInvitationCode } from "./invitationCode";

/**
 * Why a league-creation payload was turned down.
 *
 * Owned by this module rather than by `LEAGUE_ERRORS`, which belongs to the
 * repository: the producer of a rejection owns its constant
 * (docs/architecture/backend-error-constants.md §1), and nothing in the
 * repository can tell a badly-shaped request from a good one. Same arrangement
 * as `LINEUP_ERRORS` beside `parseLineupPayload`.
 */
export const LEAGUE_CREATION_ERRORS = {
  INVALID_PAYLOAD: "Invalid league payload",
  NAME_LENGTH: `League name must be between ${LEAGUE_NAME_MIN_LENGTH} and ${LEAGUE_NAME_MAX_LENGTH} characters`,
  UNKNOWN_ICON: "Unknown league icon",
  UNKNOWN_DOMAIN: "Unsupported Wikipedia edition",
  UNKNOWN_DURATION: "Unknown league duration",
  UNKNOWN_VISIBILITY: "Unknown league visibility",
  UNKNOWN_INVITE_POLICY: "Unknown invite policy",
  TEAM_NAME_LENGTH: `Team name must be between ${TEAM_NAME_MIN_LENGTH} and ${TEAM_NAME_MAX_LENGTH} characters`,
} as const;

export type LeagueCreationError =
  (typeof LEAGUE_CREATION_ERRORS)[keyof typeof LEAGUE_CREATION_ERRORS];

/**
 * How many public leagues the featured section asks for. A browsable, searchable
 * list is its own job (#5); this is a shelf, and a shelf has an end.
 */
export const PUBLIC_LEAGUES_LIMIT = 12;

/**
 * Validate an untrusted body into a {@link CreateLeagueRequest}.
 *
 * Every field is checked against the shared model rather than against a rule
 * restated here, so the form that offers the choices and the endpoint that
 * accepts them cannot drift: same icon palette, same durations, same editions
 * (#531 will widen that last one), same name bounds.
 */
export function parseCreateLeaguePayload(
  body: unknown,
): Result<CreateLeagueRequest> {
  if (typeof body !== "object" || body === null) {
    return failure(LEAGUE_CREATION_ERRORS.INVALID_PAYLOAD);
  }
  const { name, icon, domain, duration, visibility, invitePolicy, teamName } =
    body as Record<string, unknown>;

  if (typeof name !== "string" || !isLeagueName(name)) {
    return failure(LEAGUE_CREATION_ERRORS.NAME_LENGTH);
  }
  if (!isLeagueIcon(icon)) {
    return failure(LEAGUE_CREATION_ERRORS.UNKNOWN_ICON);
  }
  if (!isLeagueDomain(domain)) {
    return failure(LEAGUE_CREATION_ERRORS.UNKNOWN_DOMAIN);
  }
  if (!isLeagueDuration(duration)) {
    return failure(LEAGUE_CREATION_ERRORS.UNKNOWN_DURATION);
  }
  if (!isLeagueVisibility(visibility)) {
    return failure(LEAGUE_CREATION_ERRORS.UNKNOWN_VISIBILITY);
  }
  // Checked even for a public league, where it decides nothing today: an
  // absent value read back out of the database would fail closed to `admin`
  // (see `toLeague`), so a league that went private later would silently have
  // a policy nobody chose.
  if (!isLeagueInvitePolicy(invitePolicy)) {
    return failure(LEAGUE_CREATION_ERRORS.UNKNOWN_INVITE_POLICY);
  }
  if (typeof teamName !== "string" || !isTeamName(teamName)) {
    return failure(LEAGUE_CREATION_ERRORS.TEAM_NAME_LENGTH);
  }

  return success({
    name: name.trim(),
    icon,
    domain,
    duration,
    visibility,
    invitePolicy,
    teamName: teamName.trim(),
  });
}

// Re-exported for existing importers; the source of truth lives in the shared
// model so the frontend can reason about the same league without duplicating
// the id.
export { GLOBAL_LEAGUE_ID };

/**
 * Map a domain League and the size of its field to the LeagueDTO the API
 * returns. The count is passed in rather than read off the league because it
 * is derived from the `teams` table — `model/League` says what a league is,
 * not how many have joined it.
 */
export function toLeagueDTO(league: League, teamCount: number): LeagueDTO {
  return {
    id: league.id,
    title: league.name,
    domain: league.domain as Domain,
    icon: league.icon,
    startDate: league.startDate,
    endDate: league.endDate,
    visibility: league.visibility,
    teamCount,
    closedAt: league.closedAt,
  };
}

export class LeagueService {
  private repository: LeagueRepository;

  constructor(repositoryOrDb: LeagueRepository | D1Database) {
    if ("getById" in repositoryOrDb) {
      this.repository = repositoryOrDb;
      return;
    }
    this.repository = new LeagueRepositoryD1(repositoryOrDb);
  }

  async getGlobalLeague(): Promise<Result<LeagueDTO>> {
    return this.getLeagueById(GLOBAL_LEAGUE_ID);
  }

  /**
   * A single league by id, for the surfaces that name one in their URL — the
   * league page and the join-a-further-league form — rather than reading the
   * player's selection.
   *
   * Deliberately not membership-scoped, and that stays true now that leagues
   * can be private: the id lets you *read* a league, the invitation code lets
   * you *join* one. Someone handed an invite link should be able to see the
   * league's standings and dates before committing to it, and the standings
   * are already served unscoped by `/:id/leaderboard` anyway. What the id no
   * longer is — as this comment used to claim — is the invite itself.
   */
  async getLeagueById(id: string): Promise<Result<LeagueDTO>> {
    const result = await this.repository.getById(id);
    if (!result.ok) {
      return result;
    }
    const counts = await this.repository.countTeamsByLeague([id]);
    if (!counts.ok) {
      return counts;
    }
    return success(toLeagueDTO(result.value, counts.value[id] ?? 0));
  }

  /**
   * Public leagues, for the section that offers somewhere else to play.
   *
   * Unscoped, like every other league read: it answers the same list for
   * everyone, and the caller's own leagues are dropped by the surface that
   * renders it rather than by the query. That keeps this cacheable and keeps
   * "which leagues am I in" one question, asked in one place.
   */
  async getPublicLeagues(
    limit: number = PUBLIC_LEAGUES_LIMIT,
  ): Promise<Result<LeagueDTO[]>> {
    const result = await this.repository.listPublic(limit);
    if (!result.ok) {
      return result;
    }
    return this.toLeagueDTOs(result.value);
  }

  /**
   * Found a league, with the caller as its admin and its first team.
   *
   * The season starts now and runs for the requested length — the client names
   * a duration, never an end date, so it cannot name one in the past.
   *
   * Only a private league is issued an invitation code, and it is drawn through
   * `withUniqueInvitationCode`, which redraws if the unique index rejects it.
   * A public league is written with `null`: a code guarding a league anyone can
   * join guards nothing (docs/domain/league-visibility.md).
   *
   * The code is not returned. `GET /leagues/:id/invite-code` is the one
   * endpoint that serves one, and the founder now passes its membership check
   * — keeping that true of *every* response is what makes the rule in ADR 0008
   * §2 something a test can pin rather than a habit.
   */
  async createLeague(
    playerId: string,
    request: CreateLeagueRequest,
  ): Promise<Result<LeagueDTO>> {
    const startDate = Temporal.Now.instant();
    const write = (invitationCode: string | null) =>
      this.repository.createWithFoundingTeam(
        {
          name: request.name,
          adminId: playerId,
          startDate,
          endDate: leagueEndDate(startDate, request.duration),
          domain: request.domain,
          visibility: request.visibility,
          invitePolicy: request.invitePolicy,
          icon: request.icon,
          invitationCode,
        },
        request.teamName,
      );

    const result =
      request.visibility === LeagueVisibility.PRIVATE
        ? await withUniqueInvitationCode(write)
        : await write(null);
    if (!result.ok) {
      return result;
    }

    // Exactly one team: the founder's, written in the same transaction. No
    // count query can say anything this does not already know.
    return success(toLeagueDTO(result.value.league, 1));
  }

  /**
   * A league's invitation code, for a caller allowed to hand it out.
   *
   * The rule is the league's own `invitePolicy`: under `members` anyone
   * fielding a team can invite, under `admin` only the league's admin can.
   * A caller who fails it gets the same answer as a caller asking about a
   * league that is not there — `api-naming-rules.md` §5 leaves the choice of
   * 403 vs 404 to how much you want to reveal, and revealing that a code
   * exists to be guessed at is exactly what this endpoint should not do.
   */
  async getInvitationCode(
    playerId: string,
    leagueId: string,
    isMember: boolean,
  ): Promise<Result<LeagueInviteDTO>> {
    const leagueResult = await this.repository.getById(leagueId);
    if (!leagueResult.ok) {
      return leagueResult;
    }
    const league = leagueResult.value;

    const allowed =
      league.invitePolicy === LeagueInvitePolicy.MEMBERS
        ? isMember
        : league.adminId === playerId;
    if (!allowed) {
      return failure(LEAGUE_ERRORS.NOT_FOUND);
    }

    const codeResult = await this.repository.getInvitationCode(leagueId);
    if (!codeResult.ok) {
      return codeResult;
    }
    if (codeResult.value === null) {
      // A league predating the creation path that issues codes. Nothing to
      // hand out, and inventing one here would be a write hiding in a read.
      return failure(LEAGUE_ERRORS.NO_INVITATION_CODE);
    }
    return success({ code: codeResult.value });
  }

  /**
   * Dress a set of leagues the caller already holds — the player's own, which
   * `PlayerService` resolves — as DTOs. The counts are fetched for the whole
   * set in one read, which is the reason this takes a list rather than being
   * called once per league.
   */
  async toLeagueDTOs(leagues: League[]): Promise<Result<LeagueDTO[]>> {
    const counts = await this.repository.countTeamsByLeague(
      leagues.map((l) => l.id),
    );
    if (!counts.ok) {
      return counts;
    }
    return success(
      leagues.map((league) =>
        toLeagueDTO(league, counts.value[league.id] ?? 0),
      ),
    );
  }

  /**
   * The league an invitation code opens — the preview a player gets *before*
   * committing, so an invitation is something you can look at rather than a
   * button you press in the dark. It is the same `LeagueDTO` `getLeagueById`
   * serves, reached by a different key.
   *
   * **Every way of failing answers `LEAGUE_ERRORS.NOT_FOUND`, and that is the
   * point.** A code that is the wrong shape, a code no league carries, and a
   * league that vanished between the two reads are indistinguishable from each
   * other and from a league id that does not exist. ADR 0008 §3 refuses to
   * separate "code missing" from "code wrong" on the join path for exactly this
   * reason, and a preview endpoint that separated them would hand back the
   * oracle the join path declines to be: "wrong shape" vs "right shape, no
   * league" tells a guesser their generator is aimed correctly.
   *
   * `isInvitationCode` is checked here rather than trusted from the client, and
   * it is the *shared* predicate — the same one the form uses — so a malformed
   * code costs no query at all. It is a cheap rejection, not a different one.
   *
   * What this deliberately does **not** check is whether the league is still
   * running. An ended league resolves normally, carrying the `endDate` and
   * `closedAt` that say so, and the surface showing the preview reaches the
   * same verdict through `isLeagueInactive`. Refusing here would leave someone
   * holding a real invitation staring at "no such code".
   */
  async getLeagueByInvitationCode(rawCode: string): Promise<Result<LeagueDTO>> {
    // Normalized in the service, exactly where `TeamService.createTeam`
    // normalizes the code it is handed, so the two paths cannot come to
    // different conclusions about what " zk7-qw " is.
    const code = normalizeInvitationCode(rawCode);
    if (!isInvitationCode(code)) {
      return failure(LEAGUE_ERRORS.NOT_FOUND);
    }

    const idResult = await this.repository.findIdByInvitationCode(code);
    if (!idResult.ok) {
      // A D1 outage, which is ours: passed through so the route answers 500
      // rather than telling the player their invitation is bad.
      return idResult;
    }
    if (idResult.value === null) {
      return failure(LEAGUE_ERRORS.NOT_FOUND);
    }

    return this.getLeagueById(idResult.value);
  }

  /**
   * Close a league early, on its admin's say-so.
   *
   * This is what the product calls deleting a league, and it deletes nothing:
   * the league, its teams, their contracts and the final table all stay exactly
   * where they are, and the page that showed them keeps working. Only the way
   * back into play is shut (docs/domain/league-lifecycle.md).
   *
   * The admin rule is enforced inside the `UPDATE`, so this method does no
   * permission check of its own before the write — see
   * `LeagueRepository.close`. On rejection it re-reads to say which of the
   * statement's conditions refused.
   */
  async closeLeague(
    playerId: string,
    leagueId: string,
  ): Promise<Result<LeagueDTO>> {
    const closeResult = await this.repository.close(
      leagueId,
      playerId,
      Temporal.Now.instant(),
    );
    if (!closeResult.ok) {
      if (closeResult.error !== LEAGUE_ERRORS.CLOSE_CONFLICT) {
        return closeResult; // a real persistence failure — pass it through
      }
      return this.closeRejection(playerId, leagueId);
    }

    // Read back rather than patching a league object together here: the caller
    // gets the same shape `GET /leagues/:id` serves, closure included, so the
    // page it came from can simply replace what it holds.
    return this.getLeagueById(leagueId);
  }

  /**
   * Where a caller stands in a league — member, admin, both or neither.
   *
   * `isMember` is passed in rather than read here because the route already
   * has it: the same `getMyTeam` call every other league-scoped endpoint makes,
   * and the same arrangement as `getInvitationCode` above.
   *
   * Nothing here is a permission check. It answers what a caller *is*, so the
   * page can offer the two actions that apply to them; whether either is
   * allowed is settled again, for real, inside the write.
   */
  async getMyRole(
    playerId: string,
    leagueId: string,
    isMember: boolean,
  ): Promise<Result<LeagueRoleDTO>> {
    const leagueResult = await this.repository.getById(leagueId);
    if (!leagueResult.ok) {
      return leagueResult;
    }
    return success({
      isMember,
      isAdmin: leagueResult.value.adminId === playerId,
    });
  }

  /**
   * Name the reason the guarded close matched no row. Three conditions, three
   * answers, re-read in the statement's own order — and the sentinel passes
   * through if somehow none of them explains it, rather than a guess.
   */
  private async closeRejection(
    playerId: string,
    leagueId: string,
  ): Promise<Result<never>> {
    const leagueResult = await this.repository.getById(leagueId);
    if (!leagueResult.ok) {
      return leagueResult; // LEAGUE_ERRORS.NOT_FOUND, honestly
    }
    const league = leagueResult.value;

    if (league.adminId !== playerId) {
      return failure(LEAGUE_CLOSURE_ERRORS.NOT_ADMIN);
    }
    if (league.closedAt !== null) {
      return failure(LEAGUE_CLOSURE_ERRORS.ALREADY_CLOSED);
    }
    return failure(LEAGUE_ERRORS.CLOSE_CONFLICT);
  }
}

/**
 * Why a close was refused, once the write has been re-read to find out.
 *
 * Owned here rather than by `LEAGUE_ERRORS` because this service is what
 * produces them: the repository returns one sentinel and deliberately knows
 * nothing more (docs/architecture/backend-error-constants.md §1). Same
 * arrangement as `LEAGUE_CREATION_ERRORS` above.
 *
 * `ALREADY_CLOSED` rather than a silent second success, because `closedAt`
 * records *when* a season stopped. Letting a repeat close through would either
 * overwrite that moment — rewriting the one fact the column exists to keep — or
 * report a close that never happened. Neither is worth sparing an admin an
 * error they can only reach by acting on a stale page.
 */
export const LEAGUE_CLOSURE_ERRORS = {
  NOT_ADMIN: "Only the league admin can close this league",
  ALREADY_CLOSED: "This league is already closed",
} as const;

export type LeagueClosureError =
  (typeof LEAGUE_CLOSURE_ERRORS)[keyof typeof LEAGUE_CLOSURE_ERRORS];
