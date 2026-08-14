import { ContractRepository } from "./contractRepository";
import { LanguageScaleRepository } from "./languageScaleRepository";
import { LeagueRepository } from "./leagueRepository";
import { LineupRepository } from "./lineupRepository";
import { NotificationRepository } from "./notificationRepository";
import { PerformanceRepository } from "./performanceRepository";
import { PlayerRepository } from "./playerRepository";
import { ScoringRepository } from "./scoringRepository";
import { TeamRepository } from "./teamRepository";

/**
 * Every repository the backend needs, named by its interface. A target
 * provides one of these (see `d1Repositories`) and nothing above this layer
 * has to know which one it got — that is what lets the integration tests run
 * unchanged against a second implementation.
 */
export interface Repositories {
  players: PlayerRepository;
  teams: TeamRepository;
  leagues: LeagueRepository;
  contracts: ContractRepository;
  lineups: LineupRepository;
  notifications: NotificationRepository;
  performances: PerformanceRepository;
  scoring: ScoringRepository;
  languageScales: LanguageScaleRepository;
}
