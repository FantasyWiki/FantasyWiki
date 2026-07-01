import { Temporal } from "@js-temporal/polyfill";
import { TeamDTO } from "./teamDTO";
import { ArticleDTO } from "./articleDTO";

/**
 * Raw contract shape as received from the API, before deserialization:
 * dates and durations arrive as ISO-8601 strings (duration may also be an
 * object form such as `{ days: 7 }`). Use `ContractDTO.fromRaw` to convert.
 */
export type RawContract = {
  id: string;
  team: TeamDTO;
  article: ArticleDTO;
  startDate: string;
  duration: string | Record<string, unknown>;
  purchasePrice: number;
};


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

  /**
   * Builds a ContractDTO from a raw API payload, converting the ISO-8601
   * `startDate` into a Temporal.Instant and `duration` into a Temporal.Duration.
   * Canonical deserialization entry point — services call this instead of
   * constructing the instance directly.
   */
  static fromRaw(raw: RawContract): ContractDTO {
    return new ContractDTO(
      raw.id,
      raw.team,
      raw.article,
      Temporal.Instant.from(raw.startDate),
      Temporal.Duration.from(raw.duration),
      raw.purchasePrice
    );
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
