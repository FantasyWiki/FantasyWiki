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
  // Both rank and totalPlayers are pre-computed from the leaderboard response
  // and passed in by the caller — league.teams is always empty from the backend.
  private readonly _rank: number;
  private readonly _totalPlayers: number;

  constructor(
    team: TeamDTO,
    league: LeagueDTO,
    contracts: ContractDTO[],
    notifications: NotificationDTO[],
    recentPoints: TeamPointsData,
    rank: number,
    totalPlayers: number
  ) {
    this.team = team;
    this.league = league;
    this.contracts = contracts;
    this.notifications = notifications;
    this.recentPoints = recentPoints;
    this._rank = rank;
    this._totalPlayers = totalPlayers;
  }

  //TODO: to change with the current price that i still don't know how to get it
  get portfolioValue(): number {
    return this.contracts.reduce((total, c) => total + c.purchasePrice, 0);
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
