import { League, Player } from "../../../model";
import { Result } from "./result";

export interface PlayerRepository {
  save(player: {
    username: string;
    accountId: string;
    email: string;
  }): Promise<Result<Player>>;
  getById(id: string): Promise<Result<Player>>;
  getLeaguesByPlayerId(id: string): Promise<Result<League[]>>;
  getPlayerByAccountId(accountId: string): Promise<Result<Player>>;
}
