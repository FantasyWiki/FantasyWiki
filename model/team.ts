export interface Team {
  id: string;
  name: string;
  playerId: string;
  leagueId: string;
  credits: number;
}

/**
 * ADR 0003/0005: starting budget for every new team — 1,000 credits, no
 * per-language scale factor needed (points-based pricing doesn't reproduce
 * the rounding-to-zero issue the old views^1.5 formula had). Lives in the
 * shared model package rather than backend-only because the repository layer
 * needs it in multiple places to derive a team's current credits from the
 * contracts ledger: `credits = STARTING_CREDITS - sum(purchasePrice) +
 * sum(salePayout where settled)`, computed at read time rather than stored.
 */
export const STARTING_CREDITS = 1000;