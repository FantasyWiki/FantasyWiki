import { Temporal } from "@js-temporal/polyfill";
import { TeamDTO } from "./teamDTO";
import { ArticleDTO } from "./articleDTO";

export interface ContractDTO {
  id: string;
  team: TeamDTO;
  article: ArticleDTO;
  startDate: Temporal.Instant;
  duration: Temporal.Duration;
  purchasePrice: number;
}
