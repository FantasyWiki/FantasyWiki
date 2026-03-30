import { schema } from "./enums";
import { Temporal } from "@js-temporal/polyfill";
import { ArticleDTO } from "./articleDTO";

export interface FormationDTO {
  date: Temporal.Instant;
  formation: {position:string, articleDTO: ArticleDTO}[]
}

export abstract class formationSchema {
  abstract readonly schema: schema;

}

export class Formation433 extends formationSchema {
  schema: "4-3-3";
  gk: ArticleDTO;
  lb: ArticleDTO;
  clb: ArticleDTO;
  crb: ArticleDTO;
  rb: ArticleDTO;
  lm: ArticleDTO;
  cm: ArticleDTO;
  rm: ArticleDTO;
  lw: ArticleDTO;
  st: ArticleDTO;
  rw: ArticleDTO;

}
