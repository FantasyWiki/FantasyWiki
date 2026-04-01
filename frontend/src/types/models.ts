import type { ContractDTO } from "../../../dto/contractDTO";
import type { LeagueDTO } from "../../../dto/leagueDTO";
import type { TeamDTO } from "../../../dto/teamDTO";
import type { NotificationDTO } from "../../../dto/notificationDTO";

const MAX_CONTRACTS = 22

export class DashboardData {
  team: TeamDTO;
  league: LeagueDTO;
  contracts: ContractDTO[];
  notifications: NotificationDTO[];

  constructor(team: TeamDTO, league: LeagueDTO, contracts: ContractDTO[], notifications: NotificationDTO[]) {
    this.team = team;
    this.league = league;
    this.contracts = contracts;
    this.notifications = notifications;
  }

  //TODO: to change with the current price that i still don't know how to get it
  get portfolioValue(): number {
    return this.contracts.reduce((total, c) => total + c.purchasePrice, 0);
  }
  get maxContracts(): number {
    return MAX_CONTRACTS;
  }

  get totalPLayers(): number {
    return this.league.teams.length;
  }

  get activeContracts(): number {
    return this.contracts.length;
  }

  get rank(): number {
    return this.league.teams
      .sort((a, b) => b.points - a.points)
      .findIndex(t => t.id === this.team.id) + 1;
  }

  //this data should be computed after fetching the points data
  //yesterdayPoints: number;
  //pointsChange: number;

}

// ── Trade Proposals ──────────────────────────────────────────────────────────

