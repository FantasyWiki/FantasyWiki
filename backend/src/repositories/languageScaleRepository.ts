import type { LanguageScale } from "../../../model/languageScale";
import { Result } from "./result";

/**
 * Persistence for measured Language Scale Factors: the registry ADR 0002 forbids
 * recomputing under a live league.
 */
export interface LanguageScaleRepository {
  /**
   * The measured factor for an edition, or `null` for one never calibrated.
   *
   * `null` rather than a failure, because "we have not measured this edition"
   * is the ordinary answer on the path whose whole job is to ask before
   * founding a league — the same reasoning as
   * `LeagueRepository.findIdByInvitationCode`. A failure here means D1 is
   * broken, and a caller must never read that as "uncalibrated" and calibrate
   * over a value that already exists.
   */
  getByDomain(domain: string): Promise<Result<LanguageScale | null>>;
  /**
   * Persist a completed calibration.
   *
   * Insert-if-absent, deliberately **not** an upsert: overwriting a stored
   * factor re-rates every contract already priced in that edition, which ADR
   * 0002 rules out as silent re-pricing. Two concurrent first-time calibrations
   * of the same edition are the case this matters for — the loser keeps the
   * winner's value instead of replacing it, and since both measured the same
   * window they agree anyway. A deliberate recalibration is a different
   * operation, and does not exist yet (ADR 0002 puts it at ~annual).
   */
  save(scale: LanguageScale): Promise<Result<void>>;
}
