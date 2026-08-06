import { Temporal } from "@js-temporal/polyfill";
import { LeagueInvitePolicy, LeagueVisibility } from "./enums";

/**
 * The league every player is enrolled in by naming their first team; it is the
 * one league membership onboarding is responsible for. Its id is fixed rather
 * than discovered so both sides of the API agree on which league "the Global
 * League" is without a round-trip. Kept here, in the shared model, because
 * backend and frontend both reason about it (creation, and enforcing that a
 * first-run player has a team in it) and must not drift apart.
 */
export const GLOBAL_LEAGUE_ID = "global";

/**
 * The characters an invitation code is drawn from: digits and capitals minus
 * the pairs a person reads wrong out loud — no `0`/`O`, no `1`/`I`/`L`, and no
 * `U`. Thirty characters over a length of five is 30^5 ≈ 24.3 million codes,
 * short enough to read down a phone and wide enough that a collision is a
 * retry rather than a problem.
 *
 * Uppercase and symbol-free is also exactly QR's alphanumeric mode, so the
 * deferred "show it as a QR" fits in the densest, smallest symbol.
 *
 * Kept here, in the shared model, for the same reason as GLOBAL_LEAGUE_ID: the
 * form that accepts a code and the backend that checks one must agree on what
 * a code *is*, and must not drift apart. Generating one is a backend concern
 * and lives in backend/src/services/invitationCode.ts — this is the shape of
 * the value, not behaviour over persistence.
 */
export const INVITATION_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export const INVITATION_CODE_LENGTH = 5;

/**
 * Tidy up what a person actually typed or pasted before it is compared: codes
 * get shared in chat with stray spaces, and get read back with hyphens that
 * were never in them.
 */
export function normalizeInvitationCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function isInvitationCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === INVITATION_CODE_LENGTH &&
    [...value].every((c) => INVITATION_CODE_ALPHABET.includes(c))
  );
}

/**
 * `invitationCode` is deliberately absent. It is a credential, and this shape
 * is what five services receive every time they look a league up for its
 * domain — carrying the code through all of them invites one stray spread into
 * a DTO to leak it. It is read only by the repository call that exists to
 * fetch it. See docs/adr/0008-league-invitation-codes.md.
 */
export interface League {
  id: string;
  name: string;
  adminId: string;
  startDate: Temporal.Instant;
  endDate: Temporal.Instant;
  domain: string;
  visibility: LeagueVisibility;
  invitePolicy: LeagueInvitePolicy;
  icon: string;
}
