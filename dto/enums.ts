import {FormationDTO} from "./formationDTO";

export type Enums = "en" | "it";

export type Schema = "4-3-3" | "3-5-2" | '4-4-2' | '4-2-3-1' | '5-3-2';

export type Position =
    "LW"  | "LST"  | "ST"  | "RST"  | "RW"  |
    "LAM" | "CLAM" | "CAM" | "CRAM" | "RAM" |
    "LM"  | "CLM"  | "CM"  | "CRM"  | "RM"  |
    "LDM" | "CDLM" | "CDM" | "CDRM" | "RDM" |
    "LB"  | "CLB"  | "CB"  | "CRB"  | "RB"  | "GK";


export const FORMATIONS = {
    "4-3-3": ["LW", "ST", "RW", "CLM", "CM", "CRM", "LB", "CLB", "CRB", "RB", "GK"],
    "4-4-2": ["LST", "RST", "LM", "CLM", "CRM", "RM", "LB", "CLB", "CRB", "RB", "GK"],
    "3-5-2": ["LST", "RST", "LM", "CLM", "CM", "CRM", "RM", "CLB", "CB", "CRB", "GK"],
    "4-2-3-1": ["ST", "LAM", "CAM", "RAM", "CLM", "CRM", "LB", "CLB", "CRB", "RB", "GK"],
    "5-3-2": ["LST", "RST", "CLM", "CM", "CRM", "LB", "CLB", "CB", "CRB", "RB", "GK"],
} as const satisfies Record<Schema, readonly Position[]>;