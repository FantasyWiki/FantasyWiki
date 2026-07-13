---
title: Chemistry Links Rendering
type: architecture
tags: [chemistry, formation, frontend, dto, svg]
---

# Chemistry Links Rendering (architecture)

How chemistry links are modeled in code and drawn in the formation view. The
**rules** — what a link is, how a level is earned, what it scores — live in
[Chemistry Links (domain)](../domain/chemistry-links.md).

## Data model

### Schema-driven link list

`dto/enums.ts` defines `CHEMISTRY_LINKS` alongside `FORMATIONS` to keep the link
topology per schema (4-3-3, 4-4-2, …) compile-time checked:

- Each schema maps to a list of position pairs, e.g. `["LW", "ST"]`.
- The list is the canonical structure for that schema.
- This mirrors `FORMATIONS`, so the topology lives in the same place as schema
  positions.

### Chemistry levels

`dto/formationDTO.ts` defines:

- `ChemistryLevel`: `excellent | good | weak | empty`
- `ChemistryLink`: `{ from, to, level }`
- `createChemistryLinks(schema)` which expands `CHEMISTRY_LINKS[schema]` into a
  list of `ChemistryLink` objects with default `level: "empty"`.

The per-level score value is `CHEMISTRY_POINTS_BY_LEVEL` in `model/enums.ts` —
**additive flat points**, not a multiplier.

Both `DraftFormationDTO` and `FormationDTO` carry:

```
chemistry: ChemistryLink[]
```

`validateChemistryLinks` ensures the runtime list matches the schema topology and
contains only valid levels.

### Composing leveled links

`computeChemistryLinks(schema, formation, linksMap)` (also in
`dto/formationDTO.ts`) is the single, pure function that turns a schema plus the
contracts placed on it plus each placed article's Wikimedia links into a fully
leveled `ChemistryLink[]`. For every schema pair it resolves the two placed
article titles, looks up their linked-article lists in `linksMap`
(`Map<title, string[]>`), and derives the level via `calculateChemistry`
(`empty` when a slot is unfilled).

**Title normalization matters.** `chemistryKey` folds titles to a canonical form
(trim, lowercase, spaces/underscores collapsed to `_`) before comparing. Without
this fold, Wikimedia's link form (`Cristiano_Ronaldo`) never string-matches the
display form (`Cristiano Ronaldo`) and *every* link silently resolves to `weak`.
It mirrors `normKey` in the market service.

Fetching the linked articles and discarding stale results when the formation
changes mid-fetch stays in `frontend/src/composables/useTeamLineup.ts`; the
composable builds `linksMap` from the Wikimedia responses and then calls
`computeChemistryLinks`. Keeping composition pure means it is unit-tested
directly (`frontend/src/tests/formation/ChemistryLinks.spec.ts`) without any Vue
or network setup.

## Rendering in the formation view

`frontend/src/components/formation/TeamFormation.vue` renders links using an SVG
overlay that draws lines between the actual DOM positions of nodes.

### Anchor strategy

- Each position element (filled `ArticleNode` or empty slot) has
  `data-position="<POS>"`.
- `updateAnchors()` reads `getBoundingClientRect()` for each element and stores
  center points in `anchorMap`.
- The SVG `viewBox` is set to the pitch container size so coordinates are in
  pixel space.

This avoids layout assumptions and stays accurate in mobile and desktop
orientations.

### Empty slots

Links are always drawn for the full schema topology. When one or both endpoints
are empty, the link renders with the `empty` level styling (gray).

## ResizeObserver

Responsive layout changes can move nodes without a full component remount. To
keep links aligned:

- A `ResizeObserver` watches the pitch container.
- On resize (or orientation change), `updateAnchors()` recomputes the centers.
- The desktop media query listener also triggers `updateAnchors()` after the
  layout flips to the landscape grid.

## Related documentation

- [Chemistry Links (domain)](../domain/chemistry-links.md) — the rules and scoring.
- [Lineup Editing](./lineup-editing.md) — how contracts are placed, removed,
  swapped, and moved (the `DraftLineup` seam).
