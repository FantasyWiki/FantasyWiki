import { Temporal } from "@js-temporal/polyfill";
import { TeamDTO } from "./teamDTO";
import { ArticleDTO } from "./articleDTO";


export class ContractDTO {
  id: string;
  team: TeamDTO;
  article: ArticleDTO;
  startDate: Temporal.Instant;
  duration: Temporal.Duration;
  purchasePrice: number;


  constructor(id: string, team: TeamDTO, article: ArticleDTO, startDate: Temporal.Instant, duration: Temporal.Duration, purchasePrice: number) {
    this.id = id;
    this.team = team;
    this.article = article;
    this.startDate = startDate;
    this.duration = duration;
    this.purchasePrice = purchasePrice;
  }

  get expiresIn(): Temporal.Duration {
    const now = Temporal.Now.instant();
    const endDate = this.startDate
      .toZonedDateTimeISO("UTC")
      .add(this.duration)
      .toInstant();
    return endDate.since(now);
  }

  get tier(): string {
    const range = this.duration.days
    if (range <= 3) return "SHORT"
    if (range <= 7) return "MEDIUM"
    return "LONG"
  }
}
