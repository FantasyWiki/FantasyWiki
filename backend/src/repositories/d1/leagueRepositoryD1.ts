import { Temporal } from "@js-temporal/polyfill";
import { League } from "../../../../model";
import {
  LeagueInvitePolicy,
  LeagueVisibility,
  isLeagueInvitePolicy,
  isLeagueVisibility,
} from "../../../../model/enums";
import { LEAGUE_ERRORS, LeagueRepository } from "../leagueRepository";
import { Result, success, failure } from "../result";

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
