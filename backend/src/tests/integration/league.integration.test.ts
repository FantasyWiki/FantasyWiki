import { env } from "cloudflare:workers";
import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import {
  LeagueService,
  GLOBAL_LEAGUE_ID,
  toLeagueDTO,
} from "../../services/league";
import { LEAGUE_ERRORS } from "../../repositories/leagueRepository";
import { LeagueRepositoryD1 } from "../../repositories/d1/leagueRepositoryD1";
import { LeagueRepository } from "../../repositories/leagueRepository";
import { success, failure } from "../../repositories/result";
import { PlayerService } from "../../services/player";
import { insertTeam } from "../utils/d1TestUtils";
import { League } from "../../../../model";
import { LeagueInvitePolicy, LeagueVisibility } from "../../../../model/enums";
import { fakeLeagueRepository } from "../utils/fakeRepositories";

describe("LeagueService Integration Tests", () => {
  let leagueService: LeagueService;

  beforeEach(() => {
    leagueService = new LeagueService(env.db);
  });

  describe("getGlobalLeague", () => {
    it("should return the Global League seeded by the migration", async () => {
      const result = await leagueService.getGlobalLeague();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe(GLOBAL_LEAGUE_ID);
        expect(result.value.title).toBe("Global League");
        expect(result.value.domain).toBe("en");
        expect(result.value.icon).toBe("🌍");
      }
    });

    it("should return a failure when the Global League does not exist", async () => {
      await env.db
        .prepare("DELETE FROM leagues WHERE id = ?")
        .bind(GLOBAL_LEAGUE_ID)
        .run();

      const result = await leagueService.getGlobalLeague();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(LEAGUE_ERRORS.NOT_FOUND);
      }
    });

    it("should propagate a failure from an injected repository", async () => {
      const failingRepository: LeagueRepository = fakeLeagueRepository({
        getById: async () => failure("boom"),
      });
      const service = new LeagueService(failingRepository);

      const result = await service.getGlobalLeague();

      expect(result).toEqual(failure("boom"));
    });

    it("should map a league returned by an injected repository to a LeagueDTO", async () => {
      const league: League = {
        id: GLOBAL_LEAGUE_ID,
        name: "Global League",
        adminId: "system",
        startDate: Temporal.Now.instant(),
        endDate: Temporal.Now.instant(),
        domain: "en",
        visibility: LeagueVisibility.PUBLIC,
        invitePolicy: LeagueInvitePolicy.MEMBERS,
        icon: "🌍",
      };

      const repository: LeagueRepository = fakeLeagueRepository({
        getById: async () => success(league),
        countTeamsByLeague: async () => success({ [GLOBAL_LEAGUE_ID]: 3 }),
      });
      const service = new LeagueService(repository);

      const result = await service.getGlobalLeague();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toMatchObject({
          id: league.id,
          title: league.name,
          domain: league.domain,
          icon: league.icon,
          teamCount: 3,
        });
      }
    });

    it("should fail the read when the team count cannot be read", async () => {
      const league: League = {
        id: GLOBAL_LEAGUE_ID,
        name: "Global League",
        adminId: "system",
        startDate: Temporal.Now.instant(),
        endDate: Temporal.Now.instant(),
        domain: "en",
        visibility: LeagueVisibility.PUBLIC,
        invitePolicy: LeagueInvitePolicy.MEMBERS,
        icon: "🌍",
      };
      // A league whose size could not be read must not be reported as one
      // nobody has joined; the count failing fails the whole read.
      const repository: LeagueRepository = fakeLeagueRepository({
        getById: async () => success(league),
        countTeamsByLeague: async () => failure("count exploded"),
      });

      const result = await new LeagueService(repository).getGlobalLeague();

      expect(result).toEqual(failure("count exploded"));
    });
  });

  describe("getLeagueById", () => {
    it("should return a league the player has not necessarily joined", async () => {
      await env.db
        .prepare(
          "INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          "league-friends",
          "Friday Night Wiki",
          "system",
          "2026-01-01T00:00:00Z",
          "2026-03-01T00:00:00Z",
          "it",
          "🍕",
        )
        .run();

      const result = await leagueService.getLeagueById("league-friends");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toMatchObject({
          id: "league-friends",
          title: "Friday Night Wiki",
          domain: "it",
          icon: "🍕",
        });
        expect(result.value.startDate.toString()).toContain("2026-01-01");
      }
    });

    it("should fail with NOT_FOUND for an unknown id", async () => {
      const result = await leagueService.getLeagueById("no-such-league");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(LEAGUE_ERRORS.NOT_FOUND);
      }
    });
  });
});

describe("toLeagueDTO", () => {
  it("maps a domain League to the list-endpoint LeagueDTO shape", () => {
    const startDate = Temporal.Instant.from("2026-01-01T00:00:00Z");
    const endDate = Temporal.Instant.from("2026-12-31T00:00:00Z");
    const league: League = {
      id: "league-7",
      name: "Trivia Titans",
      adminId: "player-1",
      startDate,
      endDate,
      domain: "it",
      visibility: LeagueVisibility.PUBLIC,
      invitePolicy: LeagueInvitePolicy.MEMBERS,
      icon: "🏆",
    };

    const dto = toLeagueDTO(league, 12);

    expect(dto).toEqual({
      id: "league-7",
      title: "Trivia Titans",
      domain: "it",
      icon: "🏆",
      startDate,
      endDate,
      visibility: LeagueVisibility.PUBLIC,
      teamCount: 12,
    });
  });
});

describe("LeagueRepositoryD1.countTeamsByLeague", () => {
  const repository = () => new LeagueRepositoryD1(env.db);

  async function insertLeague(id: string) {
    await env.db
      .prepare(
        "INSERT INTO leagues (id, name, adminId, startDate, endDate, domain, icon) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        `League ${id}`,
        "system",
        "2026-01-01T00:00:00Z",
        "2026-03-01T00:00:00Z",
        "en",
        "🏁",
      )
      .run();
  }

  async function addTeam(id: string, leagueId: string) {
    const player = await new PlayerService(env.db).createPlayer(
      `p-${id}`,
      `${id}@example.com`,
      `acct-${id}`,
    );
    if (!player.ok) throw new Error("setup failed");
    await insertTeam(env.db, {
      id,
      name: `Team ${id}`,
      playerId: player.value.id,
      leagueId,
    });
  }

  it("counts every team in each requested league", async () => {
    await insertLeague("count-a");
    await insertLeague("count-b");
    await addTeam("t-a1", "count-a");
    await addTeam("t-a2", "count-a");
    await addTeam("t-b1", "count-b");

    const result = await repository().countTeamsByLeague([
      "count-a",
      "count-b",
    ]);

    expect(result).toEqual(success({ "count-a": 2, "count-b": 1 }));
  });

  it("reports a league nobody has joined as 0 rather than omitting it", async () => {
    await insertLeague("count-empty");

    const result = await repository().countTeamsByLeague(["count-empty"]);

    // The caller indexes by id to build a DTO; a missing key would read as
    // undefined and render a blank where a zero belongs.
    expect(result).toEqual(success({ "count-empty": 0 }));
  });

  it("reports an id that is not a league at all as 0", async () => {
    const result = await repository().countTeamsByLeague(["no-such-league"]);

    expect(result).toEqual(success({ "no-such-league": 0 }));
  });

  it("does not query at all for an empty id list", async () => {
    // An empty `IN ()` is a SQLite syntax error, so the short-circuit is load
    // bearing, not an optimisation.
    const throwingDb = {
      prepare: () => {
        throw new Error("should not have been queried");
      },
    } as unknown as D1Database;

    const result = await new LeagueRepositoryD1(throwingDb).countTeamsByLeague(
      [],
    );

    expect(result).toEqual(success({}));
  });

  it("counts only the requested leagues", async () => {
    await insertLeague("count-asked");
    await insertLeague("count-unasked");
    await addTeam("t-asked", "count-asked");
    await addTeam("t-unasked", "count-unasked");

    const result = await repository().countTeamsByLeague(["count-asked"]);

    expect(result).toEqual(success({ "count-asked": 1 }));
  });
});

describe("LeagueRepositoryD1 error handling", () => {
  it("should return a failure when the underlying D1 query throws", async () => {
    const throwingDb = {
      prepare: () => {
        throw new Error("D1 unavailable");
      },
    } as unknown as D1Database;

    const repository = new LeagueRepositoryD1(throwingDb);
    const result = await repository.getById(GLOBAL_LEAGUE_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("D1 unavailable");
    }
  });
});
