import { Temporal } from "@js-temporal/polyfill";
import { GLOBAL_LEAGUE_ID, Team } from "../../../../model";
import { LeagueVisibility } from "../../../../model/enums";
import { STARTING_CREDITS } from "../../../../model/team";
import {
  LeaveOutcome,
  TEAM_ERRORS,
  TeamMembership,
  TeamRepository,
} from "../teamRepository";
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
      // Two ways in: the league is public, or the presented code matches.
      // There is no third for the league's own admin, and none is needed — a
      // league and its founder's team are written in one transaction, so an
      // admin is a member by construction and never reaches this statement,
      // and an admin who leaves has handed the league on before they can knock
      // (#537).
      //
      // `closedAt IS NULL` is here and the season's end date is not, and the
      // asymmetry is the point: `closedAt` can be written by another request
      // while this one runs, so only the statement can hold it, whereas
      // `endDate` is fixed when the league is founded and never moves. Checking
      // an immutable value is not a race, so the "season ran out" half of
      // inactivity is left to `isLeagueInactive` in the service, where the rule
      // is stated once rather than spelled a second time in SQL.
      //
      // The `NOT EXISTS` says one row per player per league, ever. That is
      // already `UNIQUE (playerId, leagueId)`, but as a constraint it surfaces
      // as driver text this layer would have to pattern-match; as a condition
      // of the write it comes back through the sentinel protocol like every
      // other refusal, and it covers the row of a player who has left.
      const result = await this.db
        .prepare(
          `INSERT INTO teams (id, name, playerId, leagueId)
           SELECT ?, ?, ?, l.id
             FROM leagues l
            WHERE l.id = ?
              AND l.closedAt IS NULL
              AND NOT EXISTS (
                    SELECT 1 FROM teams t
                     WHERE t.playerId = ? AND t.leagueId = l.id
              )
              AND (
                    l.visibility = ?
                 OR (l.invitationCode IS NOT NULL AND l.invitationCode = ?)
              )`,
        )
        .bind(
          id,
          team.name,
          team.playerId,
          team.leagueId,
          team.playerId,
          LeagueVisibility.PUBLIC,
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

  async rejoin(team: {
    name: string;
    playerId: string;
    leagueId: string;
    invitationCode?: string;
  }): Promise<Result<Team>> {
    try {
      // The mirror of `create`, and guarded by the same conditions in the same
      // statement — the league is open and its entry rules admit this player —
      // plus `leftAt IS NOT NULL`, which is what makes this the returning
      // player's path and not a way to rename a team you are already in.
      //
      // Setting `leftAt` back to NULL is the whole of coming back: the row, its
      // contracts and its standing were never removed, so there is nothing to
      // restore (docs/domain/league-lifecycle.md).
      //
      // A league's founder is not exempt from its code either. Leaving hands
      // the league on, so by the time anyone knocks here they are an ex-admin
      // like any other returning player.
      const result = await this.db
        .prepare(
          `UPDATE teams
              SET leftAt = NULL, name = ?
            WHERE playerId = ?
              AND leagueId = ?
              AND leftAt IS NOT NULL
              AND EXISTS (
                    SELECT 1 FROM leagues l
                     WHERE l.id = teams.leagueId
                       AND l.closedAt IS NULL
                       AND (
                             l.visibility = ?
                          OR (l.invitationCode IS NOT NULL
                              AND l.invitationCode = ?)
                       )
              )`,
        )
        .bind(
          team.name,
          team.playerId,
          team.leagueId,
          LeagueVisibility.PUBLIC,
          team.invitationCode ?? "",
        )
        .run();

      if (!result.success) {
        const error =
          "error" in result && typeof result.error === "string"
            ? result.error
            : "Unknown D1 error";
        return failure(`Failed to rejoin league: ${error}`);
      }

      if (result.meta.changes === 0) {
        return failure(TEAM_ERRORS.JOIN_CONFLICT);
      }

      // Read back rather than assembling the team here: unlike a fresh join,
      // this one has a contracts ledger behind it, so its credits is whatever
      // the season left it with and only the view can say.
      return this.getByPlayerAndLeague(team.playerId, team.leagueId).then(
        (r) =>
          r.ok && r.value === null
            ? failure(`Rejoined team vanished: ${team.leagueId}`)
            : (r as Result<Team>),
      );
    } catch (error) {
      return failure(
        `Error rejoining league: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async existsByNameInLeague(
    name: string,
    leagueId: string,
    exceptPlayerId?: string,
  ): Promise<Result<boolean>> {
    try {
      const result = await this.db
        .prepare(
          `SELECT 1 FROM teams
            WHERE leagueId = ?
              AND LOWER(name) = LOWER(?)
              AND playerId <> ?`,
        )
        // A sentinel that is not a player id, so the ordinary call excludes
        // nobody without needing a second statement.
        .bind(leagueId, name, exceptPlayerId ?? "")
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
      //
      // `leftAt IS NULL` is what turns leaving into something the rest of the
      // system feels: every self-scoped feature reaches the league through this
      // one read, so a departed player is answered "you have no team here" by
      // all of them at once, without any of them checking for themselves.
      const result = await this.db
        .prepare(
          `SELECT t.id, t.name, t.playerId, t.leagueId, tc.credits
           FROM teams t
           JOIN team_credits tc ON tc.teamId = t.id
           WHERE t.playerId = ? AND t.leagueId = ? AND t.leftAt IS NULL`,
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

  async getMembership(
    playerId: string,
    leagueId: string,
  ): Promise<Result<TeamMembership | null>> {
    try {
      // Unfiltered on purpose — this is the read that can see a departure, and
      // the only one that should.
      const row = await this.db
        .prepare(
          "SELECT id, leftAt FROM teams WHERE playerId = ? AND leagueId = ?",
        )
        .bind(playerId, leagueId)
        .first<{ id: string; leftAt: string | null }>();

      if (!row) return success(null);
      return success({
        teamId: row.id,
        leftAt: row.leftAt === null ? null : Temporal.Instant.from(row.leftAt),
      });
    } catch (error) {
      return failure(
        `Error fetching membership: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async leave(departure: {
    teamId: string;
    playerId: string;
    leagueId: string;
    leftAt: Temporal.Instant;
  }): Promise<Result<LeaveOutcome>> {
    const { teamId, playerId, leagueId, leftAt } = departure;
    try {
      // Stamp the departure, hand the league on if its admin is the one
      // walking out, and erase the league if nobody is left — one batch, so D1
      // runs them as one transaction.
      //
      // Statements 2 and 3 each carry `EXISTS (SELECT 1 FROM teams WHERE
      // id = ? AND leftAt = ?)`: they act only if *this* departure was the one
      // written. Without it a refused leave would still be read by statement 3
      // as the one that emptied the league, and delete a league everyone had
      // already abandoned.
      //
      // No production path reaches that state today, and the conditioning is
      // kept anyway (#538). It bites only on a memberless league still
      // standing, and statement 3 is itself the reason no such league exists —
      // the last member's departure takes the league with it. This is not dead
      // code; it is code whose trigger this same batch removes, and anything
      // that stops a league being deleted here — an empty league kept for its
      // archive, a soft close — makes it live again. Do not drop it for want
      // of a test.
      const results = await this.db.batch([
        this.db
          .prepare(
            `UPDATE teams
                SET leftAt = ?
              WHERE id = ?
                AND playerId = ?
                AND leagueId = ?
                AND leftAt IS NULL
                AND leagueId <> ?
                AND EXISTS (
                      SELECT 1 FROM leagues l
                       WHERE l.id = teams.leagueId
                         AND l.closedAt IS NULL
                )`,
          )
          .bind(
            leftAt.toString(),
            teamId,
            playerId,
            leagueId,
            GLOBAL_LEAGUE_ID,
          ),

        // `rowid` is join order, the only record of seniority `teams` keeps.
        // A `joinedAt` column would say it out loud, but nothing else wants the
        // fact; this holds as long as nobody rebuilds the table.
        this.db
          .prepare(
            `UPDATE leagues
                SET adminId = (
                      SELECT playerId FROM teams
                       WHERE leagueId = leagues.id AND leftAt IS NULL
                       ORDER BY rowid
                       LIMIT 1
                    )
              WHERE id = ?
                AND adminId = ?
                AND EXISTS (
                      SELECT 1 FROM teams
                       WHERE leagueId = leagues.id AND leftAt IS NULL
                )
                AND EXISTS (
                      SELECT 1 FROM teams WHERE id = ? AND leftAt = ?
                )`,
          )
          .bind(leagueId, playerId, teamId, leftAt.toString()),

        // Teams, contracts, performances, lineups and notifications go with it
        // through ON DELETE CASCADE — `PRAGMA foreign_keys` reports 1 on D1, so
        // the cascade is enforced rather than merely declared.
        this.db
          .prepare(
            `DELETE FROM leagues
              WHERE id = ?
                AND NOT EXISTS (
                      SELECT 1 FROM teams
                       WHERE leagueId = leagues.id AND leftAt IS NULL
                )
                AND EXISTS (
                      SELECT 1 FROM teams WHERE id = ? AND leftAt = ?
                )`,
          )
          .bind(leagueId, teamId, leftAt.toString()),
      ]);

      const [departed, , deleted] = results;
      if (!departed.success) {
        const error =
          "error" in departed && typeof departed.error === "string"
            ? departed.error
            : "Unknown D1 error";
        return failure(`Failed to leave league: ${error}`);
      }

      // A batch whose first statement matched nothing still resolves
      // successfully, so the sentinel comes from its own `changes`.
      if (departed.meta.changes === 0) {
        return failure(TEAM_ERRORS.LEAVE_CONFLICT);
      }

      return success({ leagueDeleted: deleted.meta.changes > 0 });
    } catch (error) {
      return failure(
        `Error leaving league: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getByIdAndLeague(
    teamId: string,
    leagueId: string,
  ): Promise<Result<Team | null>> {
    try {
      const result = await this.db
        .prepare(
          `SELECT t.id, t.name, t.playerId, t.leagueId, tc.credits
           FROM teams t
           JOIN team_credits tc ON tc.teamId = t.id
           WHERE t.id = ? AND t.leagueId = ?`,
        )
        .bind(teamId, leagueId)
        .first<Team>();

      return success(result ?? null);
    } catch (error) {
      return failure(
        `Error fetching team: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
