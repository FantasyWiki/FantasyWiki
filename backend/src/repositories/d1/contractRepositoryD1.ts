import { Temporal } from "@js-temporal/polyfill";
import { Contract } from "../../../../model";
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
      const result = await this.db
        .prepare(
          `SELECT c.*, t.name AS teamName, t.credits AS teamCredits,
                  p.id AS playerId, p.username AS playerName
           FROM contracts c
           JOIN teams t ON c.teamId = t.id
           JOIN players p ON t.playerId = p.id
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

      // The credit debit is issued here (touching `teams`, not just `contracts`)
      // rather than through TeamRepository: the INSERT and the guarded debit must
      // commit or fail together as a single atomic money write. Both statements
      // are guarded by the identical `credits >= purchasePrice` condition (read
      // from the same pre-batch snapshot, since the INSERT never touches
      // `teams`), so within this one db.batch() either both apply or neither
      // does — no contract can ever be created without a matching debit.
      const batchResults = await this.db.batch<{ changes: number }>([
        this.db
          .prepare(
            `INSERT INTO contracts (id, teamId, articleId, purchaseDate, expireDate, purchasePrice, settled, renewalCount, renewalElected)
             SELECT ?, ?, ?, ?, ?, ?, 0, 0, 0
             WHERE EXISTS (SELECT 1 FROM teams WHERE id = ? AND credits >= ?)`,
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
          ),
        this.db
          .prepare(
            `UPDATE teams SET credits = credits - ? WHERE id = ? AND credits >= ?`,
          )
          .bind(
            newContract.purchasePrice,
            newContract.teamId,
            newContract.purchasePrice,
          ),
      ]);

      const debitResult = batchResults[1];
      if (!debitResult.success || debitResult.meta.changes === 0) {
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
}
