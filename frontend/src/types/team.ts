/**
 * Team domain types.
 *
 * TeamResponse — raw shape returned by the backend
 * SlotMap      — kept for legacy compatibility (not used in formation flow)
 */

import { ContractDTO } from "../../../dto/contractDTO";
import { FormationDTO } from "../../../dto/formationDTO";

/** Raw shape returned by GET /leagues/:id/teams/:userId */
export interface TeamResponse {
  /** Fully resolved formation with schema and contract map */
  formation: FormationDTO;
  /** Contracts on the bench */
  bench: ContractDTO[];
}
