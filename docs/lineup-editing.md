# Lineup Editing Architecture

This document describes how a player's lineup is edited (placing, removing,
swapping, and moving contracts, and switching schema) in the team view.

## The `DraftLineup` seam

`dto/lineupMutations.ts` defines the editable state and the operations on it:

```
DraftLineup = {
  formation: DraftFormationDTO; // schema + position->contract map + chemistry
  bench: ContractDTO[];         // contracts not currently placed
}
```

All editing logic is a set of **pure** functions of the shape
`(state: DraftLineup, ...args) => DraftLineup`. They never mutate the input;
they return a new state (or the same reference when nothing changes, e.g.
removing from an empty position or moving onto an occupied slot):

- `assignToPosition(state, position, contract)` — place a contract, displacing
  any current occupant to the bench.
- `removeFromPosition(state, position)` — clear a position, returning its
  contract to the bench.
- `swapSlots(state, fromId, toPos, toId)` — the general move/swap covering every
  source/target combination: position↔position, position↔bench, bench↔bench,
  and bench→position. `toPos` may be the literal `"bench"`; `toId` is the
  contract currently at the target, if any.
- `moveToEmpty(state, fromId, targetPos)` — move onto an empty position only.
- `setSchema(state, nextSchema)` — remap placed contracts to the new schema via
  `changeSchema`. The bench is left untouched; contracts that no longer fit the
  new schema are dropped by `changeSchema` (existing behavior, preserved).

Because the mutations are pure and Vue-free, the branchy slot/bench logic is
unit-tested directly in `frontend/src/tests/formation/lineupMutations.spec.ts`.

## The reactive shell

`frontend/src/composables/useTeamLineup.ts` owns the live reactive state
(`draft`, `benchContracts`) plus server sync, dirty tracking, chemistry, and the
save mutation. Its editing handlers are thin wrappers: snapshot the live state
into a `DraftLineup`, call the matching pure mutation, and write the result back
via `applyMutation`. `TeamPage.vue` continues to call the same handler names, so
no view API changed.

## Related documentation

- Chemistry composition for the placed formation: see
  `docs/chemistry-links.md` (`computeChemistryLinks`).
