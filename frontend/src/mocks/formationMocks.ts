import {
  createDraftFormation,
  createFormation,
  type DraftFormationDTO,
  type FormationDTO,
} from "../../../dto/formationDTO";
import type { TeamLineUp } from "@/types/team";
import { contracts } from "@/mocks/data/contracts";

function getContractById(contractId: string) {
  const contract = contracts.find((c) => c.id === contractId);
  if (!contract) {
    throw new Error(`Missing mock contract: ${contractId}`);
  }
  return contract;
}

// All these contracts belong to team-1.
const contractsByPosition = {
  GK: getContractById("ctr-1"),
  RB: getContractById("ctr-2"),
  CRB: getContractById("ctr-3"),
  CLB: getContractById("ctr-4"),
  LB: getContractById("ctr-7"),
  CRM: getContractById("ctr-8"),
  CM: getContractById("ctr-9"),
  CLM: getContractById("ctr-10"),
  RW: getContractById("ctr-11"),
  ST: getContractById("ctr-12"),
  LW: getContractById("ctr-13"),
} as const;

export const mockFormationBench = [
  getContractById("ctr-14"),
  getContractById("ctr-15"),
];

/** Complete 4-3-3 formation with all required positions filled. */
export const mockFullFormation433: FormationDTO<"4-3-3"> = createFormation(
  "4-3-3",
  {
    LW: contractsByPosition.LW,
    ST: contractsByPosition.ST,
    RW: contractsByPosition.RW,
    CLM: contractsByPosition.CLM,
    CM: contractsByPosition.CM,
    CRM: contractsByPosition.CRM,
    LB: contractsByPosition.LB,
    CLB: contractsByPosition.CLB,
    CRB: contractsByPosition.CRB,
    RB: contractsByPosition.RB,
    GK: contractsByPosition.GK,
  }
);

/** Draft 4-3-3 formation with missing slots to preview empty positions in TeamFormation. */
export const mockDraftFormation433: DraftFormationDTO<"4-3-3"> =
  createDraftFormation("4-3-3", {
    LW: contractsByPosition.LW,
    ST: contractsByPosition.ST,
    CM: contractsByPosition.CM,
    LB: contractsByPosition.LB,
    CLB: contractsByPosition.CLB,
    GK: contractsByPosition.GK,
  });

export const mockTeamResponse: TeamLineUp = {
  // TeamResponse expects FormationDTO generic; we return a concrete 4-3-3 formation.
  formation: mockFullFormation433 as unknown as FormationDTO,
  bench: mockFormationBench,
};

