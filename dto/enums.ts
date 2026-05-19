export type Domain = "en" | "it";

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

export type PositionsForSchema<S extends Schema> = typeof FORMATIONS[S][number];

export const CHEMISTRY_LINKS = {
    "4-3-3": [
        ["LW", "ST"],
        ["ST", "RW"],
        ["CLM", "CM"],
        ["CM", "CRM"],
        ["LB", "CLB"],
        ["CLB", "CRB"],
        ["CRB", "RB"],
        ["LW", "CLM"],
        ["ST", "CM"],
        ["RW", "CRM"],
        ["LB", "CLM"],
        ["CM", "CLB"],
        ["CM", "CRB"],
        ["RB", "CRM"],
        ["CLB", "GK"],
        ["CRB", "GK"],
    ],
    "4-4-2": [
        ["LST", "RST"],
        ["LM", "CLM"],
        ["CLM", "CRM"],
        ["CRM", "RM"],
        ["LB", "CLB"],
        ["CLB", "CRB"],
        ["CRB", "RB"],
        ["LST", "LM"],
        ["LST", "CLM"],
        ["RST", "CRM"],
        ["RST", "RM"],
        ["LM", "LB"],
        ["CLM", "CLB"],
        ["CRM", "CRB"],
        ["RM", "RB"],
        ["CLB", "GK"],
        ["CRB", "GK"],
    ],
    "3-5-2": [
        ["LST", "RST"],
        ["LM", "CLM"],
        ["CLM", "CM"],
        ["CM", "CRM"],
        ["CRM", "RM"],
        ["CLB", "CB"],
        ["CB", "CRB"],
        ["LST", "LM"],
        ["LST", "CM"],
        ["RST", "CM"],
        ["RST", "RM"],
        ["LM", "CLB"],
        ["CLM", "CLB"],
        ["CLM", "CB"],
        ["CM", "CB"],
        ["CRM", "CRB"],
        ["CRM", "CB"],
        ["RM", "CRB"],
        ["CLB", "GK"],
        ["CB", "GK"],
        ["CRB", "GK"],
    ],
    "4-2-3-1": [
        ["LAM", "CAM"],
        ["CAM", "RAM"],
        ["CLM", "CRM"],
        ["LB", "CLB"],
        ["CLB", "CRB"],
        ["CRB", "RB"],
        ["ST", "CAM"],
        ["ST", "RAM"],
        ["ST", "LAM"],
        ["LAM", "CLM"],
        ["CAM", "CLM"],
        ["CAM", "CRM"],
        ["RAM", "CRM"],
        ["LB", "CLM"],
        ["CLM", "CLB"],
        ["CRM", "CRB"],
        ["RB", "CRM"],
        ["CLB", "GK"],
        ["CRB", "GK"],
    ],
    "5-3-2": [
        ["LST", "RST"],
        ["CLM", "CM"],
        ["CM", "CRM"],
        ["LB", "CLB"],
        ["CLB", "CB"],
        ["CB", "CRB"],
        ["CRB", "RB"],
        ["LST", "CLM"],
        ["LST", "CM"],
        ["RST", "CRM"],
        ["RST", "CM"],
        ["LB", "CLM"],
        ["CLM", "CLB"],
        ["CM", "CB"],
        ["CRM", "CRB"],
        ["RB", "CRM"],
        ["CLB", "GK"],
        ["CB", "GK"],
        ["CRB", "GK"],
    ],
} as const satisfies {
    [S in Schema]: readonly (readonly [
        PositionsForSchema<S>,
        PositionsForSchema<S>,
    ])[];
};