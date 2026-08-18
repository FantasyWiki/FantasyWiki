import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect, beforeEach } from "vitest";
import {
  LeagueService,
  GLOBAL_LEAGUE_ID,
  toLeagueDTO,
} from "../../services/league";
import { LEAGUE_ERRORS } from "../../repositories/leagueRepository";
import { LeagueRepository } from "../../repositories/leagueRepository";
import { success, failure } from "../../repositories/result";
import { aLeague, aPlayer } from "../support/subjects";
import { repositories } from "../support/target";
import { League } from "../../../../model";
import { LeagueInvitePolicy, LeagueVisibility } from "../../../../model/enums";
import { fakeLeagueRepository } from "../utils/fakeRepositories";
import { REFERENCE_SCALE } from "../../../../model/languageScale";

describe("LeagueService Integration Tests", () => {
  let leagueService: LeagueService;

  beforeEach(() => {
    leagueService = new LeagueService(repositories());
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

    // The Global League is seeded by migration, so its absence is not a state
    // to create — what matters is that this asks for that one fixed id and
    // passes the miss through.
    it("should ask for the Global League by its fixed id", async () => {
      let requested: string | undefined;
      const service = new LeagueService({
        leagues: fakeLeagueRepository({
          getById: async (id) => {
            requested = id;
            return failure(LEAGUE_ERRORS.NOT_FOUND);
          },
        }),
      });

      const result = await service.getGlobalLeague();

      expect(requested).toBe(GLOBAL_LEAGUE_ID);
      expect(result).toEqual(failure(LEAGUE_ERRORS.NOT_FOUND));
    });

    it("should propagate a failure from an injected repository", async () => {
      const failingRepository: LeagueRepository = fakeLeagueRepository({
        getById: async () => failure("boom"),
      });
      const service = new LeagueService({ leagues: failingRepository });

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
        languageScale: REFERENCE_SCALE,
        visibility: LeagueVisibility.PUBLIC,
        invitePolicy: LeagueInvitePolicy.MEMBERS,
        closedAt: null,
        icon: "🌍",
      };

      const repository: LeagueRepository = fakeLeagueRepository({
        getById: async () => success(league),
        countTeamsByLeague: async () => success({ [GLOBAL_LEAGUE_ID]: 3 }),
      });
      const service = new LeagueService({ leagues: repository });

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
        languageScale: REFERENCE_SCALE,
        visibility: LeagueVisibility.PUBLIC,
        invitePolicy: LeagueInvitePolicy.MEMBERS,
        closedAt: null,
        icon: "🌍",
      };
      // A league whose size could not be read must not be reported as one
      // nobody has joined; the count failing fails the whole read.
      const repository: LeagueRepository = fakeLeagueRepository({
        getById: async () => success(league),
        countTeamsByLeague: async () => failure("count exploded"),
      });

      const result = await new LeagueService({
        leagues: repository,
      }).getGlobalLeague();

      expect(result).toEqual(failure("count exploded"));
    });
  });

  describe("getLeagueById", () => {
    it("should return a league the player has not necessarily joined", async () => {
      const { league } = await aLeague(
        {
          name: "Friday Night Wiki",
          adminId: await aPlayer(),
          startDate: Temporal.Instant.from("2026-01-01T00:00:00Z"),
          endDate: Temporal.Instant.from("2026-03-01T00:00:00Z"),
          domain: "it",
          languageScale: REFERENCE_SCALE,
          icon: "🍕",
          visibility: LeagueVisibility.PUBLIC,
          invitePolicy: LeagueInvitePolicy.MEMBERS,
          invitationCode: null,
        },
        "Pizza Founders",
      );

      const result = await leagueService.getLeagueById(league.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toMatchObject({
          id: league.id,
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
      // Deliberately not the reference: a mapping that defaulted the factor
      // rather than carrying the league's own would still pass at 1.0.
      languageScale: 13.9,
      visibility: LeagueVisibility.PUBLIC,
      invitePolicy: LeagueInvitePolicy.MEMBERS,
      closedAt: null,
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
      closedAt: null,
      languageScale: 13.9,
    });
  });
});
