---
title: The playtest
description: A month of real play on production — what the load did, what the players did, and which parts of the design did not survive contact with either.
type: guide
status: planned
---

# The playtest

Every other page on this site describes a system as designed. This one describes
what happened when it was played: a month-long run on production, with real
players and no instrumented safety net, held to see two separate things at once
— whether the infrastructure carried the load, and whether the game was any
good.

It is the only page here that can contradict the others, which is the reason it
exists. Where it does, it is right and they are the record of an intention.

<Planned evidence="the run's own artefacts — Cloudflare analytics and Workers logs for the period, the nightly job history, the issue tracker, and the feedback collected from players">

This page is written from the run itself and nothing else. It stays empty until
those artefacts are read, because a playtest reported from memory is an opinion
with a date on it.

</Planned>

## How it was run

<Planned evidence="the deployment history and the league records for the period">

The shape of the run: how long, how many players, how many leagues, on which
Wikipedia editions, and what was deployed at the start of it. Also what was
*not* in it — the features that were switched off or unbuilt at the time — since
a finding only applies to the system that was actually played.

</Planned>

## What the load did

<Planned evidence="Cloudflare Workers and D1 analytics for the period, and the nightly collector's job history">

The system's cost argument is that nothing is always-on and the bill follows
use. A month on production is the first evidence for or against it.

What belongs here: request volume and how it was distributed across the day; the
nightly run's duration and how it moved as leagues were added; Wikimedia call
volume against the etiquette limit; D1 rows read and written; and what any of it
actually cost.

Where a number contradicts the estimate in
[Nightly Scoring Pipeline](../docs/architecture/scoring-pipeline.md), that
document is the one that is wrong.

</Planned>

## What the players did

<Planned evidence="league and contract records from the period, and the feedback collected during it">

Behaviour, as distinct from opinion: which parts of the loop were used and which
were skipped, how often lineups actually changed, whether contracts were held to
term or sold early, and whether the market was read or ignored.

The economy's design rests on players making informed trades under a budget. A
month of real contracts either shows that happening or shows what they did
instead.

</Planned>

## What did not work

<Planned evidence="the feedback collected during the run, and the issues raised from it">

The run surfaced problems in the design that were not visible from inside it.
This section names them plainly — what broke, how it presented, and why it was
not caught earlier. A design flaw found by players is the most expensive
evidence this project has, and rounding it off in the write-up wastes it.

Each finding should say which document it invalidates, so the correction is
traceable rather than silent.

</Planned>

## What was changed because of it

<Planned evidence="the commits, ADRs and issues that followed the run">

A finding that changed nothing should say so, and say why. A finding that
changed something should point at the decision record that carries it.

</Planned>

## Related

- [Test strategy](./testing.md) — what the automated suites cover, and what only players could have found
- [What we learned](./conclusions.md) — where these findings are drawn together
- [Requirements](../overview/requirements.md) — the obligations this run tested
