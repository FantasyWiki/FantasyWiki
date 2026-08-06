import { Team } from "../../../../model";
import { LeagueVisibility } from "../../../../model/enums";
import { STARTING_CREDITS } from "../../../../model/team";
import { TEAM_ERRORS, TeamRepository } from "../teamRepository";
import { Result, success, failure } from "../result";

export class TeamRepositoryD1 implements TeamRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async create(team: {
    name: string;
    playerId: string;
    leagueId: string;
    invitationCode?: string;
  }): Promise<Result<Team>> {
    try {
      const id = crypto.randomUUID();

      // The league's entry rules ride inside the INSERT. One statement is one
      // implicit transaction, so a league cannot flip to private between the
      // check and the write — see docs/architecture/backend-error-constants.md
      // §2, and contractRepositoryD1.create for the same shape.
      //
      // Three ways in: the league is public; the presented code matches; or
      // the joiner is the league's own admin, who must not be locked out of
      // the league they created.
      const result = await this.db
        .prepare(
          `INSERT INTO teams (id, name, playerId, leagueId)
           SELECT ?, ?, ?, l.id
             FROM leagues l
            WHERE l.id = ?
              AND (
                    l.visibility = ?
                 OR l.adminId = ?
                 OR (l.invitationCode IS NOT NULL AND l.invitationCode = ?)
              )`,
        )
        .bind(
          id,
          team.name,
          team.playerId,
          team.leagueId,
          LeagueVisibility.PUBLIC,
          team.playerId,
          // No code offered can never match: the column is compared against a
          // sentinel that is not a legal code rather than against NULL, which
          // would make the whole condition NULL either way.
          team.invitationCode ?? "",
        )
        .run();

      if (!result.success) {
        const error =
          "error" in result && typeof result.error === "string"
            ? result.error
            : "Unknown D1 error";
        return failure(`Failed to create team: ${error}`);
      }

      // The statement ran but matched nothing: the league is gone, or its
      // entry rules turned the join down. Which one is not knowable from here
      // and is not this layer's to guess — the service re-reads to say.
      if (result.meta.changes === 0) {
        return failure(TEAM_ERRORS.JOIN_CONFLICT);
      }

      // A brand-new team has zero contracts, so its derived credits is
      // trivially STARTING_CREDITS — no query needed.
      return success({
        id,
        name: team.name,
        playerId: team.playerId,
        leagueId: team.leagueId,
        credits: STARTING_CREDITS,
      });
    } catch (error) {
      return failure(
        `Error creating team: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async existsByNameInLeague(
    name: string,
    leagueId: string,
  ): Promise<Result<boolean>> {
    try {
      const result = await this.db
        .prepare(
          "SELECT 1 FROM teams WHERE leagueId = ? AND LOWER(name) = LOWER(?)",
        )
        .bind(leagueId, name)
        .first();

      return success(result !== null);
    } catch (error) {
      return failure(
        `Error checking team name: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getByPlayerAndLeague(
    playerId: string,
    leagueId: string,
  ): Promise<Result<Team | null>> {
    try {
      // credits is derived from the contracts ledger, not stored — the rule
      // itself lives in the team_credits view (ADR 0007), stated once.
      const result = await this.db
        .prepare(
          `SELECT t.id, t.name, t.playerId, t.leagueId, tc.credits
           FROM teams t
           JOIN team_credits tc ON tc.teamId = t.id
           WHERE t.playerId = ? AND t.leagueId = ?`,
        )
        .bind(playerId, leagueId)
        .first<Team>();

      return success(result ?? null);
    } catch (error) {
      return failure(
        `Error fetching team: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
