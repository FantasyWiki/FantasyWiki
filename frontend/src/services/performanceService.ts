/**
 * performanceService.ts — HTTP layer for a team's daily performance history.
 *
 * Backs the "last night's performance" view: fetches the raw
 * `PerformanceDTO[]` from GET /api/leagues/:id/my-performances (most recent
 * first) and deserializes each snapshot into typed domain objects, mirroring
 * `teamService.ts`:
 *   - the snapshot day (`date`) arrives as an ISO `YYYY-MM-DD` → Temporal.PlainDate
 *   - the stored formation's `date` arrives as an ISO-8601 instant → Temporal.Instant
 *   - each placed article is a raw contract payload → ContractDTO
 *   - chemistry links are normalized against the schema
 *
 * The scoring math lives entirely on the backend (`model/scoring.ts`); the
 * frontend only reads the already-computed `points` and the historical
 * formation snapshot the engine scored.
 */
import { Temporal } from "@js-temporal/polyfill";
import {
  normalizeChemistryLinks,
  type FormationDTO,
} from "../../../dto/formationDTO";
import { ContractDTO, type RawContract } from "../../../dto/contractDTO";

const BASE = "";

/** One scored day for a team: the formation that played and the points it earned. */
export interface TeamPerformance {
  teamId: string;
  date: Temporal.PlainDate;
  formation: FormationDTO;
  points: number;
}

type RawPerformance = {
  teamId: string;
  date: string;
  points: number;
  formation: {
    date: string;
    schema: FormationDTO["schema"];
    formation: Record<string, RawContract>;
    chemistry?: FormationDTO["chemistry"];
  };
};

function deserializePerformance(raw: RawPerformance): TeamPerformance {
  const formation = Object.fromEntries(
    Object.entries(raw.formation.formation).map(([position, contract]) => [
      position,
      ContractDTO.fromRaw(contract),
    ])
  ) as FormationDTO["formation"];
  const chemistry = normalizeChemistryLinks(
    raw.formation.schema,
    raw.formation.chemistry
  );

  return {
    teamId: raw.teamId,
    date: Temporal.PlainDate.from(raw.date),
    points: raw.points,
    formation: {
      date: Temporal.Instant.from(raw.formation.date),
      schema: raw.formation.schema,
      formation,
      chemistry,
    } as FormationDTO,
  };
}

/**
 * Fetch the current player's most recent scored days for a league, newest
 * first. `limit` mirrors the backend default (2) so a caller can show the last
 * night alongside the night before for a day-over-day delta.
 */
export async function fetchMyPerformances(
  leagueId: string,
  limit = 2
): Promise<TeamPerformance[]> {
  const res = await fetch(
    `${BASE}/api/leagues/${leagueId}/my-performances?limit=${limit}`,
    { credentials: "include" }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch performances: ${res.status}`);
  }
  const raw = (await res.json()) as RawPerformance[];
  return raw.map(deserializePerformance);
}
