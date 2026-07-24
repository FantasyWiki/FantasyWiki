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
    "3-5-2": ["LST", "RST", "LM", "CM", "RM", "CDLM", "CDRM", "LB", "CB", "RB", "GK"],
    "4-2-3-1": ["ST", "CLAM", "CM", "CRAM", "LDM", "RDM", "LB", "CLB", "CRB", "RB", "GK"],
    "5-3-2": ["LST", "RST", "CLM", "CM", "CRM", "LDM", "CLB", "CB", "CRB", "RDM", "GK"],
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
        ["LST", "LM"],
        ["RST", "RM"],
        ["LST", "CM"],
        ["RST", "CM"],
        ["LM", "CDLM"],
        ["CDLM", "CM"],
        ["CM", "CDRM"],
        ["CDRM", "RM"],
        ["LB", "CB"],
        ["CB", "RB"],
        ["LM", "LB"],
        ["CDLM", "LB"],
        ["CDRM", "RB"],
        ["CDLM", "CB"],
        ["CDRM", "CB"],
        ["RM", "RB"],
        ["CB", "GK"],
        ["LB", "GK"],
        ["RB", "GK"],
    ],
    "4-2-3-1": [
        ["ST", "CLAM"],
        ["ST", "CRAM"],
        ["ST","CM"],
        ["CLAM","CM"],
        ["CRAM","CM"],
        ["CLAM","LDM"],
        ["CRAM","RDM"],
        ["LDM","CM"],
        ["RDM","CM"],
        ["LDM","LB"],
        ["LDM","CLB"],
        ["RDM","RB"],
        ["RDM","CRB"],
        ["LB","CLB"],
        ["RB","CRB"],
        ["CLB","CRB"],
        ["CLB","GK"],
        ["CRB","GK"],
    ],
    "5-3-2": [
        ["LST", "RST"],
        ["LST", "CLM"],
        ["RST", "CRM"],
        ["LST", "CM"],
        ["RST", "CM"],
        ["CLM", "CM"],
        ["CRM", "CM"],
        ["CLM", "LDM"],
        ["CRM", "RDM"],
        ["LDM", "CLB"],
        ["RDM", "CRB"],
        ["CLM", "CLB"],
        ["CRM", "CRB"],
        ["CM", "CB"],
        ["CLB", "CB"],
        ["CRB", "CB"],
        ["CLB", "GK"],
        ["CRB", "GK"],
        ["CB", "GK"],

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

/**
 * @deprecated LEGACY / DISPLAY-ONLY — NOT the scoring model. Canonical daily
 * scoring treats chemistry as **additive flat points** (+1.5 mutual / +0.5
 * one-way), never a multiplier (see CHEMISTRY_POINTS_BY_LEVEL above,
 * docs/domain/chemistry-links.md and docs/domain/scoring-system.md §4). Do NOT
 * feed these multipliers into any scoring path (backend or the Kotlin scoring
 * engine). Retained only because it is still re-exported by dto/formationDTO.ts;
 * safe to delete once no importer remains.
 */
export const CHEMISTRY_MULTIPLIER_BY_LEVEL = {
    excellent: 1.2,
    good: 1.1,
    weak: 1.05,
    empty: 1.0,
} as const satisfies Record<ChemistryLevel, number>;

export type ChemistryLink<S extends Schema = Schema> = {
    from: PositionsForSchema<S>;
    to: PositionsForSchema<S>;
    level: ChemistryLevel;
};

export type ChemistryLinksForSchema<S extends Schema = Schema> = ChemistryLink<S>[];
