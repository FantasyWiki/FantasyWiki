---
title: Chemistry Links
type: domain
tags: [chemistry, formation, scoring]
---

# Chemistry Links (domain)

The rules governing **Chemistry Links** and **Chemistry Levels**. The glossary
entries are canonical in [`CONTEXT.md`](../../CONTEXT.md); this document expands
them into the full rule set. For the code that models and draws them, see
[Chemistry Links Rendering](../architecture/chemistry-links-rendering.md).

## What a Chemistry Link is

A **Chemistry Link** is a schema-defined connection between exactly two
**Positions**. The set of links is a property of the **Formation Schema**
(4-3-3, 4-4-2, …), not of the articles placed on it: changing schema changes the
link topology, and the same two articles may be linked under one schema and
unlinked under another.

This is the FUT-style adjacency model. Chemistry is **only** evaluated between
schema-adjacent positions — never between every pair of owned articles.

## Chemistry Level

Each link carries a **Chemistry Level**, a four-step rating:

| Level | Meaning |
|---|---|
| **Excellent** | Both placed articles link to each other on Wikipedia (mutual) |
| **Good** | One article links to the other (one-way) |
| **Weak** | Both slots filled, but no Wikipedia link between them |
| **Empty** | At least one of the two positions is unfilled |

The level is derived from the **Wikimedia article links** of the two placed
articles — an article's outbound links are the raw material for chemistry.

## Scoring contribution

A Chemistry Level contributes **additive flat points** to the team score. It is
**not** a multiplier, and it is not computed over all owned pairs.

| Level | Points |
|---|---|
| **Excellent** | **+1.5** |
| **Good** | **+0.5** |
| **Weak** | 0 |
| **Empty** | 0 |

```
TeamSynergy = Σ over schema links ( points(level) )     # mutual = 3 × one-way
```

These values are canonical in [the scoring system](./scoring-system.md) §4 and
encoded as `CHEMISTRY_POINTS_BY_LEVEL` in `model/enums.ts`.

The additive form was chosen over a multiplier because it favors low-traffic
articles proportionally and preserves the formation-placement puzzle — a
multiplier would scale with an article's own popularity, rewarding the already
strong. See `CONTEXT.md` "Open questions resolved".

## Invariants

- A **Formation Schema** defines both its **Positions** and its **Chemistry Links**.
- A **Chemistry Link** connects exactly two **Positions**.
- A **Formation** carries a **Chemistry Level** for every link in its schema —
  including `Empty` ones, so the link list is always the full schema topology.

## Related

- [Lineup Rules](./lineup-rules.md)
- [Scoring & Economy System](./scoring-system.md)
- [Chemistry Links Rendering](../architecture/chemistry-links-rendering.md)
