import { describe, it, expect, beforeEach } from "vitest";
import {
  ACCEPTANCE_MIN_DAILY_VIEWS,
  CALIBRATION_WINDOW_DAYS,
  REFERENCE_DOMAIN,
} from "../../../../model/languageScale";
import { LeagueInvitePolicy, LeagueVisibility } from "../../../../model/enums";
import { LEAGUE_ICONS } from "../../../../model/league";
import { unwrap } from "../../repositories/result";
import {
  CALIBRATION_ERRORS,
  LanguageScaleCalibrationService,
} from "../../services/languageScaleCalibration";
import { LEAGUE_CREATION_ERRORS, LeagueService } from "../../services/league";
import { PlayerService } from "../../services/player";
import type { WikimediaClient } from "../../../../external-apis/wikimedia/client";
import type { CreateLeagueRequest } from "../../../../dto/leagueDTO";
import { repositories } from "../support/target";

/**
 * A Wikimedia client that answers from a per-edition view profile instead of the
 * network.
 *
 * Injected rather than mocked: `vi.mock` silently no-ops under the Workers test
 * pool, so a client reached through the module graph would quietly become the
 * real one and every test here would spend thirty requests on live Wikipedia
 * data whose numbers change daily.
 *
 * `viewsAtRank` shapes an edition — its rank-1 views and how fast the tail
 * falls — which is exactly the two properties the formula and the floor read.
 */
function fakeWikimedia(
  profiles: Record<string, { top: number; ranks: number; decay?: number }>,
): { client: WikimediaClient; requests: () => number } {
  let requestCount = 0;

  const articles = (domain: string) => {
    const profile = profiles[domain];
    if (!profile) return [];
    const decay = profile.decay ?? 0.995;
    return Array.from({ length: profile.ranks }, (_, index) => ({
      article: index === 0 ? `Main_Page` : `Article_${index}`,
      views: Math.max(1, Math.round(profile.top * Math.pow(decay, index))),
      rank: index + 1,
    }));
  };

  const client = {
    pageviews: {
      async getDailyTopArticles(domain: string, date: Date) {
        requestCount += 1;
        return {
          domain,
          date: date.toISOString().slice(0, 10),
          articles: articles(domain),
        };
      },
      async getDailyTopWindow(domain: string, days: number) {
        return Promise.all(
          Array.from({ length: days }, (_, index) => {
            const date = new Date();
            date.setUTCDate(date.getUTCDate() - (index + 1));
            return client.pageviews.getDailyTopArticles(domain, date);
          }),
        );
      },
    },
    site: {
      async getNamespaces(domain: string) {
        requestCount += 1;
        return {
          domain,
          nonArticlePrefixes: ["Wikipedia:", "Speciale:"],
          mainPageTitle: "Main_Page",
        };
      },
    },
  } as unknown as WikimediaClient;

  return { client, requests: () => requestCount };
}

/** An edition big enough to pass the floor comfortably, `en`-sized. */
const BIG = { top: 400_000, ranks: 1_000, decay: 0.996 };
/** The same shape at a tenth the traffic — passes, and should measure L ≈ 10. */
const TENTH = { top: 40_000, ranks: 1_000, decay: 0.996 };
/** Real but thin: only a handful of articles ever clear 50 views/day. */
const TINY = { top: 900, ranks: 700, decay: 0.97 };

function service(profiles: Parameters<typeof fakeWikimedia>[0]) {
  const { client, requests } = fakeWikimedia(profiles);
  return {
    calibration: new LanguageScaleCalibrationService({
      ...repositories(),
      wikimedia: client,
    }),
    requests,
  };
}

describe("the seeded registry", () => {
  it("survives the per-test data reset", async () => {
    // The seed is reference data, not test fixture: the per-test reset must not
    // clear it, or every league creation below would trigger a live calibration.
    const repository = repositories().languageScales;

    const en = await repository.getByDomain("en");

    expect(en.ok && en.value).not.toBeNull();
  });

  it("knows nothing about an edition never played", async () => {
    const repository = repositories().languageScales;

    const result = await repository.getByDomain("de");

    expect(result.ok && result.value).toBeNull();
  });
});

describe("LanguageScaleCalibrationService.resolve", () => {
  it("measures a new edition against the reference and stores it", async () => {
    const { calibration } = service({ en: BIG, de: TENTH });

    const result = await calibration.resolve("de");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Same distribution shape at a tenth the volume, so every rank-matched ratio
    // is 10 and so is their median.
    expect(result.value.scale).toBeCloseTo(10, 5);
    expect(result.value.referenceDomain).toBe(REFERENCE_DOMAIN);
    expect(result.value.sampleSize).toBe(500);
    expect(result.value.measuredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Persisted before returning, which is the invariant: no league may be
    // written against a factor that is not in the table yet.
    const stored = await repositories().languageScales.getByDomain("de");
    expect(stored.ok && stored.value?.scale).toBeCloseTo(10, 5);
  });

  it("refuses an edition below the acceptance floor, and stores nothing", async () => {
    const { calibration } = service({ en: BIG, la: TINY });

    const result = await calibration.resolve("la");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(CALIBRATION_ERRORS.BELOW_FLOOR);

    const stored = await repositories().languageScales.getByDomain("la");
    expect(stored.ok && stored.value).toBeNull();
  });

  it("tells an unreachable edition apart from a small one", async () => {
    // No profile at all: every day comes back empty. Answering BELOW_FLOOR here
    // would tell a player their edition is too small when we never reached the
    // API — a lie their next retry would contradict.
    const { calibration } = service({ en: BIG });

    const result = await calibration.resolve("nl");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(CALIBRATION_ERRORS.UNAVAILABLE);
  });

  it("keeps the first measurement when a second calibration races it", async () => {
    const { calibration } = service({ en: BIG, de: TENTH });
    const first = await calibration.resolve("de");

    // A second service measuring the same edition against a *different*
    // reference profile would compute a different factor. The stored one wins:
    // `save` is insert-if-absent, because overwriting re-rates live contracts.
    const other = service({
      en: { top: 800_000, ranks: 1_000, decay: 0.996 },
      de: TENTH,
    });
    const second = await other.calibration.resolve("de");

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.scale).toBe(first.value.scale);
  });

  it("filters non-article pages out of the ranking", async () => {
    // The fake puts `Main_Page` at rank 1 on every edition. If it survived the
    // namespace filter it would anchor both sides of the ratio.
    const { calibration } = service({ en: BIG, de: TENTH });

    const result = await calibration.resolve("de");

    // Rank 1 dropped from both sides shifts nothing, because the profiles are
    // the same shape — the point is that it stays 10 rather than skewing.
    expect(result.ok && result.value.scale).toBeCloseTo(10, 5);
  });

  it("costs two 30-day windows and two siteinfo reads, and no more", async () => {
    const { calibration, requests } = service({ en: BIG, de: TENTH });

    await calibration.resolve("de");

    // The budget issue #532 set: ~61 requests to calibrate an edition — its own
    // 30-day window and the reference's — against the ~501 the per-article route
    // would have cost. Anything much larger means a fan-out crept back in.
    expect(requests()).toBe(2 * CALIBRATION_WINDOW_DAYS + 2);
  });
});

describe("founding a league on an edition", () => {
  async function makePlayer(name: string) {
    const result = await new PlayerService(repositories()).createPlayer(
      name,
      `${name}@example.com`,
      `acct-${name}`,
    );
    if (!result.ok) throw new Error("setup failed");
    return result.value;
  }

  function request(
    overrides: Partial<CreateLeagueRequest> = {},
  ): CreateLeagueRequest {
    return {
      name: "Sunday Scholars",
      icon: LEAGUE_ICONS[0],
      domain: "en",
      duration: "1m",
      visibility: LeagueVisibility.PUBLIC,
      invitePolicy: LeagueInvitePolicy.MEMBERS,
      teamName: "Wiki Wanderers",
      ...overrides,
    };
  }

  let leagues: LeagueService;

  beforeEach(() => {
    const { client } = fakeWikimedia({ en: BIG, de: TENTH, la: TINY });
    leagues = new LeagueService({
      ...repositories(),
      calibration: new LanguageScaleCalibrationService({
        ...repositories(),
        wikimedia: client,
      }),
    });
  });

  it("calibrates a never-played edition before the league exists", async () => {
    const player = await makePlayer("pioneer");

    const result = await leagues.createLeague(
      player.id,
      request({ domain: "de" }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.languageScale).toBeCloseTo(10, 5);

    const stored = await repositories().languageScales.getByDomain("de");
    expect(stored.ok && stored.value?.scale).toBeCloseTo(10, 5);
  });

  it("refuses an edition below the floor and writes no league at all", async () => {
    const player = await makePlayer("optimist");

    const result = await leagues.createLeague(
      player.id,
      request({ domain: "la" }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(CALIBRATION_ERRORS.BELOW_FLOOR);

    // The half state ADR 0002 rules out: no league on that edition, and no team
    // for the player who asked for it — the founding team is written in the same
    // transaction, so a league missing from both reads leaves nothing behind.
    const published = unwrap(
      await repositories().leagues.listPublic(100),
      "public leagues",
    );
    expect(published.map((league) => league.domain)).not.toContain("la");
    const joined = unwrap(
      await repositories().players.getLeaguesByPlayerId(player.id),
      "leagues joined",
    );
    expect(joined).toEqual([]);
  });

  it("prices a league on a scaled edition above one on the reference", async () => {
    // Why any of this matters: the same article is worth more in a smaller
    // edition, because 1,000 views there is a bigger share of its readership.
    // At the old hardcoded fallback both leagues would have priced identically.
    const player = await makePlayer("comparer");

    const reference = await leagues.createLeague(player.id, request());
    const scaled = await leagues.createLeague(
      player.id,
      request({ domain: "de", teamName: "Andere" }),
    );

    expect(reference.ok && scaled.ok).toBe(true);
    if (!reference.ok || !scaled.ok) return;
    expect(scaled.value.languageScale).toBeGreaterThan(
      reference.value.languageScale,
    );
  });

  it("refuses to found a league at all when nothing can resolve a factor", async () => {
    // A service handed only a repository has no calibrator. Refusing is the
    // point: the alternative is defaulting the factor to 1.0, which is precisely
    // the silent mis-pricing this whole path exists to prevent. Unreachable from
    // the route layer, which always constructs the calibrator alongside it.
    const player = await makePlayer("unwired");
    const bare = new LeagueService({ leagues: repositories().leagues });

    const result = await bare.createLeague(player.id, request());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(LEAGUE_CREATION_ERRORS.UNCALIBRATED_DOMAIN);
  });

  it("keeps the acceptance floor's threshold in the refusal a player reads", () => {
    // The message names the numbers, so a refused player learns what the edition
    // was missing rather than only that it was refused.
    expect(CALIBRATION_ERRORS.BELOW_FLOOR).toContain(
      String(ACCEPTANCE_MIN_DAILY_VIEWS),
    );
  });
});
