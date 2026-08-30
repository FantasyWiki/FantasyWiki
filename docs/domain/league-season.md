---
title: League Season
type: domain
tags: [league, season, contracts, creation]
related:
  - ./league-visibility.md
  - ./league-lifecycle.md
  - ./scoring-system.md
---

# League Season

A league runs for a fixed stretch of time, chosen when it is created.

## The rule

- The season **starts the moment the league is created**. There is no scheduled
  or delayed start: a league exists in order to be played.
- Its length is picked from a closed set — **2 weeks, 1, 2, 3 or 6 months** —
  and the end date is derived from it server-side.

The player names a *length*, never an end date. An end date sent by a client
could be one in the past, or one so distant the league never resolves; a length
from a known set cannot be either.

## Why the floor is two weeks

A LONG contract runs **14 days** (`TIER_DAYS.LONG`, see
[Scoring & Economy System](./scoring-system.md)). A season shorter than that
could not hold one to expiry, so a player who bought one would reach the end of
the league mid-contract, with the position neither settled nor scored. Two weeks
is the shortest season in which every contract tier is playable.

## Why the ceiling is six months

Past roughly half a year the Top Read Snapshot has turned over enough that the
article market a player joined is not the one they finish in. That is a slow
drift rather than a hard failure, so the limit is a judgement rather than a
derivation — but an open-ended season would let a league outlive the interest
of everyone in it, and nothing reclaims one.

## Where this lives in code

`LEAGUE_DURATION_DAYS` and `leagueEndDate` in `model/league.ts`, shared so the
creation form offers exactly the lengths the backend accepts. `leagueEndDate`
counts in **hours**, not days: `Temporal.Instant` rejects date units outright,
because a calendar day is not a fixed quantity of time and an instant has no
calendar. A season is "this long from now", which is precisely what a fixed
number of hours means.

## Related

- [League Visibility](./league-visibility.md) — the other thing chosen at
  creation, and who may join once the season is running.
- [League Lifecycle](./league-lifecycle.md) — what happens when the season
  reaches this end date, and the other way a league can stop before it.
- [Scoring & Economy System](./scoring-system.md) — contract tiers, and the
  settlement the floor above exists to protect.
- [Standings and Podium](./standings-and-podium.md) — which phase shows a live
  podium, and which shows a final one.
