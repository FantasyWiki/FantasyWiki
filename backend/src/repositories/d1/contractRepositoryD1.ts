import { Temporal } from "@js-temporal/polyfill";
import { Contract } from "../../../../model";
import { STARTING_CREDITS } from "../../../../model/team";
import {
  ContractRepository,
  LeagueContractRow,
  NewContract,
} from "../contractRepository";
import { Result, success, failure } from "../result";

interface ContractRow {
  id: string;
  teamId: string;
  articleId: string;
  purchaseDate: string;
  expireDate: string;
  purchasePrice: number;
  settled: number;
  renewalCount: number;
  renewalElected: number;
}

interface LeagueContractQueryRow extends ContractRow {
  teamName: string;
  teamCredits: number;
  playerId: string;
  playerName: string;
}

function toContract(row: ContractRow): Contract {
  return {
    id: row.id,
    teamId: row.teamId,
    articleId: row.articleId,
    purchaseDate: Temporal.PlainDate.from(row.purchaseDate),
    expireDate: Temporal.PlainDate.from(row.expireDate),
    purchasePrice: row.purchasePrice,
    settled: row.settled === 1,
    renewalCount: row.renewalCount,
    renewalElected: row.renewalElected === 1,
  };
}

function toLeagueContractRow(row: LeagueContractQueryRow): LeagueContractRow {
  return {
    ...toContract(row),
    teamName: row.teamName,
    teamCredits: row.teamCredits,
    playerId: row.playerId,
    playerName: row.playerName,
  };
}

export class ContractRepositoryD1 implements ContractRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getByTeamId(teamId: string): Promise<Result<Contract[]>> {
    try {
      const result = await this.db
        .prepare("SELECT * FROM contracts WHERE teamId = ?")
        .bind(teamId)
        .all<ContractRow>();

      return success(result.results.map(toContract));
    } catch (error) {
      return failure(
        `Error fetching contracts: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getById(id: string): Promise<Result<Contract | null>> {
    try {
      const result = await this.db
        .prepare("SELECT * FROM contracts WHERE id = ? LIMIT 1")
        .bind(id)
        .first<ContractRow>();

      return success(result ? toContract(result) : null);
    } catch (error) {
      return failure(
        `Error fetching contract: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getByLeagueId(leagueId: string): Promise<Result<LeagueContractRow[]>> {
    try {
      // teamCredits is derived from the contracts ledger (see
      // TeamRepositoryD1.getByPlayerAndLeague), computed once per team via a
      // CTE rather than a stored column.
      const result = await this.db
        .prepare(
          `WITH team_credits AS (
             SELECT teamId,
                    ? - COALESCE(SUM(purchasePrice), 0)
                      + COALESCE(SUM(CASE WHEN settled = 1 THEN salePayout ELSE 0 END), 0) AS credits
             FROM contracts
             GROUP BY teamId
           )
           SELECT c.*, t.name AS teamName, tc.credits AS teamCredits,
                  p.id AS playerId, p.username AS playerName
           FROM contracts c
           JOIN teams t ON c.teamId = t.id
           JOIN players p ON t.playerId = p.id
           JOIN team_credits tc ON tc.teamId = t.id
           WHERE t.leagueId = ? AND c.settled = 0`,
        )
        .bind(STARTING_CREDITS, leagueId)
        .all<LeagueContractQueryRow>();

      return success(result.results.map(toLeagueContractRow));
    } catch (error) {
      return failure(
        `Error fetching league contracts: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async create(newContract: NewContract): Promise<Result<Contract>> {
    try {
      const id = crypto.randomUUID();
      const purchaseDate = newContract.purchaseDate.toString();
      const expireDate = newContract.expireDate.toString();

      // Single guarded write, no db.batch needed: the INSERT only applies if
      // the team's derived credits (STARTING_CREDITS - everything ever spent
      // + everything recovered from early sales) still cover the price at
      // write time. Naturally atomic — SQLite/D1 guarantee single-statement
      // atomicity against concurrent writers, the same guarantee a stored
      // `credits >= ?` column check always relied on.
      const result = await this.db
        .prepare(
          `INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, settled, renewalCount, renewalElected)
           SELECT ?, ?, ?, ?, ?, ?, 0, 0, 0
           WHERE (
             ? - COALESCE((SELECT SUM(purchasePrice) FROM contracts WHERE teamId = ?), 0)
               + COALESCE((SELECT SUM(salePayout) FROM contracts WHERE teamId = ? AND settled = 1), 0)
           ) >= ?`,
        )
        .bind(
          id,
          newContract.teamId,
          newContract.articleId,
          purchaseDate,
          expireDate,
          newContract.purchasePrice,
          STARTING_CREDITS,
          newContract.teamId,
          newContract.teamId,
          newContract.purchasePrice,
        )
        .run();

      if (!result.success || result.meta.changes === 0) {
        return failure("Not enough credits");
      }

      return success({
        id,
        teamId: newContract.teamId,
        articleId: newContract.articleId,
        purchaseDate: newContract.purchaseDate,
        expireDate: newContract.expireDate,
        purchasePrice: newContract.purchasePrice,
        settled: false,
        renewalCount: 0,
        renewalElected: false,
      });
    } catch (error) {
      return failure(
        `Error creating contract: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async settleSale(
    contractId: string,
    teamId: string,
    payout: number,
  ): Promise<Result<boolean>> {
    try {
      // Single guarded write: flips settled and persists the payout together,
      // guarded on the row still being unsettled and owned by teamId — the
      // sole gate against a concurrent double-sell. No teams-table write here
      // at all, since credits are derived from this same ledger, never
      // stored.
      const result = await this.db
        .prepare(
          `UPDATE contracts SET settled = 1, salePayout = ? WHERE id = ? AND teamId = ? AND settled = 0`,
        )
        .bind(payout, contractId, teamId)
        .run();

      if (!result.success) {
        return failure("Error settling contract");
      }
      return success(result.meta.changes > 0);
    } catch (error) {
      return failure(
        `Error selling contract: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
