import type { ContractDTO } from "../../../dto/contractDTO";

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
  /** Populated once the league-contracts fetch resolves; null until then and while free. */
  owner: MarketArticleOwner | null;
  ownerTeamId?: string;
  /** The full contract backing `owner`, needed to open ArticleDetail correctly. */
  contract?: ContractDTO | null;
}
