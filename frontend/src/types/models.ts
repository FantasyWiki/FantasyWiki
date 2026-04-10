import type { ContractDTO } from "../../../dto/contractDTO";
import type { LeagueDTO } from "../../../dto/leagueDTO";
import type { TeamDTO } from "../../../dto/teamDTO";
import type { NotificationDTO } from "../../../dto/notificationDTO";

const MAX_CONTRACTS = 22;

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

  constructor(
    team: TeamDTO,
    league: LeagueDTO,
    contracts: ContractDTO[],
    notifications: NotificationDTO[],
    recentPoints: TeamPointsData
  ) {
    this.team = team;
    this.league = league;
    this.contracts = contracts;
    this.notifications = notifications;
    this.recentPoints = recentPoints;
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
    const rank = [...this.league.teams];
    return (
      rank
        .sort((a, b) => b.points - a.points)
        .findIndex((t) => t.id === this.team.id) + 1
    );
  }
}
