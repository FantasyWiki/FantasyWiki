-- Migration: Store measured Language Scale Factors, and freeze one per league
-- Date: 2026-08-17

-- ADR 0002 locked a formula, a floor and a calibration architecture on
-- 2026-07-07 and none of it was ever built: `model/pricing.ts` held a
-- hand-written table of two numbers, and "is this edition calibrated" meant "is
-- it `en` or `it`". This migration is where those two numbers stop being source
-- code.
--
-- Two things, deliberately split:
--
--   * `language_scales` is the **registry** — what we measured for an edition,
--     when, and off how large a sample. One row per Wikipedia edition, written
--     once at the first league founded on it.
--
--   * `leagues.languageScale` is the **frozen copy** every price and every score
--     in that league is computed against.
--
-- The split is not redundancy, it is the invariant ADR 0002 states: "a live
-- factor would re-rate locked-price contracts and make scores drift with no
-- player-visible cause". Recalibration is expected roughly annually, and if
-- leagues read the registry through a join, that recalibration would silently
-- re-rate every contract in every existing league on that edition — the exact
-- outcome the ADR forbids. Copying the factor onto the league at creation makes
-- a re-measurement apply to leagues founded *after* it and to nothing else.

CREATE TABLE IF NOT EXISTS language_scales (
  -- A Wikipedia language code (`en`, `it`, `pt-br`), matching `leagues.domain`.
  domain TEXT PRIMARY KEY,
  -- L(domain): the multiplier lifting this edition's raw views onto the `en`
  -- reference scale. REAL, and never NULL — a row exists only once measured.
  scale REAL NOT NULL,
  -- ISO-8601 instant. The one column that says whether a factor is this year's
  -- measurement or three years stale, which is what makes ADR 0002's "~annual"
  -- recalibration a decidable question rather than a note in a document.
  measuredAt TEXT NOT NULL,
  -- Articles clearing the floor's 50 views/day, and ranks actually compared.
  -- Both recorded because "passed the floor" and "passed it comfortably" are
  -- different facts, and only these two numbers tell them apart afterwards.
  qualifyingRanks INTEGER NOT NULL,
  sampleSize INTEGER NOT NULL,
  -- The edition this scale is relative to. Stored rather than assumed to be
  -- `en`: a scale without its reference is a number without a unit, and a
  -- future re-anchoring has to be able to see which rows predate it.
  referenceDomain TEXT NOT NULL
);

-- The two values `model/pricing.ts` carried, moved rather than re-derived.
--
-- Re-measuring them here would re-rate every contract already priced in `en` and
-- `it` for no reason, so they are seeded exactly as ADR 0002 recorded them from
-- its rank-matched 2026-07-06 snapshot. `qualifyingRanks` (985 and 993) come
-- from that snapshot's single-day top-1000 list, which is why both sit just under
-- 1000 — the ceiling of the list, not of the edition.
--
-- Worth knowing when these are next revisited: re-measuring `it` on 2026-08-15
-- over a 30-day window gives L ≈ 11.5, ~17% below the 13.9 seeded here. That is
-- drift in the ratio itself over six weeks, not a measurement error — the cheap
-- and expensive routes agree to within 1.5% on the same window
-- (docs/domain/language-editions.md). It is left alone on purpose: nothing in
-- play gets re-rated by this migration.
INSERT OR IGNORE INTO language_scales
  (domain, scale, measuredAt, qualifyingRanks, sampleSize, referenceDomain)
VALUES
  ('en', 1.0,  '2026-07-06T00:00:00Z', 985, 500, 'en');

-- The factor this league's prices and scores are computed at, frozen when it was
-- founded.
--
-- NOT NULL with a DEFAULT of 1.0 because `ALTER TABLE ADD COLUMN` in SQLite
-- cannot add a NOT NULL column without one, and 1.0 is the only safe default:
-- it is the `en` reference, so an unbackfilled row prices exactly as the old
-- `resolveLanguageScale` fallback did rather than becoming NULL and arriving at
-- the scoring path as NaN. The UPDATE below then replaces it with the real
-- measurement for every league that has one, which today is all of them.
ALTER TABLE leagues ADD COLUMN languageScale REAL NOT NULL DEFAULT 1.0;

UPDATE leagues
SET languageScale = (
  SELECT scale FROM language_scales WHERE language_scales.domain = leagues.domain
)
WHERE domain IN (SELECT domain FROM language_scales);

-- No index: the table is keyed by `domain` (its primary key), holds one row per
-- Wikipedia edition — a few hundred at most, and two today — and is read only by
-- that key.
