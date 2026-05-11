/**
 * teamService.ts — HTTP layer for team data.
 *
 * Fetches raw API payloads and deserializes them into typed domain objects:
 * - ISO-8601 date strings → Temporal.Instant
 * - ISO-8601 duration strings → Temporal.Duration
 * - Plain contract objects → ContractDTO instances
 * Higher-level UI state derivation lives in the composable / store layer.
 */
import type { TeamLineUp } from "@/types/team";
import {
  createChemistryLinks,
  type FormationDTO,
} from "../../../dto/formationDTO";
import type { ContractDTO } from "../../../dto/contractDTO";
import { ContractDTO as ContractModel } from "../../../dto/contractDTO";
import { Temporal } from "@js-temporal/polyfill";

const BASE = import.meta.env.VITE_BACKEND_URL;

type RawContract = {
  id: string;
  team: ContractDTO["team"];
  article: ContractDTO["article"];
  startDate: string;
  duration: string | Record<string, unknown>;
  purchasePrice: number;
};

type RawTeamLineUp = {
  formation: {
    date: string;
    schema: FormationDTO["schema"];
    formation: Record<string, RawContract>;
    chemistry?: FormationDTO["chemistry"];
  };
  bench: RawContract[];
};

function deserializeContract(c: RawContract): ContractDTO {
  return new ContractModel(
    c.id,
    c.team,
    c.article,
    Temporal.Instant.from(c.startDate),
    Temporal.Duration.from(c.duration),
    c.purchasePrice
  );
}

function deserializeLineup(raw: RawTeamLineUp): TeamLineUp {
  const formation = Object.fromEntries(
    Object.entries(raw.formation.formation).map(([position, contract]) => [
      position,
      deserializeContract(contract),
    ])
  ) as FormationDTO["formation"];
  const chemistry =
    raw.formation.chemistry ?? createChemistryLinks(raw.formation.schema);

  return {
    formation: {
      date: Temporal.Instant.from(raw.formation.date),
      schema: raw.formation.schema,
      formation,
      chemistry,
    } as FormationDTO,
    bench: raw.bench.map(deserializeContract),
  };
}

/**
 * Fetch the current team layout for a given league / user combination.
 * Returns a TeamResponse containing a fully resolved FormationDTO and bench.
 */
export async function fetchTeam(leagueId: string): Promise<TeamLineUp> {
  const res = await fetch(`${BASE}/api/leagues/${leagueId}/lineup`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to fetch lineup: ${res.status}`);
  const raw = (await res.json()) as RawTeamLineUp;
  return deserializeLineup(raw);
}

/**
 * Persist the current team layout.
 * Used by both the explicit Save action in the UI and auto-save flows
 * such as saving when leaving the team view.
 */
export async function saveTeamApi(
  leagueId: string,
  payload: {
    formation: FormationDTO;
    bench: ContractDTO[];
  }
): Promise<void> {
  const res = await fetch(`${BASE}/api/leagues/${leagueId}/lineup`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to save team: ${res.status}`);
}
