import { Player } from "../../../model";
import { PlayerRepositoryD1 } from "../repositories/d1/playerRepositoryD1";
import { Result } from "../repositories/result";

export class PlayerService {
  private repository: PlayerRepositoryD1;

  constructor(db: D1Database) {
    this.repository = new PlayerRepositoryD1(db);
  }

  async createPlayer(
    username: string,
    email: string,
    accountId: string,
  ): Promise<Result<Player>> {
    return this.repository.save({ username, accountId, email });
  }

  async getPlayerById(id: string): Promise<Result<Player>> {
    return this.repository.getById(id);
  }

  async getPlayerByGoogleAccountId(accountId: string): Promise<Result<Player>> {
    return this.repository.getPlayerByAccountId(accountId);
  }
}
