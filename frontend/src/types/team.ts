/**
 * Team domain types.
 *
 * TeamResponse  — raw shape returned by the backend
 * Contract      — a resolved word/article contract
 * SlotMap       — positionKey → Contract | null (what TeamFormation consumes)
 */

/** Raw shape returned by GET /leagues/:id/teams/:userId */
export interface TeamResponse {
  /** e.g. "4-3-3" */
  formation: string;
  /** positionKey → contractId (null = unfilled slot) */
  slots: Record<string, number | null>;
  /** contractIds on the bench */
  bench: number[];
}

/** A resolved word/article contract */
export interface Contract {
  id: number;
  /** The Wikipedia article / word title */
  word: string;
  /** Accumulated points this period */
  points: number;
  /** Signed delta from last week (+/- pts) */
  weeklyDelta?: number;
}

/** The shape TeamFormation.vue consumes: posKey → resolved Contract or null */
export type SlotMap = Record<string, Contract | null>;
