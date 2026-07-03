export interface MarketArticleOwnerDTO {
  name: string;
  teamName: string;
}

export interface MarketArticleDTO {
  id: string;
  title: string;
  slug: string;
  yesterdayViews: number;
  weekViews: number;
  monthViews: number;
  yearViews: number;
  /** Raw (not normalized) 30-day average views; input to ContractPrice (ADR 0005). */
  averageViews30d: number;
  /** ContractPrice (ADR 0005) at the MEDIUM tier — the market's headline price. */
  price: number;
  owner: MarketArticleOwnerDTO | null;
}
