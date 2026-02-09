export interface Article {
  id: string;
  name: string;
  domain: string;

}

export interface Contract {
  id: string;
  article: Article;
  purchasePrice: number;
  currentPrice: number;
  yesterdayPoints: number;
  expiresIn: number;
  tier: string;
  leagueId: string;
}

// Mock data - replace with real data from store

export const allContracts: Contract[] = [
  {
    id: "ctr-0123",
    article: {
      id: "btc-1",
      name: "Bitcoin",
      domain: "itwiki"
  },
    purchasePrice: 150,
    currentPrice: 165,
    yesterdayPoints: 45,
    expiresIn: 2,
    tier: "MEDIUM",
    leagueId: "italy",
  },
  {
    id: "ctr-084576",
    article: {
      id: "eth-1",
      name: "Ethereum",
      domain: "itwiki",

    },
    purchasePrice: 120,
    currentPrice: 115,
    yesterdayPoints: 38,
    expiresIn: 5,
    tier: "MEDIUM",
    leagueId: "italy",
  },
  {
    id: "ctr-73t4763r4",
    article: {
      id: "ai-1",
      name: "Intelligenza Artificiale",
      domain: "itwiki"

    },
    purchasePrice: 200,
    currentPrice: 220,
    yesterdayPoints: 42,
    expiresIn: 1,
    tier: "LONG",
    leagueId: "italy",
  },
];