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
 * Whether a value could be a Wikipedia language code at all.
 *
 * A *shape* check, and nothing more. It replaces `LEAGUE_DOMAINS` — a
 * hand-maintained list of the two editions the game offered — which was never a
 * restriction on anything real: every layer beneath it interpolates whatever code
 * it is given, and the database column is plain TEXT.
 *
 * What an edition may actually host a league on is not a question a predicate can
 * answer, so this one does not pretend to: it exists to reject `""`,
 * `"../../etc"` and a 400-character string before any of that reaches a URL, and
 * the real decisions are made against live data at the write boundary —
 * `WikipediaEditionService.isOfferable` (is it a live edition with enough read
 * articles) and `LanguageScaleCalibrationService.resolve` (does it clear ADR
 * 0002's acceptance floor). See docs/domain/language-editions.md.
 *
 * The pattern matches Wikimedia's own codes: lowercase letters, digits and
 * hyphens, as in `en`, `it`, `pt-br`, `zh-yue`, `roa-tara`, `simple`.
 */
const WIKIPEDIA_LANGUAGE_CODE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export const WIKIPEDIA_LANGUAGE_CODE_MAX_LENGTH = 20;

export function isWikipediaLanguageCode(value: unknown): value is Domain {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= WIKIPEDIA_LANGUAGE_CODE_MAX_LENGTH &&
    WIKIPEDIA_LANGUAGE_CODE.test(value)
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
  /**
   * The Language Scale Factor every price and every score in this league is
   * computed at, frozen when it was founded.
   *
   * A copy of what `language_scales` held for `domain` at that moment, and
   * carried on the league rather than looked up per read *because* it is a copy.
   * ADR 0002: "a live factor would re-rate locked-price contracts and make
   * scores drift with no player-visible cause". Recalibration is expected
   * roughly annually, and a league that read the registry would silently
   * re-price every contract in it the day that happened; a league that carries
   * its own factor is unaffected, and only leagues founded afterwards use the
   * new measurement.
   *
   * It is also why no scoring or pricing path needs `resolveLanguageScale` any
   * more: the number arrives with the league that defines it.
   */
  languageScale: number;
  visibility: LeagueVisibility;
  invitePolicy: LeagueInvitePolicy;
  icon: string;
  /**
   * When the admin closed the league early, or `null` while it is still open.
   * Never unset once written, and never accompanied by a delete — see
   * `isLeagueInactive` and migration 0008.
   */
  closedAt: Temporal.Instant | null;
}

/**
 * Whether a league has stopped being somewhere a player can play.
 *
 * Two ways in and no others: the season instant passes, or the admin closes it
 * early. Both are terminal, and neither erases anything — an inactive league
 * still has its teams, its contracts and its winner sitting behind it; it is
 * only that no click leads back into play. Stated here rather than in either
 * the frontend or the backend because both decide it: the ended-leagues section
 * and the league picker filter on it, and the join gate refuses on it.
 *
 * `now` is a parameter rather than `Temporal.Now.instant()` so the rule can be
 * pinned in a test without moving the machine's clock.
 */
export function isLeagueInactive(
  league: Pick<League, "endDate" | "closedAt">,
  now: Temporal.Instant,
): boolean {
  return (
    league.closedAt !== null ||
    Temporal.Instant.compare(now, league.endDate) > 0
  );
}
