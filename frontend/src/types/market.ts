export interface MarketArticleOwner {
  name: string;
  teamName: string;
}

export interface MarketArticle {
  id: string;
  title: string;
  slug: string;
  yesterdayViews: number;
  weekViews: number;
  monthViews: number;
  yearViews: number;
  owner: MarketArticleOwner | null;
}
