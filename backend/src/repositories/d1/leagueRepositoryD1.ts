import { Temporal } from "@js-temporal/polyfill";
import { League, Team } from "../../../../model";
import {
  LeagueInvitePolicy,
  LeagueVisibility,
  isLeagueInvitePolicy,
  isLeagueVisibility,
} from "../../../../model/enums";
import { DEFAULT_SCHEMA } from "../../../../model/lineup";
import { STARTING_CREDITS } from "../../../../model/team";
import {
  LEAGUE_ERRORS,
  LeagueRepository,
  NewLeague,
} from "../leagueRepository";
import { Result, success, failure } from "../result";

/**
 * A code that lost the race on `idx_leagues_invitationCode`, told apart from
 * every other uniqueness failure the same transaction can raise — a founding
 * team that duplicates `(playerId, leagueId)` reports
 * `UNIQUE constraint failed: teams.playerId, teams.leagueId`, and redrawing a
 * code five times would not fix it. Recognising the phrasing is this layer's
 * job, as it is in `playerRepositoryD1`: SQLite's wording never leaves here.
 */
function isInvitationCodeConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("UNIQUE constraint failed: leagues.invitationCode");
}

/**
 * A `leagues` row as SQLite hands it back: the dates are text, not instants,
 * and the two enum columns are whatever text is in them. Shared with
 * `PlayerRepositoryD1`, which selects the same columns, so both read a row
 * through the one conversion below.
 *
 * `invitationCode` is not here. It is a credential and no ordinary league read
 * has any use for it — see `LEAGUE_COLUMNS` and `getInvitationCode`.
 */
export interface LeagueRow {
  id: string;
  name: string;
  adminId: string;
  startDate: string;
  endDate: string;
  domain: string;
  visibility: string;
  invitePolicy: string;
  icon: string;
  closedAt: string | null;
}

/**
 * The one column list both repositories select a league through — stated once
 * so a new column cannot be added to one query and forgotten in the other.
 * The qualified form is for the membership join, which has two tables in play.
 */
const LEAGUE_COLUMN_NAMES = [
  "id",
  "name",
  "adminId",
  "startDate",
  "endDate",
  "domain",
  "visibility",
  "invitePolicy",
  "icon",
  "closedAt",
] as const;

export const LEAGUE_COLUMNS = LEAGUE_COLUMN_NAMES.join(", ");

export const LEAGUE_COLUMNS_QUALIFIED = LEAGUE_COLUMN_NAMES.map(
  (c) => `l.${c}`,
).join(", ");

export function toLeague(row: LeagueRow): League {
  return {
    ...row,
    startDate: Temporal.Instant.from(row.startDate),
    endDate: Temporal.Instant.from(row.endDate),
    // Fail closed. A row whose visibility we cannot read is not a row to throw
    // open: guessing 'public' on unrecognised text would silently unlock a
    // league nobody meant to unlock.
    visibility: isLeagueVisibility(row.visibility)
      ? row.visibility
      : LeagueVisibility.PRIVATE,
    // No such risk here — an unreadable policy only decides who may *hand out*
    // the code, and the narrower answer is the safe one.
    invitePolicy: isLeagueInvitePolicy(row.invitePolicy)
      ? row.invitePolicy
      : LeagueInvitePolicy.ADMIN,
    // Null is the ordinary case — a league nobody has closed — so this is a
    // conversion, not a fallback.
    closedAt:
      row.closedAt === null ? null : Temporal.Instant.from(row.closedAt),
  };
}

export class LeagueRepositoryD1 implements LeagueRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getById(id: string): Promise<Result<League>> {
    try {
      const result = await this.db
        .prepare(`SELECT ${LEAGUE_COLUMNS} FROM leagues WHERE id = ?`)
        .bind(id)
        .first<LeagueRow>();

      if (!result) {
        return failure(LEAGUE_ERRORS.NOT_FOUND);
      }

      return success(toLeague(result));
    } catch (error) {
      return failure(
        `Error retrieving league: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async listPublic(limit: number): Promise<Result<League[]>> {
    try {
      const results = await this.db
        .prepare(
          `SELECT ${LEAGUE_COLUMNS} FROM leagues
            WHERE visibility = ?
            ORDER BY startDate DESC
            LIMIT ?`,
        )
        .bind(LeagueVisibility.PUBLIC, limit)
        .all<LeagueRow>();

      return success((results.results ?? []).map(toLeague));
    } catch (error) {
      return failure(
        `Error listing public leagues: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async createWithFoundingTeam(
    league: NewLeague,
    foundingTeamName: string,
  ): Promise<Result<{ league: League; team: Team }>> {
    const leagueId = crypto.randomUUID();
    const teamId = crypto.randomUUID();

    try {
      // One batch, one transaction: D1 runs these three or none of them. A
      // half-written founding — a league whose founder never got a team, or a
      // team with no lineup row for `getLineup` to read — is not a state any
      // screen knows how to show, and nothing would ever come back to fix it.
      await this.db.batch([
        this.db
          .prepare(
            `INSERT INTO leagues (${LEAGUE_COLUMNS}, invitationCode)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            leagueId,
            league.name,
            league.adminId,
            league.startDate.toString(),
            league.endDate.toString(),
            league.domain,
            league.visibility,
            league.invitePolicy,
            league.icon,
            // A league is born open. Written explicitly rather than left to the
            // column default so the bind list stays in step with LEAGUE_COLUMNS.
            null,
            league.invitationCode,
          ),
        // A plain INSERT, not the gated one `TeamRepositoryD1.create` uses:
        // that gate reads the league to decide whether this player may enter,
        // and here the league is the one being written a statement earlier by
        // this very player. There is nothing to check that is not already known.
        this.db
          .prepare(
            "INSERT INTO teams (id, name, playerId, leagueId) VALUES (?, ?, ?, ?)",
          )
          .bind(teamId, foundingTeamName, league.adminId, leagueId),
        this.db
          .prepare(
            "INSERT INTO lineups (teamId, schema, formation, updatedAt) VALUES (?, ?, ?, ?)",
          )
          .bind(teamId, DEFAULT_SCHEMA, "{}", new Date().toISOString()),
      ]);
    } catch (error) {
      // `batch` rejects rather than reporting per-statement failure, so the
      // classification belongs here and nowhere else.
      if (isInvitationCodeConflict(error)) {
        return failure(LEAGUE_ERRORS.INVITATION_CODE_TAKEN);
      }
      return failure(
        `Error creating league: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return success({
      league: {
        id: leagueId,
        name: league.name,
        adminId: league.adminId,
        startDate: league.startDate,
        endDate: league.endDate,
        domain: league.domain,
        visibility: league.visibility,
        invitePolicy: league.invitePolicy,
        icon: league.icon,
        closedAt: null,
      },
      // A brand-new team holds no contracts, so its derived credits is
      // trivially STARTING_CREDITS — the same shortcut `TeamRepositoryD1` takes.
      team: {
        id: teamId,
        name: foundingTeamName,
        playerId: league.adminId,
        leagueId,
        credits: STARTING_CREDITS,
      },
    });
  }

  async getInvitationCode(leagueId: string): Promise<Result<string | null>> {
    try {
      // Its own read, and the only one that touches the column: a credential
      // should travel because a caller asked for it, never as a passenger on a
      // shape five services pass around.
      //
      // Nullable, honestly: `ALTER TABLE` cannot add a NOT NULL UNIQUE column
      // and this repo does not rebuild tables, so "every league has a code" is
      // a rule the creation path keeps, not one the schema enforces.
      const row = await this.db
        .prepare("SELECT invitationCode FROM leagues WHERE id = ?")
        .bind(leagueId)
        .first<{ invitationCode: string | null }>();

      if (!row) {
        return failure(LEAGUE_ERRORS.NOT_FOUND);
      }
      return success(row.invitationCode);
    } catch (error) {
      return failure(
        `Error retrieving invitation code: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async countTeamsByLeague(
    leagueIds: readonly string[],
  ): Promise<Result<Record<string, number>>> {
    if (leagueIds.length === 0) return success({});
    try {
      const placeholders = leagueIds.map(() => "?").join(", ");
      const results = await this.db
        .prepare(
          `SELECT leagueId, COUNT(*) AS teamCount
           FROM teams
           WHERE leagueId IN (${placeholders})
           GROUP BY leagueId`,
        )
        .bind(...leagueIds)
        .all<{ leagueId: string; teamCount: number }>();

      // Seeded with zeros so a league nobody has joined answers 0 rather than
      // going missing: GROUP BY only returns the ids that have rows.
      const counts: Record<string, number> = Object.fromEntries(
        leagueIds.map((id) => [id, 0]),
      );
      for (const row of results.results ?? []) {
        counts[row.leagueId] = row.teamCount;
      }
      return success(counts);
    } catch (error) {
      return failure(
        `Error counting league teams: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
