import { Temporal } from "@js-temporal/polyfill";
import { GLOBAL_LEAGUE_ID, Team } from "../../../model";
import { DEFAULT_SCHEMA } from "../../../model/lineup";
import {
  isLeagueInactive,
  normalizeInvitationCode,
} from "../../../model/league";
import {
  TEAM_NAME_MAX_LENGTH,
  TEAM_NAME_MIN_LENGTH,
} from "../../../model/team";
import { TeamDTO } from "../../../dto/teamDTO";
import { TEAM_ERRORS, TeamRepository } from "../repositories/teamRepository";
import { TeamRepositoryD1 } from "../repositories/d1/teamRepositoryD1";
import { LeagueRepository } from "../repositories/leagueRepository";
import { LeagueRepositoryD1 } from "../repositories/d1/leagueRepositoryD1";
import { LineupRepository } from "../repositories/lineupRepository";
import { LineupRepositoryD1 } from "../repositories/d1/lineupRepositoryD1";
import { Result, failure, success } from "../repositories/result";

export type TeamServiceDeps = {
  teamRepository: TeamRepository;
  lineupRepository: LineupRepository;
  leagueRepository: LeagueRepository;
};

export class TeamService {
  private teamRepository: TeamRepository;
  private lineupRepository: LineupRepository;
  private leagueRepository: LeagueRepository;

  constructor(depsOrDb: TeamServiceDeps | D1Database) {
    const deps =
      "teamRepository" in depsOrDb
        ? depsOrDb
        : TeamService.d1Deps(depsOrDb as D1Database);
    this.teamRepository = deps.teamRepository;
    this.lineupRepository = deps.lineupRepository;
    this.leagueRepository = deps.leagueRepository;
  }

  private static d1Deps(db: D1Database): TeamServiceDeps {
    return {
      teamRepository: new TeamRepositoryD1(db),
      lineupRepository: new LineupRepositoryD1(db),
      leagueRepository: new LeagueRepositoryD1(db),
    };
  }

  /**
   * Join a league by naming a team in it.
   *
   * `invitationCode` is only consulted for a private league; a public one
   * ignores whatever is passed. The league's *visibility* rules are enforced by
   * the INSERT itself (see `TeamRepositoryD1.create`) — everything before it is
   * advisory, there to answer in words rather than to decide.
   *
   * Whether the league is still running is the one gate that is **not** in the
   * write, and deliberately. `isLeagueInactive` is a shared model function, and
   * moving it into the statement would mean respelling it as SQL — a second
   * copy of a rule `model/league.ts` states once, drifting the moment either
   * side changes. What that costs is a race no wider than a single request: a
   * player who submits as the admin closes the league gets in a moment late.
   * That is not the race the guarded INSERT exists for — an ungated *private*
   * league is a stranger in a league they were never invited to, whereas this
   * is one extra team in a league that has stopped scoring.
   */
  async createTeam(
    playerId: string,
    leagueId: string,
    name: string,
    invitationCode?: string,
  ): Promise<Result<Team>> {
    const trimmed = name.trim();

    if (
      trimmed.length < TEAM_NAME_MIN_LENGTH ||
      trimmed.length > TEAM_NAME_MAX_LENGTH
    ) {
      return failure(TEAM_ERRORS.NAME_LENGTH);
    }

    // Whether the season is still running. This one is *not* advisory, and it
    // is the only pre-check that is not: `endDate` is fixed when the league is
    // founded and never moves, so reading it and then writing is not a race,
    // and there is nothing for the INSERT to guard. Its sibling condition —
    // whether the admin has closed the league — can change under us, so that
    // one lives in the statement instead. `isLeagueInactive` states both halves
    // once (model/league.ts) and is what both paths ask.
    const leagueResult = await this.leagueRepository.getById(leagueId);
    if (!leagueResult.ok) {
      return leagueResult;
    }
    if (isLeagueInactive(leagueResult.value, Temporal.Now.instant())) {
      return failure(TEAM_ERRORS.LEAGUE_INACTIVE);
    }

    // Which of the three joins this is. `UNIQUE (playerId, leagueId)` gives a
    // player one row per league ever, so a returning player is not a second
    // row but the same one with `leftAt` cleared — and `getByPlayerAndLeague`
    // cannot see them, since hiding a departed team is its whole job. This
    // read is the only one that can, and it is what routes the three cases
    // apart. It is advisory, as ever: the write re-checks its own condition.
    const membershipResult = await this.teamRepository.getMembership(
      playerId,
      leagueId,
    );
    if (!membershipResult.ok) {
      return membershipResult;
    }
    const returning = membershipResult.value?.leftAt != null;
    if (membershipResult.value && !returning) {
      return failure(TEAM_ERRORS.ALREADY_HAS_TEAM);
    }

    // A returning player is allowed to collide with the name they themselves
    // left behind — that row is theirs, and is about to be theirs again.
    const existsResult = await this.teamRepository.existsByNameInLeague(
      trimmed,
      leagueId,
      returning ? playerId : undefined,
    );
    if (!existsResult.ok) {
      return existsResult;
    }
    if (existsResult.value) {
      return failure(TEAM_ERRORS.NAME_TAKEN);
    }

    const write = {
      name: trimmed,
      playerId,
      leagueId,
      invitationCode: invitationCode
        ? normalizeInvitationCode(invitationCode)
        : undefined,
    };
    const teamResult = returning
      ? await this.teamRepository.rejoin(write)
      : await this.teamRepository.create(write);
    if (!teamResult.ok) {
      return teamResult.error === TEAM_ERRORS.JOIN_CONFLICT
        ? this.joinRejection(playerId, leagueId)
        : teamResult;
    }

    // Only a new team needs one. A returning player's lineup row is still
    // there, with the formation they last set — resetting it to an empty
    // 4-3-3 would be the one thing about coming back that threw something
    // away.
    if (!returning) {
      const lineupResult = await this.lineupRepository.upsert({
        teamId: teamResult.value.id,
        schema: DEFAULT_SCHEMA,
        formation: "{}",
        updatedAt: new Date().toISOString(),
      });
      if (!lineupResult.ok) return lineupResult;
    }

    return teamResult;
  }

  /**
   * Name the reason the guarded INSERT turned a join down. It matched no row,
   * which means the league is not there, it is closed, this player already
   * holds a row in it, or its entry rules said no — re-reading is the only way
   * to tell, and it is why the repository returns a single sentinel instead of
   * guessing.
   *
   * The conditions are re-run in the statement's own order, and the last one is
   * reached by elimination: this service cannot compare the presented code
   * against the league's, because the code is a credential the repository is
   * the only reader of. If every other condition passes on the re-read, the
   * visibility gate is the one that rejected.
   */
  private async joinRejection(
    playerId: string,
    leagueId: string,
  ): Promise<Result<never>> {
    const leagueResult = await this.leagueRepository.getById(leagueId);
    if (!leagueResult.ok) {
      // Includes LEAGUE_ERRORS.NOT_FOUND, which is the honest answer for a
      // league id that does not exist. Before the gate this silently attempted
      // an insert and surfaced a foreign-key failure as a 400.
      return leagueResult;
    }
    // Closed while the caller was filling in the form — the case the statement
    // guards and this re-read names.
    if (isLeagueInactive(leagueResult.value, Temporal.Now.instant())) {
      return failure(TEAM_ERRORS.LEAGUE_INACTIVE);
    }

    const membershipResult = await this.teamRepository.getMembership(
      playerId,
      leagueId,
    );
    if (!membershipResult.ok) {
      return membershipResult;
    }
    // A row they still hold: they got in between the pre-check and the write.
    // A row they *left* is not a refusal — the rejoin path exists for it, and
    // its own rejection means one of the conditions below turned it down — so
    // it falls through rather than being named here.
    if (membershipResult.value && membershipResult.value.leftAt === null) {
      return failure(TEAM_ERRORS.ALREADY_HAS_TEAM);
    }

    return failure(TEAM_ERRORS.LEAGUE_IS_PRIVATE);
  }

  /**
   * Leave a league: the player stops playing it, and nothing is erased.
   *
   * Their team keeps its name, its contracts and its place in the standings —
   * a season they played is a fact about the league, not a possession they take
   * with them (docs/domain/league-lifecycle.md). What changes is that
   * `getByPlayerAndLeague` stops answering with it, which is what closes the
   * market, the lineup and every other self-scoped surface behind them.
   *
   * Final: `UNIQUE (playerId, leagueId)` means the row they left is the only
   * one they will ever have here, and the join gate refuses it rather than
   * un-stamping the departure.
   */
  async leaveLeague(playerId: string, leagueId: string): Promise<Result<void>> {
    // The immutable half of inactivity, for the reason given in `createTeam`:
    // an ended season is not something the UPDATE can be made to notice, since
    // nothing about it can change while the statement runs.
    const leagueResult = await this.leagueRepository.getById(leagueId);
    if (!leagueResult.ok) {
      return leagueResult;
    }
    if (isLeagueInactive(leagueResult.value, Temporal.Now.instant())) {
      return failure(TEAM_ERRORS.LEAGUE_INACTIVE);
    }

    const result = await this.teamRepository.leave(
      playerId,
      leagueId,
      Temporal.Now.instant(),
    );
    if (!result.ok && result.error === TEAM_ERRORS.LEAVE_CONFLICT) {
      return this.leaveRejection(playerId, leagueId);
    }
    return result;
  }

  /**
   * Name the reason the guarded UPDATE turned a departure down — the same
   * protocol as {@link joinRejection}, and here it is complete: every condition
   * in that statement is one this service can re-read, so a caller is never
   * left with the bare sentinel.
   *
   * Membership is asked first because "you have no team here" is the more
   * useful answer than anything about the league to someone who was never in
   * it.
   */
  private async leaveRejection(
    playerId: string,
    leagueId: string,
  ): Promise<Result<never>> {
    const membershipResult = await this.teamRepository.getMembership(
      playerId,
      leagueId,
    );
    if (!membershipResult.ok) {
      return membershipResult;
    }
    if (membershipResult.value === null) {
      return failure(TEAM_ERRORS.NO_TEAM_IN_LEAGUE);
    }
    if (membershipResult.value.leftAt) {
      return failure(TEAM_ERRORS.ALREADY_LEFT);
    }

    if (leagueId === GLOBAL_LEAGUE_ID) {
      return failure(TEAM_ERRORS.CANNOT_LEAVE_GLOBAL);
    }

    const leagueResult = await this.leagueRepository.getById(leagueId);
    if (!leagueResult.ok) {
      return leagueResult;
    }
    if (leagueResult.value.adminId === playerId) {
      return failure(TEAM_ERRORS.ADMIN_CANNOT_LEAVE);
    }
    // A close that landed between this request's pre-check and its write.
    if (isLeagueInactive(leagueResult.value, Temporal.Now.instant())) {
      return failure(TEAM_ERRORS.LEAGUE_INACTIVE);
    }

    // No rule accounts for it. Passing the sentinel through says so honestly
    // rather than inventing a reason the caller could act on.
    return failure(TEAM_ERRORS.LEAVE_CONFLICT);
  }

  async getMyTeam(
    playerId: string,
    leagueId: string,
    playerName: string,
  ): Promise<Result<TeamDTO | null>> {
    const result = await this.teamRepository.getByPlayerAndLeague(
      playerId,
      leagueId,
    );
    if (!result.ok) {
      return result;
    }
    if (result.value === null) {
      return success(null);
    }
    const team: Team = result.value;
    return success({
      id: team.id,
      name: team.name,
      credits: team.credits,
      player: { id: playerId, name: playerName },
    });
  }
}
