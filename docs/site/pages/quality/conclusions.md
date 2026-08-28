---
title: What we learned
description: What the project set out to do, what it actually does, and what the month of real play changed about the answer.
type: guide
status: planned
---

# What we learned

The honest summary, written last and depending on everything above it: whether
the system does what it was built to do, which of its load-bearing decisions
survived being played, and what would be done differently.

<Planned evidence="the outcome of [the playtest](./playtest.md), the decision records in docs/adr/, and the state of the system at the end of the project">

This page cannot be written before [the playtest](./playtest.md) is, because its
only real content is the difference between what was intended and what happened.
Writing it first would produce a summary of the intentions, which is what the
rest of the site already is.

</Planned>

## What was built

<Planned evidence="the requirements page, the coverage board and the API surface as they stand at the end">

The obligations in [Requirements](../overview/requirements.md), scored honestly:
met, partly met, or not built. The functional table there already names what
each one is satisfied by, so this is the same list with an outcome against it
rather than a second inventory.

</Planned>

## Which decisions held

<Planned evidence="the ADRs in docs/adr/, checked against what the playtest showed">

The project made eight recorded decisions. Some will have been vindicated by a
month of real play, some will have been shown to solve a problem that never
arrived, and at least one will have been wrong. An ADR is immutable, so this is
where the verdict on it goes.

Worth being specific about: the scoring curve, the closed economy with no
stipend and no fee, the pricing exponent, and the choice to run the collector on
a second platform.

</Planned>

## What we would do differently

<Planned evidence="the playtest findings, and the parts of the codebase that were expensive to change">

Not a list of regrets — a list of the decisions that would be taken differently
with what is now known, and the evidence that changed them.

</Planned>

## What is deliberately still not built

<Planned evidence="the deferrals recorded during the project, and the ones the playtest added">

Weekly and monthly tournaments, demand-reactive pricing and a global season were
all considered and put down on purpose. Each should be recorded here with the
reason, since none of them is currently written down anywhere but the commit
history.

</Planned>

## Related

- [The playtest](./playtest.md) — the evidence this page is drawn from
- [Requirements](../overview/requirements.md) — the obligations being scored
- [What FantasyWiki is](../overview/what-is-fantasywiki.md) — what it set out to be
