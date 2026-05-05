import { Player } from "../../../model";
import { PlayerRepository } from "../repositories/playerRepository";
import { PlayerRepositoryD1 } from "../repositories/d1/playerRepositoryD1";
import { Result } from "../repositories/result";

export class PlayerService {
  private repository: PlayerRepository;

  constructor(repositoryOrDb: PlayerRepository | D1Database) {
    if ("save" in repositoryOrDb) {
      this.repository = repositoryOrDb;
      return;
    }
    this.repository = new PlayerRepositoryD1(repositoryOrDb);
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
