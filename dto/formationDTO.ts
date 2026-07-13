import { Temporal } from "@js-temporal/polyfill";
import { ContractDTO } from "./contractDTO";
import {
    Schema,
    Position,
    PositionsForSchema,
    FORMATIONS,
    CHEMISTRY_LINKS,
    ChemistryLevel,
    ChemistryLink,
    ChemistryLinksForSchema,
} from "../model/enums";

// Re-export domain types for consumers that import them from this file.
export type { Schema, Position, PositionsForSchema, ChemistryLink, ChemistryLinksForSchema };
export { CHEMISTRY_LINKS, FORMATIONS, ChemistryLevel };

/**
 * Editable formation used while the user is composing or modifying a lineup.
 * Positions may be missing, so this type should not be considered valid for persistence.
 */
export type DraftFormationDTO<S extends Schema = Schema> = {
    date: Temporal.Instant;
    schema: S;
    formation: Partial<Record<Position, ContractDTO>>;
    chemistry: ChemistryLinksForSchema<S>;
};

/**
 * Complete formation tied to a specific schema.
 * All positions required by the selected schema must be present.
 */
export type FormationDTO<S extends Schema = Schema> = {
    date: Temporal.Instant;
    schema: S;
    formation: Record<PositionsForSchema<S>, ContractDTO>;
    chemistry: ChemistryLinksForSchema<S>;
};

const POSITION_FALLBACKS: Partial<Record<Position, Position[]>> = {
    LW: ["LM", "LST", "RST", "RM"],
    RW: ["RM", "RST", "LST", "LM"],
    ST: ["LST", "RST", "CAM", "CM"],
    LST: ["ST", "LW", "LM", "RST"],
    RST: ["ST", "RW", "RM", "LST"],
    LAM: ["LM", "CAM", "CLM", "ST"],
    CAM: ["ST", "CLM", "CRM", "LAM", "RAM", "CM"],
    RAM: ["RM", "CAM", "CRM", "ST"],
    LM: ["LW", "CLM", "LAM", "CM"],
    CLM: ["CM", "LM", "CRM", "LAM"],
    CM: ["CLM", "CRM", "CAM"],
    CRM: ["CM", "RM", "CLM", "RAM"],
    RM: ["RW", "CRM", "RAM", "CM"],
    LB: ["CLB", "LM"],
    CLB: ["CB", "LB", "CRB"],
    CB: ["CLB", "CRB"],
    CRB: ["CB", "RB", "CLB"],
    RB: ["CRB", "RM"],
    GK: ["GK"],
};

/**
 * Creates a draft formation for the given schema.
 *
 * A draft formation is the editable version used by the UI while the player
 * is building or modifying a lineup. Unlike the final saved formation, a draft
 * may be incomplete, so some positions can still be missing.
 *
 * This is useful when:
 * - the user has just selected a schema,
 * - the user is still assigning contracts to positions,
 * - the schema changes and contracts need to be remapped before validation.
 *
 * @typeParam S - The selected schema type.
 * @param schema - The schema used by the draft formation.
 * @param formation - Optional initial mapping between positions and contracts.
 * @param date - Optional timestamp associated with the draft.
 * @param chemistry
 * @returns A draft formation object.
 */
export function createDraftFormation<S extends Schema>(
    schema: S,
    formation: Partial<Record<Position, ContractDTO>> = {},
    date: Temporal.Instant = Temporal.Now.instant(),
    chemistry: ChemistryLinksForSchema<S> = createChemistryLinks(schema),
): DraftFormationDTO<S> {
    return { schema, formation, date, chemistry };
}

/**
 * Creates a complete formation for the given schema.
 *
 * Unlike a draft formation, this function expects all positions required by the
 * selected schema to be present. TypeScript enforces this at compile time through
 * `Record<PositionsForSchema<S>, ContractDTO>`.
 *
 * Use this when you already know the lineup is complete and valid and want to
 * create the final domain object.
 *
 * @typeParam S - The selected schema type.
 * @param schema - The schema of the final formation.
 * @param formation - A complete mapping of all required schema positions to contracts.
 * @param date - Optional timestamp associated with the formation.
 * @param chemistry
 * @returns A fully typed complete formation.
 */
export function createFormation<S extends Schema>(
    schema: S,
    formation: Record<PositionsForSchema<S>, ContractDTO>,
    date: Temporal.Instant = Temporal.Now.instant(),
    chemistry: ChemistryLinksForSchema<S> = createChemistryLinks(schema),
): FormationDTO<S> {
    return { schema, formation, date, chemistry };
}

export function createChemistryLinks<S extends Schema>(
    schema: S,
    level: ChemistryLevel = "empty",
): ChemistryLinksForSchema<S> {
    return CHEMISTRY_LINKS[schema].map(([from, to]) => ({
        from,
        to,
        level,
    }));
}

function chemistryPairKey(from: string, to: string): string {
    return [from, to].sort().join("-");
}

/**
 * Validates a chemistry-link list against the canonical set of links for the
 * given schema.
 *
 * The input is treated as untrusted: a non-array, entries that are not
 * `{ from, to }` objects (e.g. raw `[from, to]` tuples), missing pairs,
 * duplicates, or pairs outside the schema all fail. It succeeds only when the
 * list is exactly the schema's link topology, each pair present once.
 */
export function validateChemistryLinks(
    schema: Schema,
    chemistry: unknown,
): boolean {
    if (!Array.isArray(chemistry)) return false;

    const expectedPairs = CHEMISTRY_LINKS[schema];
    if (chemistry.length !== expectedPairs.length) return false;

    const expectedSet = new Set(
        expectedPairs.map(([from, to]) => chemistryPairKey(from, to)),
    );
    const seen = new Set<string>();

    for (const link of chemistry) {
        if (
            typeof link !== "object" ||
            link === null ||
            typeof (link as ChemistryLink).from !== "string" ||
            typeof (link as ChemistryLink).to !== "string"
        ) {
            return false;
        }
        const { from, to } = link as ChemistryLink;
        const key = chemistryPairKey(from, to);
        if (!expectedSet.has(key) || seen.has(key)) return false;
        seen.add(key);
    }

    return seen.size === expectedSet.size;
}

/**
 * Returns the given chemistry links when they are well-formed for the schema,
 * otherwise rebuilds them from scratch with empty levels.
 *
 * This is the safety net for data crossing a trust boundary (e.g. an API
 * response): anything that does not pass {@link validateChemistryLinks} — a
 * non-array, raw `[from, to]` tuples, or links that do not match the schema's
 * topology — is replaced, so downstream rendering and validation always receive
 * a coherent {@link ChemistryLink} list.
 */
export function normalizeChemistryLinks<S extends Schema>(
    schema: S,
    chemistry: unknown,
): ChemistryLinksForSchema<S> {
    return validateChemistryLinks(schema, chemistry)
        ? (chemistry as ChemistryLinksForSchema<S>)
        : createChemistryLinks(schema);
}

/**
 * Checks whether a draft formation is complete and coherent for its schema.
 *
 * The validation succeeds only if:
 * - every position required by the selected schema is present,
 * - no extra positions outside the schema are present,
 * - every declared position has a defined contract.
 * - chemistry links match the schema and contain valid levels.
 *
 * This is mainly intended as a runtime safety check before saving or finalizing
 * a draft edited in the UI.
 *
 * @typeParam S - The selected schema type.
 * @param draft - The draft formation to validate.
 * @returns `true` if the draft exactly matches the schema requirements, otherwise `false`.
 */
export function validateDraftFormation<S extends Schema>(
    draft: DraftFormationDTO<S>,
): boolean {
    const expected = FORMATIONS[draft.schema];
    const actual = Object.keys(draft.formation) as Position[];

    if (actual.length !== expected.length) return false;

    const expectedSet = new Set<Position>(expected);

    for (const pos of actual) {
        if (!expectedSet.has(pos)) return false;
        if (draft.formation[pos] == null) return false;
    }

    if (!expected.every((pos) => draft.formation[pos] != null)) return false;

    return validateChemistryLinks(draft.schema, draft.chemistry);
}

/**
 * Type guard that tells TypeScript whether a draft formation can be treated
 * as a complete final formation (i.e. every schema position is filled).
 *
 * Internally this uses `validateDraftFormation`. If it returns `true`, the draft
 * is narrowed from `DraftFormationDTO<S>` to `FormationDTO<S>`.
 *
 * Note: completeness is NOT a precondition for saving — a partial lineup is a
 * valid thing to persist (see {@link isValidFormation}). Use this only when a
 * call site genuinely requires every slot to be filled.
 *
 * @typeParam S - The selected schema type.
 * @param draft - The draft formation to check.
 * @returns `true` if the draft is complete and can be treated as a final formation.
 */
export function isCompleteFormation<S extends Schema>(
    draft: DraftFormationDTO<S>,
): draft is FormationDTO<S> {
    return validateDraftFormation(draft);
}

/**
 * Checks whether a draft formation is structurally valid for persistence.
 *
 * Unlike {@link isCompleteFormation}, this does NOT require every schema position
 * to be filled — a partial lineup is a legitimate save. The scorer simply awards
 * no points for an empty slot, so there is no reason to block a player from
 * saving a half-built formation.
 *
 * Validation succeeds when:
 * - every occupied position belongs to the selected schema,
 * - no occupied position holds a null/undefined contract,
 * - the chemistry links match the schema.
 *
 * @typeParam S - The selected schema type.
 * @param draft - The draft formation to validate.
 * @returns `true` if the draft can be safely persisted, otherwise `false`.
 */
export function isValidFormation<S extends Schema>(
    draft: DraftFormationDTO<S>,
): boolean {
    const validPositions = new Set<Position>(FORMATIONS[draft.schema]);
    for (const [position, contract] of Object.entries(draft.formation)) {
        if (!validPositions.has(position as Position)) return false;
        if (contract == null) return false;
    }
    return validateChemistryLinks(draft.schema, draft.chemistry);
}

/**
 * Remaps contracts from one schema to another.
 *
 * The remapping happens in two phases:
 * 1. Contracts already placed on positions that also exist in the target schema
 *    are kept in the same position.
 * 2. Contracts from positions that do not exist anymore are collected and moved
 *    into the missing positions of the target schema.
 *
 * When possible, leftover contracts are assigned using the preferred fallback
 * positions defined in `POSITION_FALLBACKS`. If no preferred position is available,
 * they are placed in the first remaining free slot of the target schema.
 *
 * This function is intended for schema changes from the UI, for example when the
 * user switches from `4-3-3` to `4-4-2` in a dropdown and expects already placed
 * contracts to be preserved as much as possible.
 *
 * @param current - The current editable formation.
 * @param fromSchema - The schema currently used by the formation.
 * @param toSchema - The target schema to remap to.
 * @returns A new partial formation remapped to the target schema.
 */
export function remapFormation(
    current: Partial<Record<Position, ContractDTO>>,
    fromSchema: Schema,
    toSchema: Schema,
): Partial<Record<Position, ContractDTO>> {
    const fromPositions = FORMATIONS[fromSchema];
    const toPositions = FORMATIONS[toSchema];

    const next: Partial<Record<Position, ContractDTO>> = {};
    const leftovers: Array<{ from: Position; contract: ContractDTO }> = [];
    const toSet = new Set<Position>(toPositions);

    for (const position of fromPositions) {
        const contract = current[position];
        if (!contract) continue;

        if (toSet.has(position)) {
            next[position] = contract;
        } else {
            leftovers.push({ from: position, contract });
        }
    }

    for (const { from, contract } of leftovers) {
        const preferredTargets = POSITION_FALLBACKS[from] ?? [];
        const target = preferredTargets.find(
            (pos) => toSet.has(pos) && next[pos] === undefined,
        );

        if (target) {
            next[target] = contract;
        }
    }

    for (const { contract } of leftovers) {
        const alreadyPlaced = Object.values(next).includes(contract);
        if (alreadyPlaced) continue;

        const target = toPositions.find((pos) => next[pos] === undefined);
        if (target) {
            next[target] = contract;
        }
    }

    return next;
}

/**
 * Changes the schema of a draft formation and automatically remaps its contracts.
 *
 * This is a convenience wrapper around `remapFormation`. It keeps the draft date,
 * replaces the schema, and produces a new draft formation whose positions match
 * the new schema as closely as possible.
 *
 * Typical use case:
 * - the user changes the schema from a select/dropdown,
 * - contracts already on compatible positions stay where they are,
 * - the remaining contracts are reassigned to the new missing positions.
 *
 * @param draft - The current draft formation.
 * @param nextSchema - The new schema selected by the user.
 * @returns A new draft formation updated to the new schema.
 */
export function changeSchema(
    draft: DraftFormationDTO,
    nextSchema: Schema,
): DraftFormationDTO {
    return {
        date: draft.date,
        schema: nextSchema,
        formation: remapFormation(draft.formation, draft.schema, nextSchema),
        chemistry: createChemistryLinks(nextSchema),
    };
}

/**
 * Converts a draft formation into a final formation if it is complete.
 *
 * This function is useful at the boundary between UI editing and persistence.
 * If the draft matches the schema exactly, it is returned as a final formation.
 * Otherwise, `null` is returned.
 *
 * Use this before saving a lineup to ensure that incomplete or invalid drafts
 * are not persisted as valid formations.
 *
 * @typeParam S - The selected schema type.
 * @param draft - The draft formation to finalize.
 * @returns A complete formation if valid, otherwise `null`.
 */
export function finalizeDraft<S extends Schema>(
    draft: DraftFormationDTO<S>,
): FormationDTO<S> | null {
    if (!validateDraftFormation(draft)) return null;
    return draft as FormationDTO<S>;
}

/**
 * Composes the chemistry links for a formation from a map of article links.
 *
 * This is the single place that turns "a schema + the contracts placed on it +
 * the Wikimedia links of each placed article" into a fully leveled list of
 * {@link ChemistryLink}. For each schema-defined pair it looks up the two
 * placed articles, resolves their linked-article lists from `linksMap`, and
 * derives the level via {@link calculateChemistry} (EMPTY when a slot is empty).
 *
 * The fetching of linked articles and any staleness handling are the caller's
 * responsibility (see `useTeamLineup`); this function is pure and synchronous.
 *
 * @typeParam S - The selected schema type.
 * @param schema - The schema whose link topology drives the result.
 * @param formation - The (possibly partial) mapping of positions to contracts.
 * @param linksMap - Map from article title to the titles it links to.
 * @returns The schema's chemistry links, each carrying a resolved level.
 */
export function computeChemistryLinks<S extends Schema>(
    schema: S,
    formation: Partial<Record<Position, ContractDTO>>,
    linksMap: Map<string, string[]>,
): ChemistryLinksForSchema<S> {
    return createChemistryLinks(schema).map((link) => {
        const title1 = formation[link.from]?.article.title;
        const title2 = formation[link.to]?.article.title;
        const links1 = title1 ? (linksMap.get(title1) ?? []) : [];
        const links2 = title2 ? (linksMap.get(title2) ?? []) : [];
        const level = calculateChemistry(title1, links1, title2, links2);
        return { ...link, level };
    });
}

/**
 * Folds a Wikipedia title to a canonical match key: case-insensitive and with
 * spaces/underscores unified. A contract's `article.title` is the underscored
 * canonical form (`Cristiano_Ronaldo`), while Wikimedia link titles come back
 * in display form (`Cristiano Ronaldo`) — without this fold an exact-string
 * compare never matches, so every link resolved to WEAK (red). Mirrors
 * `normKey` in the market service.
 */
function chemistryKey(title: string): string {
    return title.trim().toLowerCase().replace(/[ _]+/g, "_");
}

export function calculateChemistry(
    article1: string | null | undefined,
    links1: string[],
    article2: string | null | undefined,
    links2: string[]
): ChemistryLevel {
    if (!article1 || !article2) {
        return ChemistryLevel.EMPTY;
    }

    const links1Keys = new Set(links1.map(chemistryKey));
    const links2Keys = new Set(links2.map(chemistryKey));
    const oneLinksToTwo = links1Keys.has(chemistryKey(article2));
    const twoLinksToOne = links2Keys.has(chemistryKey(article1));

    if (oneLinksToTwo && twoLinksToOne) {
        return ChemistryLevel.EXCELLENT;
    }

    if (oneLinksToTwo || twoLinksToOne) {
        return ChemistryLevel.GOOD;
    }

    return ChemistryLevel.WEAK;
}