---
title: Formation Disclosure
type: domain
tags: [formation, lineup, scoring, disclosure, league]
---

# Formation Disclosure (domain)

Who may see whose formation, and when. The rules a lineup must *obey* live in
[Lineup Rules](./lineup-rules.md); this states only what becomes visible to other
players.

## The rule

**A team's fielded XI becomes public once its scoring day closes. The live
lineup never does.**

A lineup is private while it can still affect a score. The moment a scoring day
is scored, the placement that earned those points stops being strategy and
becomes evidence — the standings assert that a team earned N points, and a
player has no way to make sense of that claim without seeing what was on the
pitch. Withholding it would leave the league table as an unauditable number.

The two halves are one rule, not a compromise between openness and secrecy:

- **Before scoring** — disclosing a live lineup would let a player read an
  opponent's plan for a day that has not happened yet, and change their own in
  response. Nothing is disclosed.
- **After scoring** — the day is settled. Nothing a viewer learns can change
  what it scored, and what they learn is exactly what the points were computed
  from.

## What "the previous scoring day" means

The day axis is **league-wide**: the scored days of a league are the distinct
days on which *any* of its teams was scored, and every team is read against that
same axis.

This matters because scoring records are per-team. Resolving "the previous
scoring day" per-team would date two teams' formations differently and quietly
destroy the only thing the screen is for — comparison. A team with no record for
a league scoring day **fielded nothing that day**. That is a fact about the team,
disclosed as such; it is not a missing record.

## What is disclosed

For a scored day, of another team:

- the **Formation Schema** that was fielded,
- the **Positions** and the article placed on each,
- the **Chemistry Level** resolved for each of the schema's Chemistry Links,
- the team's **total points** for that day.

Not disclosed: the bench, the team's credits, and the price, tier, or duration
of any contract behind a placement. None of those were inputs to the day's
score, so none of them are needed to audit it.

Which articles a team owns is **already public** league-wide and always has
been — see [Article Availability](./article-availability.md). Disclosure here
adds *where they were placed*, not *that they are owned*.

## To whom

Any **signed-in player**, whether or not they belong to the league. This matches
what a league already discloses through its standings and its contract list, and
those are the two things a formation is read against — gating formations more
tightly than the table they explain would make the table less auditable without
making anything private.

Nothing is disclosed to a signed-out visitor.

## Related

- [Lineup Rules](./lineup-rules.md) — what a formation must satisfy.
- [Chemistry Links](./chemistry-links.md) — what a Chemistry Level means.
- [Scoring & Economy System](./scoring-system.md) — how a day's points are computed.
- [Article Availability](./article-availability.md) — why ownership is already public.
- [Performance Snapshots](../architecture/performance-snapshots.md) — how the
  record that makes this possible is written and read.
