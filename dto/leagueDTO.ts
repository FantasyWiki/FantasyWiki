import { Temporal } from "@js-temporal/polyfill";
import { Domain, LeagueInvitePolicy, LeagueVisibility } from "../model/enums";
import type { LeagueDuration } from "../model/league";

/**
 * A league's identity, calendar and size.
 *
 * Deliberately not its roster: who plays in a league is served by
 * `/leagues/:id/leaderboard`, which ranks every team whether it has been scored
 * yet or not. This used to carry a `teams` array as well, but no endpoint ever
 * filled it — every caller that needed the field either read an empty list or
 * went to the leaderboard behind its back. `teamCount` is what those callers
 * actually wanted, so it is stated here once and answered by every league
 * endpoint.
 */
export interface LeagueDTO {
  id: string;
  title: string;
  domain: Domain;
  /**
   * The Language Scale Factor this league's prices are computed at, frozen when
   * it was founded (`model/league.ts`, ADR 0002).
   *
   * Carried on the league because the frontend prices contracts too — the market
   * grid and the article sheet both call `computeContractPrice`, and they used to
   * reach a hardcoded two-entry table for the factor. A number the server has
   * already frozen is the only way both sides can be certain they are showing the
   * same price for the same article, which matters because the player buys at the
   * one they were shown.
   *
   * A plain `number`, so unlike the two instants beside it there is nothing to
   * deserialize.
   */
  languageScale: number;
  icon: string;
  startDate: Temporal.Instant;
  endDate: Temporal.Instant;
  /** Whether the league can be joined freely or only with its invitation code. */
  visibility: LeagueVisibility;
  /** How many teams play this league, the player's own included. */
  teamCount: number;
  /**
   * When the admin closed the league early, or `null` if they never did. A
   * `Temporal.Instant` like the two dates above it, so `isLeagueInactive` in
   * model/league.ts reads a DTO and a domain League through the same rule —
   * and, like them, it must be put back through `Temporal.Instant.from` on the
   * frontend (`deserializeLeague`).
   */
  closedAt: Temporal.Instant | null;
}

/**
 * A league's invitation code, served *only* by the endpoint that checks the
 * caller may have it.
 *
 * Pointedly not a field on `LeagueDTO`: `GET /api/leagues/:id` is unscoped by
 * design, so a code riding on that shape could be read straight off a public
 * endpoint and used to walk through the gate it exists to guard. See
 * docs/adr/0008-league-invitation-codes.md.
 */
export interface LeagueInviteDTO {
  code: string;
}

/**
 * Where the calling player stands in one league: whether they field a team in
 * it, and whether they are its admin.
 *
 * Its own caller-scoped shape rather than two more fields on `LeagueDTO`, for
 * the reason `LeagueDTO` has no `adminId` today: that shape is the *league*,
 * the same answer for everyone, and the surfaces that hold it treat it as
 * such. Folding "…and you are its admin" into it would make a cacheable,
 * unscoped read quietly depend on who asked.
 *
 * It exists because the two lifecycle controls need it — only a member may
 * leave, only the admin may close — and the client cannot work either out on
 * its own. As with the invitation code, the server decides and the page simply
 * renders nothing it is not offered.
 */
export interface LeagueRoleDTO {
  isMember: boolean;
  isAdmin: boolean;
}

/**
 * What leaving a league left behind.
 *
 * Only the one fact the client cannot discover for itself: when the last member
 * walks out the league is deleted, and a league that no longer exists cannot be
 * re-read to find that out. The page needs it to leave rather than to refetch a
 * 404 (docs/domain/league-lifecycle.md).
 */
export interface LeaveLeagueResultDTO {
  leagueDeleted: boolean;
}

/**
 * What a player fills in to found a league.
 *
 * `duration` rather than an end date: the season is "this long from now", and
 * letting the client name the instant would let it name one in the past. The
 * start is the moment the league is created, server-side.
 *
 * `teamName` is here because founding a league and fielding a team in it are
 * one act, not two — the league is written together with its founder's team in
 * a single transaction, so there is no moment where a league exists that
 * nobody is in. `adminId` is absent for the usual reason: the founder is the
 * caller, resolved from the session (api-naming-rules.md §4).
 */
export interface CreateLeagueRequest {
  name: string;
  icon: string;
  domain: Domain;
  duration: LeagueDuration;
  visibility: LeagueVisibility;
  invitePolicy: LeagueInvitePolicy;
  teamName: string;
}