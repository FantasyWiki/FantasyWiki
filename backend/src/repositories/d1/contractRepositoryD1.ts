import { Temporal } from "@js-temporal/polyfill";
import { Contract } from "../../../../model";
import { ContractRepository, LeagueContractRow } from "../contractRepository";
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
           WHERE t.leagueId = ?`,
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
}
