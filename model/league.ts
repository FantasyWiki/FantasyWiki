import { Temporal } from "@js-temporal/polyfill";

/**
 * The league every player is enrolled in by naming their first team; it is the
 * one league membership onboarding is responsible for. Its id is fixed rather
 * than discovered so both sides of the API agree on which league "the Global
 * League" is without a round-trip. Kept here, in the shared model, because
 * backend and frontend both reason about it (creation, and enforcing that a
 * first-run player has a team in it) and must not drift apart.
 */
export const GLOBAL_LEAGUE_ID = "global";

export interface League {
  id: string;
  name: string;
  adminId: string;
  startDate: Temporal.Instant;
  endDate: Temporal.Instant;
  domain: string;
  icon: string;
}
