-- Migration: Derive team credits from the contracts ledger
-- Date: 2026-07-10

-- Persist the actual early-sale proceeds (previously only ever computed live
-- and dropped into a notification message, never stored) so team credits can
-- be derived from the contracts ledger instead of a separately maintained
-- running balance.
ALTER TABLE contracts ADD COLUMN salePayout REAL;

-- teams.credits is no longer the source of truth for a team's balance — it is
-- derived at read time from contracts (STARTING_CREDITS - sum(purchasePrice)
-- + sum(salePayout where settled)). Dropping the column removes the
-- possibility of it drifting out of sync with the ledger.
ALTER TABLE teams DROP COLUMN credits;
