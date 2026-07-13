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

export function isSchema(value: unknown): value is Schema {
    return typeof value === "string" && value in FORMATIONS;
}

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
        ["RST", "RM"],
        ["LM", "CLB"],
        ["CLM", "CLB"],
        ["CRM", "CRB"],
        ["RM", "CRB"],
        ["CLB", "GK"],
        ["CRB", "GK"],
    ],
    "4-2-3-1": [
        ["ST", "LAM"],
        ["LAM", "CAM"],
        ["CAM", "RAM"],
        ["RAM", "ST"],
        ["CLM", "CRM"],
        ["LB", "CLB"],
        ["CLB", "CRB"],
        ["CRB", "RB"],
        ["LAM", "CLM"],
        ["RAM", "CRM"],
        ["CLM", "CLB"],
        ["CRM", "CRB"],
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
        ["RST", "CRM"],
        ["CLM", "CLB"],
        ["CRM", "CRB"],
        ["CLB", "GK"],
        ["CRB", "GK"],
    ],
} as const satisfies Record<Schema, readonly (readonly [Position, Position])[]>;

export const ChemistryLevel = {
    EMPTY:     'empty',
    WEAK:      'weak',
    GOOD:      'good',
    EXCELLENT: 'excellent',
} as const;

export type ChemistryLevel = typeof ChemistryLevel[keyof typeof ChemistryLevel];

/**
 * Additive flat points contributed by one Chemistry Link, summed over the
 * schema topology. Chemistry is additive, never a multiplier — see
 * docs/domain/chemistry-links.md and docs/domain/scoring-system.md §4.
 */
export const CHEMISTRY_POINTS_BY_LEVEL = {
    excellent: 1.5,
    good: 0.5,
    weak: 0,
    empty: 0,
} as const satisfies Record<ChemistryLevel, number>;

export type ChemistryLink<S extends Schema = Schema> = {
    from: PositionsForSchema<S>;
    to: PositionsForSchema<S>;
    level: ChemistryLevel;
};

export type ChemistryLinksForSchema<S extends Schema = Schema> = ChemistryLink<S>[];
