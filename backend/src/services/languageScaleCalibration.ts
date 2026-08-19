import { Temporal } from "@js-temporal/polyfill";
import {
  ACCEPTANCE_MIN_DAILY_VIEWS,
  ACCEPTANCE_MIN_RANKS,
  CALIBRATION_WINDOW_DAYS,
  LanguageScale,
  RankedArticleViews,
  REFERENCE_DOMAIN,
  acceptanceQualifyingRanks,
  computeLanguageScale,
  countQualifyingRanksForDay,
  meetsAcceptanceFloor,
  rankByAverageViews,
} from "../../../model/languageScale";
import { isContentArticleTitle } from "../../../external-apis/wikimedia/wikimedia";
import type { WikimediaClient } from "../../../external-apis/wikimedia/client";
import { LanguageScaleRepository } from "../repositories/languageScaleRepository";
import { Result, failure, success } from "../repositories/result";

/**
 * Why an edition could not be given a Language Scale Factor.
 *
 * Owned here because this service is what produces them
 * (docs/architecture/backend-error-constants.md §1). The two are genuinely
 * different answers and a caller should treat them differently: `BELOW_FLOOR` is
 * a verdict about the edition and will not change if you retry, while
 * `UNAVAILABLE` is about Wikimedia and will.
 */
export const CALIBRATION_ERRORS = {
  BELOW_FLOOR: `This Wikipedia edition is too small for a league: it needs at least ${ACCEPTANCE_MIN_RANKS} articles averaging ${ACCEPTANCE_MIN_DAILY_VIEWS} views a day`,
  UNAVAILABLE: "Could not measure this Wikipedia edition right now",
} as const;

export type CalibrationError =
  (typeof CALIBRATION_ERRORS)[keyof typeof CALIBRATION_ERRORS];

/** One edition, measured: everything a calibration needs from the view data. */
interface DomainMeasurement {
  ranked: RankedArticleViews[];
  /** Median of the per-day qualifying counts — the floor's basis (ADR 0002). */
  qualifyingRanks: number;
  /** Last day actually covered, `YYYY-MM-DD`. */
  windowEnd: string;
}

/**
 * Measures and stores a Wikipedia edition's Language Scale Factor, so a league
 * can be founded on it.
 *
 * The shape of this service is dictated by one line of ADR 0002: calibration
 * "must complete and be **frozen before the first price is computed in a
 * domain**". So there is no background job and no placeholder to backfill — the
 * factor is measured, checked against the acceptance floor and persisted
 * *before* the league row exists, and if any of that fails the league is not
 * created.
 *
 * It is synchronous inside the Worker request, which ADR 0002 assumed was
 * impossible ("500 rank-matched 30-day-average lookups per domain is too much
 * work"). That assumption priced the expensive route: one `/per-article` series
 * per title, ~501 requests. Aggregating 30 daily `/top` lists instead gets the
 * same numbers in ~31 requests per edition, and the two agree on `L` to 0.1% at
 * the 500 ranks the formula uses — measured, not assumed
 * (docs/domain/language-editions.md). A first-time edition measures itself and
 * the reference, so ~61 requests; at Wikimedia's requested concurrency of 3 that
 * is a handful of seconds, which is slow for a form submit and much cheaper than
 * the two-phase creation a Workflow would force.
 */
export class LanguageScaleCalibrationService {
  private repository: LanguageScaleRepository;
  private wikimedia: WikimediaClient;

  constructor(deps: {
    languageScales: LanguageScaleRepository;
    // Injected rather than imported at module scope: the Workers test pool
    // silently no-ops `vi.mock`, so a client reached through the module graph
    // would be unmockable and every test would hit Wikimedia for real.
    wikimedia: WikimediaClient;
  }) {
    this.repository = deps.languageScales;
    this.wikimedia = deps.wikimedia;
  }

  /**
   * The frozen factor for an edition — read if it has one, measured and stored
   * if it does not.
   *
   * One path, no half state: a caller either gets a factor that is now
   * persisted, or a failure and no row written.
   */
  async resolve(domain: string): Promise<Result<LanguageScale>> {
    const stored = await this.repository.getByDomain(domain);
    if (!stored.ok) return stored;
    if (stored.value !== null) {
      // Already measured. Deliberately not re-checked against the floor or
      // re-measured: an edition already hosting leagues keeps the factor those
      // leagues were priced at.
      return success(stored.value);
    }

    const target = await this.measure(domain);
    if (!target.ok) return target;

    if (!meetsAcceptanceFloor(target.value.qualifyingRanks)) {
      return failure(CALIBRATION_ERRORS.BELOW_FLOOR);
    }

    // The reference edition is measured here too, every time, so a first-time
    // calibration is ~61 requests rather than ~31.
    //
    // ADR 0002 asks for the `en` side to be cached across calibrations, and this
    // deliberately does not: a cache would only ever save anything when two
    // never-played editions were founded within days of each other, and a game of
    // private leagues among friends opens new editions far more rarely than that.
    // Thirty requests on that rare occasion is the cheaper trade than a second
    // table with a staleness rule of its own to get wrong.
    const reference = await this.measure(REFERENCE_DOMAIN);
    if (!reference.ok) return reference;

    const computed = computeLanguageScale(
      reference.value.ranked,
      target.value.ranked,
    );
    if (computed === null) {
      return failure(CALIBRATION_ERRORS.UNAVAILABLE);
    }

    const scale: LanguageScale = {
      domain,
      scale: computed.scale,
      measuredAt: Temporal.Now.instant().toString(),
      qualifyingRanks: target.value.qualifyingRanks,
      sampleSize: computed.sampleSize,
      referenceDomain: REFERENCE_DOMAIN,
    };

    const saved = await this.repository.save(scale);
    if (!saved.ok) return saved;

    // Read back rather than returning what we just built. `save` is
    // insert-if-absent, so a concurrent first calibration of the same edition
    // may have won the race — and the value that must be frozen onto the league
    // is the one in the table, not the one this request measured.
    const persisted = await this.repository.getByDomain(domain);
    if (!persisted.ok) return persisted;
    return success(persisted.value ?? scale);
  }

  /**
   * One edition's 30-day view distribution, from 30 daily top-read lists.
   *
   * The two figures it produces are counted on deliberately different bases,
   * and `model/languageScale.ts` says why at length: the ratio wants each
   * title's window mean, while the acceptance floor has to be counted within
   * each day, because a list truncated at ~1,000 titles gives a borderline title
   * no figure at all on the days it fell off — and a mean that reads those days
   * as zero is exactly wrong about the editions the floor is meant to judge.
   */
  private async measure(domain: string): Promise<Result<DomainMeasurement>> {
    // The two casts in this method are the whole of `Domain`'s remaining
    // dishonesty: it is typed `"en" | "it"` while everything underneath it
    // interpolates any language code, and calibrating an edition we have never
    // seen is precisely the operation that cannot pretend otherwise. #531
    // opens the type and deletes both.
    const edition = domain;

    let namespaces;
    let days;
    try {
      // One request, and the reason the filter generalises past English:
      // `Categoria:` and `Speciale:` are not in any hardcoded list (ADR 0002).
      namespaces = await this.wikimedia.site.getNamespaces(edition);
      days = await this.wikimedia.pageviews.getDailyTopWindow(
        edition,
        CALIBRATION_WINDOW_DAYS,
      );
    } catch {
      return failure(CALIBRATION_ERRORS.UNAVAILABLE);
    }

    const present = days.filter(
      (day): day is NonNullable<typeof day> =>
        day !== null && day.articles.length > 0,
    );
    if (present.length === 0) {
      // No list at all, for thirty days: either the edition does not exist or
      // Wikimedia is down. Both are "cannot measure", not "too small" — telling
      // a player their edition is too small when we never reached the API would
      // be a lie the retry would contradict.
      return failure(CALIBRATION_ERRORS.UNAVAILABLE);
    }

    const totalViewsByTitle = new Map<string, number>();
    const dailyQualifyingCounts: number[] = [];

    for (const day of present) {
      const articleViews: number[] = [];
      for (const article of day.articles) {
        if (!isContentArticleTitle(article.article, namespaces)) continue;
        totalViewsByTitle.set(
          article.article,
          (totalViewsByTitle.get(article.article) ?? 0) + article.views,
        );
        articleViews.push(article.views);
      }
      dailyQualifyingCounts.push(countQualifyingRanksForDay(articleViews));
    }

    return success({
      ranked: rankByAverageViews(totalViewsByTitle, present.length),
      qualifyingRanks: acceptanceQualifyingRanks(dailyQualifyingCounts),
      // The window runs backwards from the most recent day, so the first entry
      // that had data is the window's end.
      windowEnd: present[0].date,
    });
  }
}
