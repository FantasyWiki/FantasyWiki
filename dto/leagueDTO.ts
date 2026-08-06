import { Temporal } from "@js-temporal/polyfill";
import { Domain } from "../model/enums";

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
  /** How many teams play this league, the player's own included. */
  teamCount: number;
}