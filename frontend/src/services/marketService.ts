import type { MarketArticle } from "@/types/market";

export async function fetchMarket(leagueId: string): Promise<MarketArticle[]> {
  const res = await fetch(`/api/leagues/${leagueId}/market`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to fetch market: ${res.status}`);
  return res.json() as Promise<MarketArticle[]>;
}
