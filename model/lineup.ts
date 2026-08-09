import type { Schema } from "./enums";

export interface Lineup {
  teamId: string;
  schema: string;
  formation: string;
  updatedAt: string;
}

/**
 * The formation a team starts on before its owner has picked one.
 *
 * Every team needs a lineup row from the moment it exists — `getLineup` fails
 * outright without one — so it is written alongside the team, by whichever path
 * created it: joining a league, or founding one. Stated here because there are
 * now two such paths and the default must be the same in both.
 */
export const DEFAULT_SCHEMA: Schema = "4-3-3";
