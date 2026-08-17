import { Temporal } from "@js-temporal/polyfill";
import { Contract } from "../../../../model";
import { MAX_TEAM_CONTRACTS } from "../../../../model/team";
import {
  ContractRepository,
  CONTRACT_WRITE_ERRORS,
  DueContract,
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

interface DueContractQueryRow extends ContractRow {
  domain: string;
  languageScale: number;
  teamCredits: number;
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

function toDueContract(row: DueContractQueryRow): DueContract {
  return {
    ...toContract(row),
    domain: row.domain,
    languageScale: row.languageScale,
    teamCredits: row.teamCredits,
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
      // teamCredits comes from the team_credits view (ADR 0007), which states
      // the derivation once rather than repeating it per query.
      const result = await this.db
        .prepare(
          `SELECT c.*, t.name AS teamName, tc.credits AS teamCredits,
                  p.id AS playerId, p.username AS playerName
           FROM contracts c
           JOIN teams t ON c.teamId = t.id
           JOIN players p ON t.playerId = p.id
           JOIN team_credits tc ON tc.teamId = t.id
           WHERE t.leagueId = ? AND c.settled = 0`,
        )
        .bind(leagueId)
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

      // Single guarded write: the INSERT applies only if every purchase
      // condition still holds at write time — credits cover the price, no team
      // in the league holds the article, team is under its cap. D1 guarantees
      // single-statement atomicity, so a concurrent buy can't slip between the
      // service's pre-checks and this write. ADR 0007 explains why the check
      // can't move to the service.
      //
      // The credits guard reads the team_credits view rather than its own copy
      // of the formula. A view is macro-expanded, so this is still one atomic
      // statement, and SQLite pushes the teamId predicate in — the plan stays
      // an indexed lookup on idx_contracts_teamId.
      const result = await this.db
        .prepare(
          `INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, settled, renewalCount, renewalElected)
           SELECT ?, ?, ?, ?, ?, ?, 0, 0, 0
           WHERE (SELECT credits FROM team_credits WHERE teamId = ?) >= ?
           AND NOT EXISTS (
             SELECT 1
             FROM contracts c
             JOIN teams t ON t.id = c.teamId
             WHERE c.articleId = ?
               AND c.settled = 0
               AND t.leagueId = (SELECT leagueId FROM teams WHERE id = ?)
           )
           AND (SELECT COUNT(*) FROM contracts WHERE teamId = ? AND settled = 0) < ?`,
        )
        .bind(
          id,
          newContract.teamId,
          newContract.articleId,
          purchaseDate,
          expireDate,
          newContract.purchasePrice,
          newContract.teamId,
          newContract.purchasePrice,
          newContract.articleId,
          newContract.teamId,
          newContract.teamId,
          MAX_TEAM_CONTRACTS,
        )
        .run();

      if (!result.success || result.meta.changes === 0) {
        return failure(CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT);
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

  async getDueForSettlement(
    today: Temporal.PlainDate,
  ): Promise<Result<DueContract[]>> {
    try {
      // teamCredits comes from the same team_credits view as getByLeagueId;
      // domain comes from the owning team's league. The WHERE clause rides the
      // idx_contracts_settled_expire (settled, expireDate) index.
      const result = await this.db
        .prepare(
          `SELECT c.*, l.domain AS domain, l.languageScale AS languageScale,
                  tc.credits AS teamCredits
           FROM contracts c
           JOIN teams t ON c.teamId = t.id
           JOIN leagues l ON t.leagueId = l.id
           JOIN team_credits tc ON tc.teamId = t.id
           WHERE c.settled = 0 AND c.expireDate <= ?`,
        )
        .bind(today.toString())
        .all<DueContractQueryRow>();

      return success(result.results.map(toDueContract));
    } catch (error) {
      return failure(
        `Error fetching due contracts: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async settleExpiry(
    contractId: string,
    payout: number,
  ): Promise<Result<boolean>> {
    try {
      // Same guarded single-write shape as settleSale, but system-driven (no
      // teamId guard needed): guarded on settled=0 so a re-run of the sweep is
      // idempotent. The payout lands in the shared salePayout ledger column.
      const result = await this.db
        .prepare(
          `UPDATE contracts SET settled = 1, salePayout = ? WHERE id = ? AND settled = 0`,
        )
        .bind(payout, contractId)
        .run();

      if (!result.success) {
        return failure("Error settling contract at expiry");
      }
      return success(result.meta.changes > 0);
    } catch (error) {
      return failure(
        `Error settling contract at expiry: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async renew(
    contractId: string,
    newPurchaseDate: Temporal.PlainDate,
    newExpireDate: Temporal.PlainDate,
    newPurchasePrice: number,
  ): Promise<Result<boolean>> {
    try {
      // Guarded on settled=0 AND renewalElected=1: once this runs, renewalElected
      // is cleared and expireDate moves past today, so a re-run of the sweep
      // can neither pick the row up again nor double-apply the premium.
      const result = await this.db
        .prepare(
          `UPDATE contracts
           SET purchaseDate = ?, expireDate = ?, purchasePrice = ?,
               renewalCount = renewalCount + 1, renewalElected = 0
           WHERE id = ? AND settled = 0 AND renewalElected = 1`,
        )
        .bind(
          newPurchaseDate.toString(),
          newExpireDate.toString(),
          newPurchasePrice,
          contractId,
        )
        .run();

      if (!result.success) {
        return failure("Error renewing contract");
      }
      return success(result.meta.changes > 0);
    } catch (error) {
      return failure(
        `Error renewing contract: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async electRenewal(
    contractId: string,
    teamId: string,
  ): Promise<Result<boolean>> {
    try {
      const result = await this.db
        .prepare(
          `UPDATE contracts SET renewalElected = 1 WHERE id = ? AND teamId = ? AND settled = 0`,
        )
        .bind(contractId, teamId)
        .run();

      if (!result.success) {
        return failure("Error electing contract renewal");
      }
      return success(result.meta.changes > 0);
    } catch (error) {
      return failure(
        `Error electing contract renewal: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async cancelRenewal(
    contractId: string,
    teamId: string,
  ): Promise<Result<boolean>> {
    try {
      // renewalElected = 1 in the WHERE clause makes this lose the race against
      // the settlement sweep rather than silently un-electing an already-renewed
      // contract: the sweep clears the flag as it renews, so 0 rows change.
      const result = await this.db
        .prepare(
          `UPDATE contracts SET renewalElected = 0 WHERE id = ? AND teamId = ? AND settled = 0 AND renewalElected = 1`,
        )
        .bind(contractId, teamId)
        .run();

      if (!result.success) {
        return failure("Error cancelling contract renewal");
      }
      return success(result.meta.changes > 0);
    } catch (error) {
      return failure(
        `Error cancelling contract renewal: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
