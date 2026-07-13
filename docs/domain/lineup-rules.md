---
title: Lineup Rules
type: domain
tags: [formation, lineup, contracts, bench]
---

# Lineup Rules (domain)

The rules a player's lineup must obey. For the code that implements editing (the
`DraftLineup` seam and its pure mutations), see
[Lineup Editing](../architecture/lineup-editing.md).

## Formation and schema

A **Formation** assigns contracts to the **Positions** required by a
**Formation Schema**. A schema (4-3-3, 4-4-2, …) defines both which positions
exist and which [Chemistry Links](./chemistry-links.md) connect them.

Every schema has **11 positions**, so a team holds at most **11 active
contracts** — one per position. (This resolved an earlier contradiction in the
requirements, which said 10; see `CONTEXT.md`.)

## Bench

Contracts a player owns but has not placed sit on the **bench**. The bench is
unbounded: it is where contracts go when they are not on the pitch.

## Editing rules

- **Placing** a contract on an occupied position displaces the current occupant
  **to the bench** — it is never dropped.
- **Removing** a contract from a position returns it **to the bench**.
- **Swapping** is symmetric and covers every source/target combination:
  position↔position, position↔bench, bench↔bench, and bench→position.
- **Changing schema** remaps placed contracts onto the new schema's positions.
  Any contract the remap cannot carry over is **appended to the bench**, never
  silently dropped.

The invariant behind all four: **no contract is ever lost by an edit.** A
contract is always either on a position or on the bench.

## Chemistry follows placement

Because chemistry is evaluated on schema adjacency, any edit that changes which
articles sit on linked positions — including a schema change — changes the
**Chemistry Levels** of the formation. Chemistry is a function of the placement,
never stored independently of it.

## Related

- [Chemistry Links](./chemistry-links.md)
- [Lineup Editing](../architecture/lineup-editing.md)
