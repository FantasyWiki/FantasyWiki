import type { Domain } from "./enums";

export interface ArticleDTO {
  id: string;
  title: string;
  domain: Domain;
}
