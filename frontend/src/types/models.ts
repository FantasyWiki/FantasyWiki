// frontend/src/types/models.ts

export interface Article {
  id: string;
  name: string;
  domain: string;
}

export interface League {
  id: string;
  name: string;
  icon: string;
  season: string;
  language: string;
  totalPlayers: number;
  endDate: string;
}

export interface Player {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  playerId: string;
  leagueId: string;
  credits: number;
  totalValue: number;
  rank: number;
  points: number;
  yesterdayPoints: number;
  pointsChange: number;
}

export interface Contract {
  id: string;
  teamId: string;
  leagueId: string;
  purchasePrice: number;
  currentPrice: number;
  yesterdayPoints: number;
  expiresIn: number;
  tier: "SHORT" | "MEDIUM" | "LONG";
  article: Article;
}

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  playerId: string;
  username: string;
  teamName: string;
  points: number;
  change: number;
  isCurrentUser: boolean;
}

export interface DashboardSummary {
  yesterdayPoints: number;
  pointsChange: number;
  rank: number;
  totalPlayers: number;
  credits: number;
  portfolioValue: number;
  activeContracts: number;
  maxContracts: number;
}

export interface DashboardData {
  team: Team;
  league: League;
  contracts: Contract[];
  leaderboard: LeaderboardEntry[];
  notifications: Notification[];
  summary: DashboardSummary;
}

// ── Trade Proposals ──────────────────────────────────────────────────────────

export interface TradeArticleRef {
  id: string;
  name: string;
  basePrice: number;
}

export interface TradeProposal {
  id: string;
  leagueId: string;
  /** "incoming" = someone wants something from us; "outgoing" = we initiated */
  type: "incoming" | "outgoing";
  status: "pending" | "accepted" | "rejected";
  fromTeamId: string;
  fromUsername: string;
  toTeamId: string;
  toUsername: string;
  /** Article they are offering in exchange (optional — could be credits only) */
  offeredArticle?: TradeArticleRef;
  /** Credits they are offering in exchange (optional) */
  offeredCredits?: number;
  /** Article they want from us */
  requestedArticle: TradeArticleRef;
  contractTier: string;
  createdAt: string;
}
