import { Temporal } from "@js-temporal/polyfill";
import { ContractDTO } from "./contractDTO";
import { FORMATIONS } from "./enums";

export type Schema = keyof typeof FORMATIONS;
export type Position = typeof FORMATIONS[Schema][number];
export type PositionsForSchema<S extends Schema> = typeof FORMATIONS[S][number];

/**
 * Editable formation used while the user is composing or modifying a lineup.
 * Positions may be missing, so this type should not be considered valid for persistence.
 */
export type DraftFormationDTO<S extends Schema = Schema> = {
    date: Temporal.Instant;
    schema: S;
    formation: Partial<Record<Position, ContractDTO>>;
};

/**
 * Complete formation tied to a specific schema.
 * All positions required by the selected schema must be present.
 */
export type FormationDTO<S extends Schema = Schema> = {
    date: Temporal.Instant;
    schema: S;
    formation: Record<PositionsForSchema<S>, ContractDTO>;
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
 * @returns A draft formation object.
 */
export function createDraftFormation<S extends Schema>(
    schema: S,
    formation: Partial<Record<Position, ContractDTO>> = {},
    date: Temporal.Instant = Temporal.Now.instant(),
): DraftFormationDTO<S> {
    return { schema, formation, date };
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
 * @returns A fully typed complete formation.
 */
export function createFormation<S extends Schema>(
    schema: S,
    formation: Record<PositionsForSchema<S>, ContractDTO>,
    date: Temporal.Instant = Temporal.Now.instant(),
): FormationDTO<S> {
    return { schema, formation, date };
}

/**
 * Checks whether a draft formation is complete and coherent for its schema.
 *
 * The validation succeeds only if:
 * - every position required by the selected schema is present,
 * - no extra positions outside the schema are present,
 * - every declared position has a defined contract.
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

    return expected.every((pos) => draft.formation[pos] != null);
}

/**
 * Type guard that tells TypeScript whether a draft formation can be treated
 * as a complete final formation.
 *
 * Internally this uses `validateDraftFormation`. If it returns `true`, the draft
 * is narrowed from `DraftFormationDTO<S>` to `FormationDTO<S>`.
 *
 * This is useful when you want both runtime validation and compile-time narrowing
 * in the same `if` block.
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