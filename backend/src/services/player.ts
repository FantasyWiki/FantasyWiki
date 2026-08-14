import { League, Player } from "../../../model";
import { PlayerRepository } from "../repositories/playerRepository";
import { Result } from "../repositories/result";

export class PlayerService {
  private repository: PlayerRepository;

  constructor(deps: { players: PlayerRepository }) {
    this.repository = deps.players;
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

  /** The leagues the player participates in (i.e. has a team in). */
  async getLeaguesByPlayerId(id: string): Promise<Result<League[]>> {
    return this.repository.getLeaguesByPlayerId(id);
  }
}
