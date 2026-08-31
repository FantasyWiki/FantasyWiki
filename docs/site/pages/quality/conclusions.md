---
title: What we learned
description: Which of the project's recorded decisions survived being played, what would be done differently, and the question the run left open.
type: guide
---

# What we learned

The two halves came apart. The architecture delivered what it promised: built,
run on production for a month, cost nothing, nothing bought again to carry the
load. The game it was built to serve does not work, for a reason no further
building would fix.

[The playtest](./playtest.md) is where that was found. This page is what follows
from it.

## Which decisions held

| ADR | Verdict |
|---|---|
| [0001 Base Scoring Model](../docs/adr/0001-base-scoring-model.md) | **Held, and unbalanced.** The curve behaved, but its additive chemistry term outgrew the pageview scoring it was meant to garnish. Players played for an all-Excellent board, not for points. |
| [0002 Language Scale Factor](../docs/adr/0002-language-scale-factor.md) | **No verdict.** One edition, all month. It solves a problem the run never presented. |
| [0003 Closed Trading Economy](../docs/adr/0003-closed-trading-economy.md) | **Challenged.** The least-liked part of the game. Renewal went effectively unused (three uses against two hundred contracts) and **Early Sell** was spent during setup rather than played. Players asked for a stock market instead. |
| [0004 Scoring Engine Platform](../docs/adr/0004-scoring-engine-platform.md) | **Held.** Free, and both failures were the project's own code rather than the platform. |
| [0005 Contract Pricing](../docs/adr/0005-contract-pricing.md) | **Held.** The curve priced a 1,000-credit budget into real choices across two hundred contracts, from free articles up to 625 credits, and a team that spent badly kept a low-credit route back into scoring. |
| [0006 Article Genie](../docs/adr/0006-article-genie.md) | **Vindicated, against expectation.** Arrived mid-run to open scepticism and was received warmly, as a humorous and occasionally useful extra. The only feature that landed better than it was pitched. |
| [0007 Derived Team Credits](../docs/adr/0007-derived-team-credits.md) | **Held, and checked rather than assumed.** Across 13 teams and 200 contracts: no negative balances, and no contract settled twice. Final balances ran 302 to 1,570 against a 1,000 budget. |
| [0008 League Invitation Codes](../docs/adr/0008-league-invitation-codes.md) | **Untested.** Nobody joined a league by code. |

Two are marked no verdict or untested, and that is itself the finding. **A month
of play tested the decisions about scoring, money and infrastructure, and left
the decisions about leagues almost entirely alone**, because the run was one
league everyone was already in. The parts of the system that get a player from
nothing to a league with their friends in it are the least evidenced parts of the
project.

## What we would do differently

Four, in descending order of how much they matter. Only the first is about the
game.

1. **Attach the game to an event, or stop calling it a fantasy game.** Fantasy
   formats borrow their rhythm from something people watch together, and
   Wikipedia's pageviews have no such moment. Not visible from inside the design,
   not a feature gap, and it sits under every other finding in the playtest.
   Everything below is small next to it.
2. **Ship the leaderboard before opening, not two days after.** It was the first
   thing thirteen players asked for. Seeing other teams' line-ups was the second,
   and took until 14 August.
3. **Close the gap between buying and fielding.** Two teams bought twenty and
   eleven contracts, then fielded an empty **Formation** every day for a month
   and scored zero with nothing telling them. Owning without fielding should not
   be a silent state.
4. **Decide what renewal is for, or remove it.** Three uses in two hundred
   contracts is not a mechanic, and carrying one costs schema, rules and
   documentation regardless of use.

## What is not built, and why

**Decided against.** Sourcing trends from Google search rather than Wikipedia.
Several players thought it would make a better game and they may be right, but
the analytics API costs hundreds of dollars a month, which ends it for a project
whose whole cost argument is that it runs on free tiers. Wikipedia's openness is
not incidental here; it is what makes the project possible at all.

**Proposed by players.** Two ideas came out of the run, offered as ways the game
could be better *for them* rather than as requests for a backlog:

| Idea | Note |
|---|---|
| An **auction** for contracts, instead of a fixed price against the market | Rejected at the original pitch as tedious, then asked for after a month of play |
| **Head-to-head competition**: fixtures scored one against one, three points for a win in an all-play-all, then the top of the table into a knockout | A leaderboard turned out to be a ranking, not a rivalry |

Neither is committed to. Both are recorded because they came from people who had
played for a month, which makes them better evidence than an idea from inside the
project. Neither answers the question below, so building either now would answer
the wrong thing.

**Deferred earlier, still deferred:** weekly and monthly tournaments,
demand-reactive pricing, and a global season. That last is a season format open
to everyone, and is not the seeded league named *Global League* the playtest ran
in.

## The open question

The premise still looks right. Wikipedia's daily trends are good raw material for
a game, and nothing in the run argued against it. What the run took away is the
shape: a fantasy-sport format cannot carry it, because there is nothing for it to
be a fantasy *of*.

Planning stopped there rather than picking one of the proposals above. What comes
next is game design, not another sprint, and it has not been done yet.

## Related

- [The playtest](./playtest.md): the evidence this page is drawn from
- [Requirements](../overview/requirements.md): the obligations the run tested
- [What FantasyWiki is](../overview/what-is-fantasywiki.md): what it set out to be
- [Documentation index](../docs/): where the eight decision records given verdicts above are kept
