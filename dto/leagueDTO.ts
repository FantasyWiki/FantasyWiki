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
  icon: string;
  startDate: Temporal.Instant;
  endDate: Temporal.Instant;
  /** Whether the league can be joined freely or only with its invitation code. */
  visibility: LeagueVisibility;
  /** How many teams play this league, the player's own included. */
  teamCount: number;
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