import { League } from "../../../../model";
import {
  LEAGUE_ERRORS,
  LeagueRepository,
} from "../../repositories/leagueRepository";
import { Result, failure, success } from "../../repositories/result";

/**
 * A `LeagueRepository` double that satisfies the whole interface, with every
 * method overridable.
 *
 * Most tests that need one only care about `getById` and used to write a
 * one-method object literal cast to the interface. That quietly rotted: the
 * backend tsconfig excludes `src/tests`, so when the interface grew a method
 * nothing complained, and several fakes had been missing `countTeamsByLeague`
 * since it was added. Building them here means the next method to arrive
 * breaks one file instead of eight.
 */
export function fakeLeagueRepository(
  overrides: Partial<LeagueRepository> = {},
): LeagueRepository {
  return {
    getById: async () => failure(LEAGUE_ERRORS.NOT_FOUND),
    getInvitationCode: async () => success(null),
    countTeamsByLeague: async (ids) =>
      success(Object.fromEntries([...ids].map((id) => [id, 0]))),
    ...overrides,
  };
}

/** The common case: a repository that always answers with this one league. */
export function leagueRepositoryReturning(
  league: League,
  overrides: Partial<LeagueRepository> = {},
): LeagueRepository {
  return fakeLeagueRepository({
    getById: async (): Promise<Result<League>> => success(league),
    ...overrides,
  });
}
