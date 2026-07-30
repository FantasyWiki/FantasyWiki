---
title: Lineup Editing
type: architecture
tags: [formation, lineup, frontend, dto, composables]
---

# Lineup Editing (architecture)

How a player's lineup is edited in code — placing, removing, swapping, and moving
contracts, and switching schema. The **rules** these operations enforce (nothing
is ever dropped, 11 positions, bench semantics) live in
[Lineup Rules (domain)](../domain/lineup-rules.md).

## The `DraftLineup` seam

`dto/lineupMutations.ts` defines the editable state and the operations on it:

```
DraftLineup = {
  formation: DraftFormationDTO; // schema + position->contract map + chemistry
  bench: ContractDTO[];         // contracts not currently placed
}
```

All editing logic is a set of **pure** functions of the shape
`(state: DraftLineup, ...args) => DraftLineup`. They never mutate the input; they
return a new state (or the same reference when nothing changes, e.g. removing
from an empty position or moving onto an occupied slot):

- `assignToPosition(state, position, contract)` — place a contract, displacing
  any current occupant to the bench.
- `removeFromPosition(state, position)` — clear a position, returning its
  contract to the bench.
- `swapSlots(state, fromId, toPos, toId)` — the general move/swap covering every
  source/target combination: position↔position, position↔bench, bench↔bench, and
  bench→position. `toPos` may be the literal `"bench"`; `toId` is the contract
  currently at the target, if any.
- `moveToEmpty(state, fromId, targetPos)` — move onto an empty position only.
- `setSchema(state, nextSchema)` — remap placed contracts to the new schema via
  `changeSchema`. Any contract the remap cannot carry into the new schema is
  appended to the bench rather than silently dropped, so no contract is ever lost
  on a schema change. The bench reference is preserved when nothing is dropped.

Because the mutations are pure and Vue-free, the branchy slot/bench logic is
unit-tested directly in `frontend/src/tests/formation/lineupMutations.spec.ts`.

## The reactive shell

`frontend/src/composables/useTeamLineup.ts` owns the live reactive state
(`draft`, `benchContracts`) plus server sync, dirty tracking, chemistry, and the
save mutation. Its editing handlers are thin wrappers: snapshot the live state
into a `DraftLineup`, call the matching pure mutation, and write the result back
via `applyMutation`. `TeamPage.vue` calls the same handler names, so no view API
changed.

## Touch input

`ArticleNode.vue` accepts drops from two input paths that both resolve to the
same `swap` / `dropOnEmpty` emits:

- **HTML5 drag-and-drop** (mouse/desktop) — unreliable on touch devices, so it
  stays mouse-only.
- **Long-press-and-drag** (`frontend/src/composables/useTouchDragDrop.ts`) —
  a long press lifts a floating clone that follows the finger; releasing over
  another article swaps, over an empty pitch slot moves. It autoscrolls the
  nearest `ion-content` near the viewport edges so a bench tile can reach an
  off-screen pitch row without scrolling by hand first. The hit-test that
  turns a drop point into a swap/move/no-op decision (`resolveDrop`) is a pure
  function of the target element's `data-article-id`/`data-position`
  attributes, kept separate from the gesture/DOM-geometry code so it can be
  unit-tested directly.

`TeamFormation`/`BenchSection` re-emit an ArticleNode's `dropOnEmpty` as their
own `moveToEmpty`, so both input paths land on the exact same
`useTeamLineup` handlers described above. An `editable` prop threads down to
disable both paths on read-only hosts (the dashboard preview).

## The pitch renders placements, not contracts

`TeamFormation` draws two things that are expensive to own twice: ~60 lines of
hand-tuned SVG pitch markings, and the `ResizeObserver`-driven chemistry-link
overlay. A second, read-only pitch would be a copy of both, so there is exactly
one pitch component and it is shared with hosts that have no contracts at all —
notably the historical formation of a scored day, which resolves to article
titles and never to contract rows (see
[Performance Snapshots](./performance-snapshots.md)).

Sharing it means the pitch may only depend on what every host can supply:

```
PlacedArticle = { id: string; article: ArticleDTO }
```

That is the whole contract of a tile — something to key drag/swap on, and a
title to show. `ArticleNode` takes a `PlacedArticle`; `DraftFormationDTO` is
generic in its slot type with `ContractDTO` as the default, so every existing
reference (including `lineupMutations` and its tests) keeps its current meaning:

```ts
DraftFormationDTO<S extends Schema = Schema, A = ContractDTO>
```

`TeamFormation` is a `generic="A extends PlacedArticle"` component, so
`articleClick` emits back the same type the host passed in — the lineup editor
still receives a real `ContractDTO`, with no cast at the call site.

`BenchSection` stays `ContractDTO`: a bench only ever holds contracts a player
currently owns, so there is nothing to generalize.

### The badge is the host's decision

The tile's small badge is the one thing hosts disagree about — the editor shows
the contract tier, the historical pitch shows that day's views, and a snapshot
has no tier to show. Rather than teach `ArticleNode` about both, the host passes
a `badgeFor?: (a: A) => Badge | undefined` to `TeamFormation`.

The alternative — a `badge` getter on `ContractDTO` — was rejected: `dto/` is
shared with the backend and must stay framework-agnostic, and a `{ text, tone }`
pair is presentation, with `tone` being nothing but styling.

## Related documentation

- [Lineup Rules (domain)](../domain/lineup-rules.md) — the invariants the
  mutations exist to uphold.
- [Performance Snapshots](./performance-snapshots.md) — the read-only host that
  drove the pitch's dependency down to `PlacedArticle`.
- [Chemistry Links Rendering](./chemistry-links-rendering.md) — chemistry
  composition for the placed formation (`computeChemistryLinks`).
