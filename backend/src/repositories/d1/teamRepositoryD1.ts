import { Temporal } from "@js-temporal/polyfill";
import { GLOBAL_LEAGUE_ID, Team } from "../../../../model";
import { LeagueVisibility } from "../../../../model/enums";
import { STARTING_CREDITS } from "../../../../model/team";
import { TEAM_ERRORS, TeamMembership, TeamRepository } from "../teamRepository";
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
                 OR l.adminId = ?
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
                          OR l.adminId = ?
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
          team.playerId,
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

  async leave(
    playerId: string,
    leagueId: string,
    leftAt: Temporal.Instant,
  ): Promise<Result<void>> {
    try {
      // Every rule about leaving is a condition of this one statement, for the
      // reason set out in docs/architecture/backend-error-constants.md §2:
      // `leftAt IS NULL` so a departure is recorded once and its moment is
      // never overwritten, and the league join so an admin cannot leave the
      // league only they can end, nor anyone leave a league being closed in the
      // same instant.
      //
      // As in `create`, the season's end date is absent by design: it cannot
      // change, so `isLeagueInactive` in the service is where that half of the
      // rule lives.
      const result = await this.db
        .prepare(
          `UPDATE teams
              SET leftAt = ?
            WHERE playerId = ?
              AND leagueId = ?
              AND leftAt IS NULL
              AND leagueId <> ?
              AND EXISTS (
                    SELECT 1 FROM leagues l
                     WHERE l.id = teams.leagueId
                       AND l.closedAt IS NULL
                       AND l.adminId <> teams.playerId
              )`,
        )
        .bind(leftAt.toString(), playerId, leagueId, GLOBAL_LEAGUE_ID)
        .run();

      if (!result.success) {
        const error =
          "error" in result && typeof result.error === "string"
            ? result.error
            : "Unknown D1 error";
        return failure(`Failed to leave league: ${error}`);
      }

      if (result.meta.changes === 0) {
        return failure(TEAM_ERRORS.LEAVE_CONFLICT);
      }

      return success(undefined);
    } catch (error) {
      return failure(
        `Error leaving league: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
