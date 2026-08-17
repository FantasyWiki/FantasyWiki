import type { WikipediaEditionDTO } from "../../../dto/wikipediaEditionDTO";
import type { WikimediaClient } from "../../../external-apis/wikimedia/client";
import { createWikimediaClient } from "./wikimediaClient";
import { Result, failure, success } from "../repositories/result";

export const EDITION_ERRORS = {
  UNAVAILABLE: "Could not list Wikipedia editions right now",
} as const;

/**
 * The Wikipedia editions the edition picker offers, straight from Wikimedia's own
 * registry (#531).
 *
 * This is what replaces `LEAGUE_DOMAINS`, a hand-maintained constant of two
 * codes: which editions exist is Sitematrix's answer, not ours, and it is one
 * request rather than a table to keep in step.
 *
 * That request is made **per call**, not cached. The shared client's cache is
 * `localStorage`, which does not exist in a Worker (`getDefaultCache` returns
 * `null` there), so the 30-day TTL the capability declares only ever applies in
 * the browser. Accepted rather than worked around: the payload is a few hundred
 * rows fetched once per visit to the create-league form, the client caches the
 * *response* for the session (`staleTime: Infinity` in `useWikipediaEditions`), and
 * a Worker-side cache would mean either a KV binding this project does not have or
 * another table — which is the machinery this endpoint exists to avoid.
 *
 * **Every live edition is offered, including ones too small to host a league.**
 * That is a deliberate trade rather than an oversight. Filtering the list would
 * mean measuring all ~348 editions' pageviews on a schedule — a scheduled job, a
 * table and a staleness rule — to spare a player from picking one of the few
 * dozen that will be refused. Instead the refusal happens where the measurement
 * already happens: league creation calibrates the chosen edition and turns it down
 * with a message naming what it was short of (ADR 0002's floor, via
 * `LanguageScaleCalibrationService`). One gate, measured properly, and no second
 * copy of the floor to keep in agreement with the first.
 *
 * The cost is that a player who picks Latin waits a few seconds to be told no.
 * If that becomes a real complaint, the pre-filter is the thing to add — see
 * docs/domain/language-editions.md, which records the measurements it would need.
 */
export class WikipediaEditionService {
  private wikimedia: WikimediaClient;

  constructor(wikimedia?: WikimediaClient) {
    // Injected for the reason the calibration service's client is: `vi.mock` is a
    // no-op in the Workers test pool, so a module-scope client cannot be replaced.
    this.wikimedia = wikimedia ?? createWikimediaClient();
  }

  async getEditions(): Promise<Result<WikipediaEditionDTO[]>> {
    try {
      const editions = await this.wikimedia.site.listEditions();
      return success(
        editions.map((edition) => ({
          code: edition.code,
          autonym: edition.autonym,
          englishName: edition.englishName,
        })),
      );
    } catch {
      return failure(EDITION_ERRORS.UNAVAILABLE);
    }
  }
}
