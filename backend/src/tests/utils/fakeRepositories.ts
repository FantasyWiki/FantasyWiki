import { League } from "../../../../model";
import {
  LEAGUE_ERRORS,
  LeagueRepository,
} from "../../repositories/leagueRepository";
import { TeamRepository } from "../../repositories/teamRepository";
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
    findIdByInvitationCode: async () => success(null),
    listPublic: async () => success([]),
    createWithFoundingTeam: async () =>
      failure("createWithFoundingTeam not stubbed"),
    countTeamsByLeague: async (ids) =>
      success(Object.fromEntries([...ids].map((id) => [id, 0]))),
    close: async () => failure("close not stubbed"),
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

/**
 * A `TeamRepository` double, for the same reason as `fakeLeagueRepository`
 * above: most callers only care about `getByPlayerAndLeague`, and hand-written
 * literals silently stop satisfying the interface every time it grows.
 *
 * The defaults answer "no team here, and nothing stubbed" — a fake that fails
 * loudly when a test reaches a method it never meant to.
 */
export function fakeTeamRepository(
  overrides: Partial<TeamRepository> = {},
): TeamRepository {
  return {
    create: async () => failure("create not stubbed"),
    rejoin: async () => failure("rejoin not stubbed"),
    existsByNameInLeague: async () => success(false),
    getByPlayerAndLeague: async () => success(null),
    getMembership: async () => success(null),
    leave: async () => failure("leave not stubbed"),
    ...overrides,
  };
}
