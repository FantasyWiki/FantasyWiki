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
  owner: MarketArticleOwnerDTO | null;
}
