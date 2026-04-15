/**
 * Team domain types.
 *
 * TeamResponse  — raw shape returned by the backend
 * Contract      — a resolved word/article contract
 * SlotMap       — positionKey → Contract | null (what TeamFormation consumes)
 */

import { ContractDTO } from "../../../dto/contractDTO";

/** Raw shape returned by GET /leagues/:id/teams/:userId */
export interface TeamResponse {
  /** e.g. "4-3-3" */
  formation: string;
  /** positionKey → contractId (null = unfilled slot) */
  slots: Record<string, number | null>;
  /** contractIds on the bench */
  bench: number[];
}

/** The shape TeamFormation.vue consumes: posKey → resolved Contract or null */
export type SlotMap = Record<string, ContractDTO | null>;
