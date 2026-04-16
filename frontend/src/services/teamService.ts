/**
 * teamService.ts — thin HTTP layer for team data.
 *
 * Intentionally does no transformation: all mapping from raw API shapes
 * to derived UI state lives in the Pinia teamStore.
 */
import type { TeamResponse } from "@/types/team";
import type { FormationDTO } from "../../../dto/formationDTO";
import type { ContractDTO } from "../../../dto/contractDTO";

const BASE = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8787";

/**
 * Fetch the current team layout for a given league / user combination.
 * Returns a TeamResponse containing a fully resolved FormationDTO and bench.
 */
export async function fetchTeam(
  leagueId: string,
  userId: string
): Promise<TeamResponse> {
  const res = await fetch(`${BASE}/api/leagues/${leagueId}/teams/${userId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to fetch team: ${res.status}`);
  return res.json();
}

/**
 * Persist the current team layout.
 * Called automatically by the store's auto-save logic; no explicit save button needed.
 */
export async function saveTeamApi(
  leagueId: string,
  userId: string,
  payload: {
    formation: FormationDTO;
    bench: ContractDTO[];
  }
): Promise<void> {
  const res = await fetch(`${BASE}/api/leagues/${leagueId}/teams/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to save team: ${res.status}`);
}
