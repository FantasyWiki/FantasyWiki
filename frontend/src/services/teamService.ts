/**
 * teamService.ts — thin HTTP layer for team data.
 *
 * Intentionally does no transformation: all mapping from raw API shapes
 * to derived UI state lives in the Pinia teamStore.
 */
import type { TeamResponse, Contract } from "@/types/team";

const BASE = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8787";

/**
 * Fetch the current team layout for a given league / user combination.
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
 * Batch-fetch contract details by id list.
 * The backend accepts a comma-separated `ids` query parameter.
 */
export async function fetchContracts(ids: number[]): Promise<Contract[]> {
  if (ids.length === 0) return [];
  const res = await fetch(
    `${BASE}/api/contracts?ids=${ids.join(",")}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("Failed to fetch contracts");
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
    formation: string;
    slots: Record<string, number | null>;
    bench: number[];
  }
): Promise<void> {
  const res = await fetch(
    `${BASE}/api/leagues/${leagueId}/teams/${userId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error(`Failed to save team: ${res.status}`);
}
