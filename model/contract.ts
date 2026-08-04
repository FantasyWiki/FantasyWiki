import { Temporal } from "@js-temporal/polyfill";

export interface Contract {
  id: string;
  teamId: string;
  articleId: string; //Wikipedia article ID
  purchaseDate: Temporal.PlainDate;
  expireDate: Temporal.PlainDate;
  purchasePrice: number;
  settled: boolean;
  renewalCount: number;
  renewalElected: boolean;
}

/**
 * **Article Availability**: an article's ownership status at the time detail is
 * shown. These three values are the vocabulary — never a generic "unavailable"
 * flag.
 */
export type ArticleAvailability =
  | "free-agent"
  | "owned-by-viewer"
  | "owned-by-other";

/**
 * Decides Article Availability from the active contract on an article (null for
 * none) and the viewing team. Shared so the market badge, the detail view and
 * the backend's purchase rejection all answer the question the same way.
 */
export function articleAvailability(
  ownerTeamId: string | null | undefined,
  viewerTeamId: string | null | undefined,
): ArticleAvailability {
  if (!ownerTeamId) return "free-agent";
  return ownerTeamId === viewerTeamId ? "owned-by-viewer" : "owned-by-other";
}

/**
 * A contract's committed window. Every date-dependent lifecycle rule below is
 * expressed against this rather than loose PlainDate pairs. A `Contract`
 * satisfies it structurally — pass one directly.
 */
export interface ContractTerm {
  purchaseDate: Temporal.PlainDate;
  expireDate: Temporal.PlainDate;
}

/**
 * The window's length in days — the contract's own held tier, derived from its
 * dates rather than stored (ADR 0003: a renewal rolls the window forward).
 * Pricing an existing contract at anything else makes comparison to
 * `purchasePrice` meaningless.
 */
export function termDays(term: ContractTerm): number {
  return term.purchaseDate.until(term.expireDate).days;
}

/**
 * Days left as of `on`. **Not clamped** — past expiry it goes negative, and
 * callers rely on that to tell "expired" from "expires today". Rules that must
 * not go negative clamp at their own edge.
 */
export function remainingDays(
  term: ContractTerm,
  on: Temporal.PlainDate,
): number {
  return on.until(term.expireDate).days;
}

/** Whether the term still has time left to run as of `on`. */
export function isActive(term: ContractTerm, on: Temporal.PlainDate): boolean {
  return remainingDays(term, on) > 0;
}

/** Whether the term has already ended as of `on`. */
export function isExpired(term: ContractTerm, on: Temporal.PlainDate): boolean {
  return remainingDays(term, on) < 0;
}

/**
 * The unused share of the term — the proration factor Early Sell is stated in.
 * Floors at 0; a zero-length term counts as fully used rather than dividing by
 * zero.
 */
export function remainingFraction(
  term: ContractTerm,
  on: Temporal.PlainDate,
): number {
  const days = termDays(term);
  if (days <= 0) return 0;
  return Math.max(0, remainingDays(term, on) / days);
}

/**
 * **Early Sell** (ADR 0003): `currentPrice × remainingDays / termDays` — paid
 * only for time not used, at today's rate. Proration is the sole guard against
 * the partial-hold exploit (there is no minimum hold), so `currentPrice` must
 * be priced at this contract's own {@link termDays}, not a fixed tier.
 */
export function earlySellPayout(
  term: ContractTerm,
  currentPrice: number,
  on: Temporal.PlainDate,
): number {
  return Math.max(0, Math.round(currentPrice * remainingFraction(term, on)));
}

/**
 * **Expiry Settlement** P&L (ADR 0003). The *payout* is the full
 * `currentPrice` — the stake back plus mark-to-market, since the buy already
 * debited `purchasePrice` from the ledger — so there is deliberately no
 * `expirySettlementPayout(purchasePrice, currentPrice)`: it would take a
 * parameter it cannot use and imply the stake is netted off. This is only the
 * delta the player is shown.
 */
export function settlementDelta(
  purchasePrice: number,
  currentPrice: number,
): number {
  return currentPrice - purchasePrice;
}

/** ADR 0003: +10% of currentPrice per consecutive renewal (anti-hoard sink). */
export const RENEWAL_PREMIUM_RATE = 0.1;

/**
 * **Renewal Premium** (ADR 0003): +10% per consecutive renewal, the economy's
 * anti-hoard sink.
 *
 * `priorRenewals` is the contract's stored `renewalCount` — renewals *already*
 * completed. The renewal being priced is therefore the `priorRenewals + 1`-th,
 * which is what the rate multiplies: the first renewal costs +10%, the second
 * +20%, and so on. Dropping the article resets the count, and with it the
 * premium.
 *
 * The `+ 1` is load-bearing. Multiplying by `priorRenewals` directly makes the
 * first renewal free, which lets a player hold an article for two full terms
 * with no anti-hoard cost at all — the sink fails exactly where it should first
 * bite. That was the behaviour until this was fixed.
 */
export function renewalPremium(
  currentPrice: number,
  priorRenewals: number,
): number {
  return Math.round(currentPrice * RENEWAL_PREMIUM_RATE * (priorRenewals + 1));
}

/** The new `purchasePrice` a renewed contract locks in. */
export function renewalPrice(
  currentPrice: number,
  priorRenewals: number,
): number {
  return currentPrice + renewalPremium(currentPrice, priorRenewals);
}

/**
 * What renewing costs the balance. Credits are derived from the ledger (ADR
 * 0007) where the old `purchasePrice` is already sunk, so only the difference
 * moves. Goes negative when the article has fallen in value, making the renewal
 * free — correct, not a guard to add.
 */
export function renewalIncrementalCost(
  newPurchasePrice: number,
  oldPurchasePrice: number,
): number {
  return newPurchasePrice - oldPurchasePrice;
}

/**
 * ADR 0003's right-of-first-refusal window: renewal may only be elected in the
 * final 24h. The server stores dates, not timestamps, so this is necessarily
 * the coarse form (`0 <= remainingDays <= 1`); the frontend applies the finer
 * sub-24h gate. An expired term is outside the window, which lets callers tell
 * "too late" from "too early".
 */
export function isRenewalWindowOpen(
  term: ContractTerm,
  on: Temporal.PlainDate,
): boolean {
  const remaining = remainingDays(term, on);
  return remaining >= 0 && remaining <= 1;
}
