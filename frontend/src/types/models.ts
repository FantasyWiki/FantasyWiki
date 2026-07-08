import type { ContractDTO } from "../../../dto/contractDTO";
import type { LeagueDTO } from "../../../dto/leagueDTO";
import type { TeamDTO } from "../../../dto/teamDTO";
import type { NotificationDTO } from "../../../dto/notificationDTO";
import { Temporal } from "@js-temporal/polyfill";

const MAX_CONTRACTS = 22;

export function formatDuration(duration: Temporal.Duration): string {
  const totalSeconds = Math.floor(duration.total({ unit: "seconds" }));

  if (totalSeconds <= 0) return "0d, 00:00";

  const days = Math.floor(totalSeconds / 86400);

  if (days > 0) return `${days} d`;

  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");

  return `${hh}:${mm}`;
}

export function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return views.toString();
}

/** Contract prices (ADR 0005) are decimals — round to whole credits for display. */
export function formatPrice(price: number): string {
  return Math.round(price).toString();
}

export interface TeamPointsData {
  yesterdayPoints: number;
  pointsChange: number;
}

export class DashboardData {
  team: TeamDTO;
  league: LeagueDTO;
  contracts: ContractDTO[];
  notifications: NotificationDTO[];
  recentPoints: TeamPointsData;
  // rank, totalPlayers, and portfolioValue are pre-computed by the caller and
  // passed in: rank/totalPlayers come from the leaderboard response
  // (league.teams is always empty from the backend), and portfolioValue needs
  // live per-article pageview data that isn't on ContractDTO/ArticleDTO
  // (ADR 0005 — see computeCurrentPrice in types/articleDetail.ts).
  private readonly _rank: number;
  private readonly _totalPlayers: number;
  private readonly _portfolioValue: number;

  constructor(
    team: TeamDTO,
    league: LeagueDTO,
    contracts: ContractDTO[],
    notifications: NotificationDTO[],
    recentPoints: TeamPointsData,
    rank: number,
    totalPlayers: number,
    portfolioValue: number
  ) {
    this.team = team;
    this.league = league;
    this.contracts = contracts;
    this.notifications = notifications;
    this.recentPoints = recentPoints;
    this._rank = rank;
    this._totalPlayers = totalPlayers;
    this._portfolioValue = portfolioValue;
  }

  get portfolioValue(): number {
    return this._portfolioValue;
  }
  get maxContracts(): number {
    return MAX_CONTRACTS;
  }

  get totalPlayers(): number {
    return this._totalPlayers;
  }

  get activeContracts(): number {
    return this.contracts.length;
  }

  get rank(): number {
    return this._rank;
  }
}

// ── Session ──────────────────────────────────────────────────────────────────

export interface Session {
  sub: string;
  email: string;
  name: string;
  picture: string;
}
