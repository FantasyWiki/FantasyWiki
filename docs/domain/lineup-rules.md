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

Every schema has **11 positions**, so at most **11 contracts can be placed**.
That is a property of the schema and not of the team: it bounds the pitch, not
the squad.

## How many contracts a team may hold

**22 active contracts**, counted as the contracts a team holds that are not yet
settled. A starting eleven and a bench of the same size, which is where the
number comes from.

The cap counts *unsettled* contracts, not placed ones, so a contract counts
against it from the moment it is signed until the settlement sweep closes it.
A contract that has run past its expire date but has not been swept yet is
still one of the 22, which is deliberate, the alternative is a team that can
sign its 23rd article in the hours between expiry and settlement.

It was **11** until 2026-07-10, one contract per position, which conflated the
squad with the starting eleven and left no bench to manage; PR #433 raised it to
22 and this doc had not caught up. The requirements' earlier "10" was never
right at all.

`MAX_TEAM_CONTRACTS` in [`model/team.ts`](../../model/team.ts) is the one
statement of the number, and it is enforced inside the guarded INSERT that
writes the contract rather than above it, for the same reason credits are (see
[ADR 0007](../adr/0007-derived-team-credits.md)): two concurrent buys that both
read 21 would both commit.

## Bench

Contracts a player owns but has not placed sit on the **bench**: it is where
contracts go when they are not on the pitch. It has no limit of its own, it is
bounded by what is left of the 22 after the placed contracts, so a team with
nothing on the pitch may bench all 22 and a team fielding a full eleven may
bench eleven more.

## Editing rules

- **Placing** a contract on an occupied position displaces the current occupant
  **to the bench**, it is never dropped.
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
articles sit on linked positions, including a schema change, changes the
**Chemistry Levels** of the formation. Chemistry is a function of the placement,
never stored independently of it.

## Related

- [Chemistry Links](./chemistry-links.md)
- [Lineup Editing](../architecture/lineup-editing.md)
- [Scoring & Economy System](./scoring-system.md): the budget the squad is
  bought with, and what each placed contract scores
- [ADR 0007](../adr/0007-derived-team-credits.md): why the cap is checked in the
  write rather than before it
