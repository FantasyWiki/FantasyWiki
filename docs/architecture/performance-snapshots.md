---
title: Performance Snapshots
type: architecture
tags: [scoring, performances, formation, d1, backfill]
---

# Performance Snapshots (architecture)

How a scored day's formation is recorded and read back. The rule about *who may
see it* lives in [Formation Disclosure](../domain/formation-disclosure.md); this
covers only the mechanism.

## The record

One row per `(teamId, date)` in `performances`:

| Column | Holds |
|---|---|
| `points` | the day's team total, computed by `teamDailyScore` on ingest |
| `historical_formation` | the immutable snapshot — see below |
| `schema` | the Formation Schema that was fielded (nullable, see *Legacy rows*) |
| `chemistry_levels` | the resolved level per fielded Chemistry Link (nullable) |

> `schema` and `chemistry_levels` are added by migration `0006`. This document
> is written ahead of that migration and of the code it describes; both land in
> the same branch.

`historical_formation` is the authority on the schema — the `schema` column is a
derived index written from it at ingest, so that day-axis and standings queries
do not have to parse JSON. Where they disagree, the snapshot is right and the
column is stale; nothing should read the column to *render* a formation.

## The snapshot travels as one value

`historical_formation` is `{ "schema": "4-3-3", "placements": { "LW": "...", … } }`,
serialized by `ScoringService.getScoringInputs` and echoed back **verbatim** by
the collector (`Collector.kt`) — it is declared opaque in
[`dto/scoring.ts`](../../dto/scoring.ts) and never parsed on the Kotlin side, so
changing its shape is a backend-only change.

Schema and placements are stored inside one value rather than in two independent
reads, because they are only meaningful together. Ingest happens after the
collector's Wikimedia fan-out, which takes minutes; re-reading `lineups.schema`
at that point would pick up a schema the player switched to *during* the fan-out
and store it beside placements that were captured before the switch. The result
would be a pitch drawn in a shape the team never fielded — on the one screen
whose purpose is auditability. Carrying both in the echoed snapshot makes that
disagreement unrepresentable.

## Chemistry levels are stored, not re-derived

For a live formation, chemistry is always a function of the placement and is
never stored (see [Lineup Rules](../domain/lineup-rules.md)). A *historical*
formation is the exception: the Wikipedia link graph the levels were resolved
against keeps moving, so re-deriving them later answers a different question —
"what would these pairs score today" rather than "what did they score".

The collector returns `chemistryLevels` as a flat list, which ingest re-keys to
positions: the list is ordered as `CHEMISTRY_LINKS[schema]` filtered to the pairs
with both endpoints placed, the same filter `getScoringInputs` applied when it
built the request. The zip is exact because `classifyPair` only declines a
malformed pair, and the backend never sends one.

**The read path reinflates to the full schema topology**, giving every link the
schema defines a level and `empty` to the pairs the filter dropped. This is not
cosmetic. [Chemistry Links](../domain/chemistry-links.md) requires a formation to
carry a level for *every* link in its schema, and the frontend enforces it: a
short list fails `validateChemistryLinks` on its length check, and
`normalizeChemistryLinks` then silently discards it and rebuilds every link as
`empty`. Emitting only the fielded pairs would therefore render all-grey
chemistry for any formation with an empty slot — the formations most worth
auditing.

## Per-article views are not stored

The tile-level view counts shown on a historical formation are **fetched live**
from the Wikimedia per-article API for the scored day, not read back from the
record. `createResolveArticleViews` already takes a `snapshotDate`, so this is a
thin capability on the existing client rather than new infrastructure.

The trade-off this accepts: a live fetch can disagree with the points. When
Wikimedia had no data for an article at cron time the collector scores it as
zero (`no views for … — scoring as 0`), and a later fetch may return a real
number. Views are therefore presented as *the article's traffic that day*, never
as *the number that scored you*. The team total in `points` is the authoritative
figure, and it is the one the standings are built from.

## Reading it back

`GET /api/leagues/:id/teams/:teamId/performance?date=` returns the snapshot plus
league-scoped `previousDate` / `nextDate` for day navigation, `null` at the ends.
It is not self-scoped, so it takes no `my-` prefix — see
[API Naming Rules](../development/api-naming-rules.md).

**The read touches `performances` only, never `lineups`.** That is the whole
mechanism behind the privacy half of
[Formation Disclosure](../domain/formation-disclosure.md): the live lineup is
not withheld by a permission check that could be got wrong, it is simply not
reachable from this path. A team with no row for a requested day returns that day
with an empty formation, not a 404 — it fielded nothing, which is an answer.

## Legacy rows

Rows written before the snapshot carried a schema hold a bare
`{ "LW": "…", … }` map, so the parse accepts both shapes and yields no schema for
the old one. Those rows are repaired by a one-shot backfill rather than left to a
render-time fallback:

- **Schema** is inferred from the position keys, scored against each entry in
  `FORMATIONS`. A full XI is uniquely identifying; only sparse lineups can be
  ambiguous, and those are left `NULL` rather than guessed.
- **Chemistry levels** are recomputed from today's link graph. This is the
  approximation the section above rejects for new rows, and it is accepted here
  only because the alternative for these rows is nothing at all.

The backfill is a Node script that reads via `wrangler d1 execute --json` and
emits a plain `UPDATE`-per-row `.sql` file to be reviewed before it is applied,
separately to `db` and `db-preview`. It is not an endpoint: nothing that rewrites
historical scoring data should stay reachable after it has been run once.

## Related

- [Formation Disclosure](../domain/formation-disclosure.md) — who may see this, and when.
- [Lineup Rules](../domain/lineup-rules.md) — why live chemistry is never stored.
- [Scoring & Economy System](../domain/scoring-system.md) — how `points` is computed.
- [Lineup Editing](./lineup-editing.md) — the pitch that renders a snapshot.
- [Backend Architecture](./backend-architecture.md) — the route/service/repository layering.
- [ADR 0004: Scoring Engine Platform](../adr/0004-scoring-engine-platform.md) — why the collector is a separate runtime.
