import { ContractDTO } from "./contractDTO";
import {
    changeSchema,
    type DraftFormationDTO,
    type Position,
    type Schema,
} from "./formationDTO";

/**
 * The editable lineup state manipulated while a player composes a team:
 * the draft formation plus the contracts currently sitting on the bench.
 *
 * Every mutation in this module is a pure `(state, ...args) => DraftLineup`
 * transform that returns a new state (or the same reference when nothing
 * changes), so the slot/bench logic can be unit-tested without Vue. The
 * `useTeamLineup` composable is the reactive shell that holds the live state
 * and delegates to these functions.
 */
export type DraftLineup = {
    formation: DraftFormationDTO;
    bench: ContractDTO[];
};

/** Finds the position currently holding the contract with the given id. */
function findPosition(
    formationMap: Partial<Record<Position, ContractDTO>>,
    id: string,
): Position | undefined {
    return (Object.entries(formationMap) as [Position, ContractDTO][]).find(
        ([, c]) => c.id === id,
    )?.[0];
}

/**
 * Places a contract on a position. Any current occupant is displaced to the
 * bench, and the assigned contract is removed from the bench if it was there.
 */
export function assignToPosition(
    state: DraftLineup,
    position: Position,
    contract: ContractDTO,
): DraftLineup {
    const displaced = state.formation.formation[position] ?? null;
    const formationMap = { ...state.formation.formation, [position]: contract };
    let bench = state.bench.filter((c) => c.id !== contract.id);
    if (displaced && displaced.id !== contract.id) {
        bench = [...bench, displaced];
    }
    return { formation: { ...state.formation, formation: formationMap }, bench };
}

/** Removes the contract on a position and returns it to the bench. */
export function removeFromPosition(
    state: DraftLineup,
    position: Position,
): DraftLineup {
    const contract = state.formation.formation[position];
    if (!contract) return state;
    const formationMap = { ...state.formation.formation };
    delete formationMap[position];
    return {
        formation: { ...state.formation, formation: formationMap },
        bench: [...state.bench, contract],
    };
}

/**
 * Moves the contract identified by `fromId` onto `toPos`, handling every
 * source/target combination (position↔position, position↔bench, bench↔bench,
 * bench→position). `toPos` may be the literal `"bench"`; `toId` is the contract
 * currently at the target, if any.
 */
export function swapSlots(
    state: DraftLineup,
    fromId: string,
    toPos: string,
    toId: string | null,
): DraftLineup {
    const map = state.formation.formation;
    const fromPos = findPosition(map, fromId);
    const fromOnBench = state.bench.some((c) => c.id === fromId);
    const fromContract =
        (fromPos ? map[fromPos] : null) ??
        state.bench.find((c) => c.id === fromId) ??
        null;

    if (!fromContract) return state;

    if (toPos === "bench") {
        let formationMap = map;
        if (fromPos) {
            formationMap = { ...map };
            if (toId) {
                const toContract = state.bench.find((c) => c.id === toId);
                if (toContract) formationMap[fromPos] = toContract;
                else delete formationMap[fromPos];
            } else {
                delete formationMap[fromPos];
            }
        }

        let bench = state.bench;
        if (!fromOnBench) {
            bench = [...state.bench.filter((c) => c.id !== toId), fromContract];
        } else if (fromOnBench && toId) {
            bench = [...state.bench];
            const a = bench.findIndex((c) => c.id === fromId);
            const b = bench.findIndex((c) => c.id === toId);
            if (a !== -1 && b !== -1) [bench[a], bench[b]] = [bench[b], bench[a]];
        }

        return { formation: { ...state.formation, formation: formationMap }, bench };
    }

    const targetPos = toPos as Position;
    const toContract =
        map[targetPos] ?? state.bench.find((c) => c.id === toId) ?? null;
    const formationMap = { ...map };
    formationMap[targetPos] = fromContract;

    let bench = state.bench;
    if (fromPos) {
        if (toContract) formationMap[fromPos] = toContract;
        else delete formationMap[fromPos];
    } else if (fromOnBench) {
        bench = state.bench.filter((c) => c.id !== fromId);
        if (toContract) bench = [...bench, toContract];
    }

    return { formation: { ...state.formation, formation: formationMap }, bench };
}

/**
 * Moves the contract identified by `fromId` onto an empty `targetPos`.
 * No-op when the contract cannot be found or the target is already occupied.
 */
export function moveToEmpty(
    state: DraftLineup,
    fromId: string,
    targetPos: Position,
): DraftLineup {
    const map = state.formation.formation;
    const fromPos = findPosition(map, fromId);
    const fromOnBench = state.bench.some((c) => c.id === fromId);
    const fromContract =
        (fromPos ? map[fromPos] : null) ??
        state.bench.find((c) => c.id === fromId) ??
        null;

    if (!fromContract || map[targetPos]) return state;

    const formationMap = { ...map };
    formationMap[targetPos] = fromContract;
    let bench = state.bench;
    if (fromPos) delete formationMap[fromPos];
    else if (fromOnBench) bench = state.bench.filter((c) => c.id !== fromId);

    return { formation: { ...state.formation, formation: formationMap }, bench };
}

/**
 * Switches the draft to a new schema, remapping placed contracts via
 * `changeSchema`. Any contract that the remap cannot carry into the new schema
 * is appended to the bench instead of being silently dropped, so no contract is
 * ever lost on a schema change. The bench reference is preserved when nothing
 * was dropped.
 */
export function setSchema(state: DraftLineup, nextSchema: Schema): DraftLineup {
    const nextFormation = changeSchema(state.formation, nextSchema);

    const carriedIds = new Set(
        Object.values(nextFormation.formation)
            .filter((c): c is ContractDTO => !!c)
            .map((c) => c.id),
    );
    const dropped = Object.values(state.formation.formation).filter(
        (c): c is ContractDTO => !!c && !carriedIds.has(c.id),
    );

    return {
        formation: nextFormation,
        bench: dropped.length ? [...state.bench, ...dropped] : state.bench,
    };
}
