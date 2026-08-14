import { Repositories } from "../repositories";
import { ContractRepositoryD1 } from "./contractRepositoryD1";
import { LanguageScaleRepositoryD1 } from "./languageScaleRepositoryD1";
import { LeagueRepositoryD1 } from "./leagueRepositoryD1";
import { LineupRepositoryD1 } from "./lineupRepositoryD1";
import { NotificationRepositoryD1 } from "./notificationRepositoryD1";
import { PerformanceRepositoryD1 } from "./performanceRepositoryD1";
import { PlayerRepositoryD1 } from "./playerRepositoryD1";
import { ScoringRepositoryD1 } from "./scoringRepositoryD1";
import { TeamRepositoryD1 } from "./teamRepositoryD1";

/** The D1-backed {@link Repositories}. The only place the whole set is named. */
export function d1Repositories(db: D1Database): Repositories {
  return {
    players: new PlayerRepositoryD1(db),
    teams: new TeamRepositoryD1(db),
    leagues: new LeagueRepositoryD1(db),
    contracts: new ContractRepositoryD1(db),
    lineups: new LineupRepositoryD1(db),
    notifications: new NotificationRepositoryD1(db),
    performances: new PerformanceRepositoryD1(db),
    scoring: new ScoringRepositoryD1(db),
    languageScales: new LanguageScaleRepositoryD1(db),
  };
}
