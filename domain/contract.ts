import { Temporal } from "@js-temporal/polyfill";

export interface Contract {
  id: string;
  teamId: string;
  articleId: string; //Wikipedia article ID
  purchaseDate: Temporal.PlainDate;
  expireDate: Temporal.PlainDate;
  purchasePrice: number;
}
