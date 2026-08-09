import { Temporal } from "@js-temporal/polyfill";
import { Domain, LeagueInvitePolicy, LeagueVisibility } from "./enums";

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
 * What a league may be called. Longer than a team name (30) because a league
 * name is read in a list and a share message rather than on a scoreboard row.
 */
export const LEAGUE_NAME_MIN_LENGTH = 3;
export const LEAGUE_NAME_MAX_LENGTH = 50;

export function isLeagueName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    trimmed.length >= LEAGUE_NAME_MIN_LENGTH &&
    trimmed.length <= LEAGUE_NAME_MAX_LENGTH
  );
}

/**
 * The badges a league can be created with. A closed palette rather than free
 * text: `leagues.icon` is `NOT NULL TEXT` that every league list renders
 * literally, so accepting whatever a request sends would put arbitrary strings
 * on screen for a field that only ever wanted a glyph.
 */
export const LEAGUE_ICONS = [
  "🏆", "⚽", "🌍", "📚", "🔬", "🎮", "🏀", "🎯",
  "⭐", "🦁", "🐉", "🔥", "💎", "🛡️", "⚔️", "🎪",
  "🚀", "🌟", "🏅", "👑", "🦅", "🐺", "🎭", "🌊",
] as const;

export function isLeagueIcon(value: unknown): value is string {
  return (
    typeof value === "string" && (LEAGUE_ICONS as readonly string[]).includes(value)
  );
}

/**
 * The Wikipedia editions a league can currently be created in.
 *
 * A deliberately narrow list, and a temporary one: nothing below the type layer
 * is restricted to two editions — `buildArticleUrl` interpolates any language
 * code, and `resolveLanguageScale` already falls back to the `en` reference for
 * a domain it has no calibration for. Issue #531 replaces this constant with
 * the live Wikipedia edition list above a pageview floor; until then this is
 * the one place the restriction is stated, so that swap is a one-function
 * change rather than a hunt.
 */
export const LEAGUE_DOMAINS = ["en", "it"] as const satisfies readonly Domain[];

export function isLeagueDomain(value: unknown): value is Domain {
  return (
    typeof value === "string" && (LEAGUE_DOMAINS as readonly string[]).includes(value)
  );
}

/**
 * How long a season runs, as the choices a player is actually offered.
 *
 * A closed set rather than a free number, and floored at two weeks, because a
 * season shorter than `TIER_DAYS.LONG` (14) could not hold a LONG contract to
 * expiry — the league would end mid-settlement for anyone who bought one. The
 * upper end is six months, past which a Top Read Snapshot's article mix has
 * turned over enough that the market a player joined is not the one they end in.
 */
export const LEAGUE_DURATION_DAYS = {
  "2w": 14,
  "1m": 30,
  "2m": 60,
  "3m": 90,
  "6m": 180,
} as const;

export type LeagueDuration = keyof typeof LEAGUE_DURATION_DAYS;

export function isLeagueDuration(value: unknown): value is LeagueDuration {
  return typeof value === "string" && value in LEAGUE_DURATION_DAYS;
}

/**
 * When a season started now would end.
 *
 * Counted in hours rather than days on purpose: `Temporal.Instant` rejects
 * date units outright (`Duration field day not supported by Temporal.Instant`)
 * because a day is only a calendar's idea of one. An instant plus a fixed
 * number of hours is exactly what a season length means here — the league ends
 * at the same clock time it began, wherever the players are.
 */
export function leagueEndDate(
  start: Temporal.Instant,
  duration: LeagueDuration,
): Temporal.Instant {
  return start.add({ hours: LEAGUE_DURATION_DAYS[duration] * 24 });
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
