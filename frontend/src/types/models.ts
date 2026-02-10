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

export interface Notification {
  id: string;
  leagueId: string;
  teamId: string;
  message: string;
  type: "contract_expiring" | "trade_offer" | "league_update" | "general";
  read: boolean;
  createdAt: string;
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
