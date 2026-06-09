# Chemistry Links Architecture

This document describes how chemistry links are modeled and rendered in the
formation view.

## Data model

### Schema-driven link list

`dto/enums.ts` defines `CHEMISTRY_LINKS` alongside `FORMATIONS` to keep the link
topology per schema (4-3-3, 4-4-2, etc.) compile-time checked:

- Each schema maps to a list of position pairs, e.g. `["LW", "ST"]`.
- The list is the canonical structure for that schema.
- This mirrors `FORMATIONS`, so the topology lives in the same place as schema
  positions.

### Chemistry levels

`dto/formationDTO.ts` defines:

- `ChemistryLevel`: `excellent | good | weak | empty`
- `CHEMISTRY_MULTIPLIER_BY_LEVEL` for score multipliers
- `ChemistryLink`: `{ from, to, level }`
- `createChemistryLinks(schema)` which expands `CHEMISTRY_LINKS[schema]` into
  a list of `ChemistryLink` objects with default `level: "empty"`.

Both `DraftFormationDTO` and `FormationDTO` now carry:

```
chemistry: ChemistryLink[]
```

`validateChemistryLinks` ensures the runtime list matches the schema topology
and contains only valid levels.

### Composing leveled links

`computeChemistryLinks(schema, formation, linksMap)` (also in
`dto/formationDTO.ts`) is the single, pure function that turns a schema plus the
contracts placed on it plus each placed article's Wikimedia links into a fully
leveled `ChemistryLink[]`. For every schema pair it resolves the two placed
article titles, looks up their linked-article lists in `linksMap`
(`Map<title, string[]>`), and derives the level via `calculateChemistry`
(`empty` when a slot is unfilled).

Fetching the linked articles and discarding stale results when the formation
changes mid-fetch stays in `frontend/src/composables/useTeamLineup.ts`; the
composable builds `linksMap` from the Wikimedia responses and then calls
`computeChemistryLinks`. Keeping composition pure means it is unit-tested
directly (see `frontend/src/tests/formation/ChemistryLinks.spec.ts`) without any
Vue or network setup.

## Rendering in the formation view

`frontend/src/components/formation/TeamFormation.vue` renders links using an
SVG overlay that draws lines between the actual DOM positions of nodes.

### Anchor strategy

- Each position element (filled `ArticleNode` or empty slot) has
  `data-position="<POS>"`.
- `updateAnchors()` reads `getBoundingClientRect()` for each element and
  stores center points in `anchorMap`.
- The SVG `viewBox` is set to the pitch container size so coordinates are
  in pixel space.

This avoids layout assumptions and stays accurate in mobile and desktop
orientations.

### Empty slots

Links are always drawn for the schema topology. When one or both endpoints are
empty, the link is rendered with the `empty` level styling (gray).

## ResizeObserver

Responsive layout changes can move nodes without a full component remount. To
keep links aligned:

- A `ResizeObserver` watches the pitch container.
- On resize (or orientation change), `updateAnchors()` recomputes the centers.
- The desktop media query listener also triggers `updateAnchors()` after the
  layout flips to the landscape grid.

This ensures chemistry lines stay aligned with nodes across screen sizes.

## Related documentation

- For how contracts are placed, removed, swapped, and moved on the pitch (the
  `DraftLineup` seam and pure mutations), see `docs/lineup-editing.md`.
