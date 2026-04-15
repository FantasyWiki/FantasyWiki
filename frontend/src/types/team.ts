/**
 * Team domain types.
 *
 * TeamResponse  — raw shape returned by the backend
 * Contract      — a resolved word/article contract
 * SlotMap       — positionKey → Contract | null (what TeamFormation consumes)
 */

import { ContractDTO } from "../../../dto/contractDTO";
import {FormationDTO} from "../../../dto/formationDTO";

/** Raw shape returned by GET /leagues/:id/teams/:userId */
export interface TeamResponse {
  formation: FormationDTO
  /** contractIds on the bench */
  bench: ContractDTO[];
}