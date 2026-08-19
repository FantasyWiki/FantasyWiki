import { Repositories } from "../repositories";
import type { MongoTarget } from "./connection";
import { ContractRepositoryMongo } from "./contractRepositoryMongo";
import { LanguageScaleRepositoryMongo } from "./languageScaleRepositoryMongo";
import { LeagueRepositoryMongo } from "./leagueRepositoryMongo";
import { LineupRepositoryMongo } from "./lineupRepositoryMongo";
import { NotificationRepositoryMongo } from "./notificationRepositoryMongo";
import { PerformanceRepositoryMongo } from "./performanceRepositoryMongo";
import { PlayerRepositoryMongo } from "./playerRepositoryMongo";
import { ScoringRepositoryMongo } from "./scoringRepositoryMongo";
import { MongoStore } from "./store";
import { TeamRepositoryMongo } from "./teamRepositoryMongo";

export type { MongoTarget } from "./connection";

/**
 * The Mongo-backed {@link Repositories}. The only place the whole set is named,
 * mirroring `d1Repositories`.
 *
 * Synchronous, like its D1 counterpart, because `repositoriesFor` is — the
 * connection is opened on the first call that needs it and shared from there
 * (see {@link MongoStore}).
 */
export function mongoRepositories(target: MongoTarget): Repositories {
  const store = new MongoStore(target);
  return {
    players: new PlayerRepositoryMongo(store),
    teams: new TeamRepositoryMongo(store),
    leagues: new LeagueRepositoryMongo(store),
    contracts: new ContractRepositoryMongo(store),
    lineups: new LineupRepositoryMongo(store),
    notifications: new NotificationRepositoryMongo(store),
    performances: new PerformanceRepositoryMongo(store),
    scoring: new ScoringRepositoryMongo(store),
    languageScales: new LanguageScaleRepositoryMongo(store),
  };
}
