import { PlayerDTO } from "./playerDTO";

export interface TeamDTO {
  id: string;
  name: string;
  credits: number;
  player: PlayerDTO;
}