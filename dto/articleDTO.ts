import type { Domain } from "../model/enums";

export interface ArticleDTO {
  id: string;
  title: string;
  domain: Domain;
}
