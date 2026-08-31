---
title: The playtest
description: Thirty-five days of real play on production. What the load did, what the players did, and the finding that invalidates the premise rather than a feature.
type: guide
---

# The playtest

Every other page on this site describes a system as designed. This one describes
what happened when it was played, on production, with real players.

It is the only page here that can contradict the others, which is why it exists.
Where it does, it is right and they are the record of an intention.

It answers its two questions unevenly:

| Question | Answer |
|---|---|
| Did the infrastructure carry the load? | Yes, at zero cost. The least interesting thing here. |
| Was the game any good? | No, and the reason is not a missing feature. |

Everything below comes from the run's own artefacts: the production D1 database,
the nightly job history, the issues the in-app report button opened, and the exit
answers collected from players who stopped.

## How it was run

One league of thirteen friends, which is the case under test rather than a
reduced stand-in for it. The product's premise is a small private league among
people who know each other, and that is what was played.

| | |
|---|---|
| League | Global League, `en.wikipedia.org` |
| Open | 28 July 2026 to 31 August 2026 |
| Owner Teams | 13 (nine on 29 July, then 1 August, 4 August, 13 August) |
| Scored days | 31, from 29 July to 29 August |
| Backend | The deployed Worker on Cloudflare D1, production |
| Scoring | The nightly collector on a GitHub Actions runner, 05:00 UTC |

Both edges of the scoring record have ordinary explanations. 28 July has no
scores because no Owner Team existed yet; the record stops at 29 August because
the nightly run scores the previous UTC day and this page was written on
31 August. There is exactly one gap in the interior, 15 August, and it is an
incident.

**Deployed on day one:** dashboard, market, lineup editing, and the guided
onboarding tour that landed the same morning.

**Built during the run, because players asked:**

| Shipped | What | Asked for |
|---|---|---|
| 30 July | League detail page with the leaderboard | Day one |
| 14 August | Seeing another team's line-up | 28 July |

**Not in the run**, so nothing here is a finding about it: multi-edition play and
the `/leagues` section (17 August), and the accessibility pass (30 August). The
**Article Genie** arrived mid-run and is in scope, because players used it.

## What the load did

**The run cost nothing.** Cloudflare's free plan, GitHub Actions' free minutes
and Wikimedia's free API carried all of it, and the Worker was never the
constraint.

Three incidents, all in the scoring collector:

| Date | Incident | Cause | Outcome |
|---|---|---|---|
| 30 to 31 July | Wikimedia returned `429` | Self-inflicted, two causes below | Manual re-run the same day, no day lost |
| 16 August | Scheduled run failed | Wikimedia unavailable | 15 August permanently unscored |

The `429` had two causes, both fixed on 31 July:

- The nightly workflow fanned out over a `[production, qa]` matrix, **scoring the
  preview backend every night as well**: twice the Wikimedia budget for one
  league's worth of value.
- **Chemistry Link** resolution issued one request per distinct paired article.
  The links endpoint accepts up to 50 titles per call, so the whole pool fits in
  one request.

Batching collapsed this to roughly **one request per Project Domain per night**,
and it held: the over-calling never recurred across any later run.

The 16 August failure is the run that scores 15 August. It was never backfilled,
so that day is permanently unscored for every team. No player noticed or reported
it, which is itself a finding and belongs below.

**On capacity.** The working figure is that the free plan would carry a little
under a thousand players. It is an estimate by eye, taken from the Worker
invocations of a roughly ten-player lobby on the first day and extended as though
every day looked like the first, with D1 storage and rows read sanity-checked
against it. Treat it as **a ceiling derived from the busiest day of the run**
rather than a steady-state measurement: 29 July carried 56% of every contract
bought all month. Dashboard traffic figures for the window were not captured.

## What the players did

| | |
|---|---|
| Contracts signed | 200 (105 at 7 days, 69 at 14, 26 at 3) |
| Signed on 29 July | **112**, 56% of the run, on day one |
| Signed after 11 August | 10, across the final twenty days |
| Signed at 0 credits | 65 of 200 (mean 64, max 625, on a 1,000 budget) |
| Exits | 133 **Expiry Settlement**, 60 **Early Sell**, 3 renewals |
| Early Sells on 29 July | 29 of 60. The last in the whole run was 11 August |
| Contracts open at close | 7, expiring as late as 9 September |
| Teams that scored at all | 7 of 13 |

**The loop front-loaded and then stopped.** Over half the market activity of the
month happened on the first day. Formation churn agrees: across 31 scored days
the busiest team changed its line-up twelve times, two others ten and nine, and
**five of thirteen teams never changed it once**. Three teams managed a squad;
the rest built one and left.

**Early Sell became a setup tool, not trading.** Half of it happened on day one,
sixteen of the sixty returned 0 credits, and it was never used after 11 August. A
contract that had not yet scored could be exited for what it cost, so Early Sell
was how players tried a line-up and tested **Chemistry Links** before committing.
A reasonable use, and nobody minds it, but the mechanic was consumed during setup
and played no part in the month that followed.

**Renewal was effectively unused:** three renewals against two hundred contracts.
It was expected to be a live part of the loop and was not.

**Players built dense topic clusters, and meant to.** The settled contracts group
into a Hitler/Nazi Germany/Holocaust cluster, a Francesco Guccini cluster, a solar
eclipse cluster and an AI-companies cluster. Almost everyone understood how the
game worked and used their own knowledge of Wikipedia to build for **Chemistry
Links** deliberately.

**A third of contracts were signed at 0 credits, and that is the design working.**
A free article that still scores keeps a team who has spent badly from being
locked out of the season: a low-credit strategy stays available to the end. The
run confirms the route was reachable and used, on ordinary articles (*X-Men*,
*Solar eclipse*, *Silvio Berlusconi*, *TSMC*, *Ferragosto*), two-thirds of them
in the first week.

**Six of thirteen teams scored nothing at all.** Two of them had bought contracts,
twenty and eleven, while fielding an empty **Formation** every day of the run.
Buying and fielding are separate steps and nothing closed the gap or told them: a
player could spend a whole budget and receive zero points in silence.

## What did not work

**Session retention was good. Return retention failed almost completely.** Players
who opened the site stayed and engaged; they did not come back. Everyone who
stopped was asked why:

| Reason given | Corroborated by |
|---|---|
| Nothing worth coming back for. Building the team once was fun and challenging; a second time was not | Only three players ever seriously changed their team again |
| It was August. Following the news and reasoning about trends is work | The buying record stops after 11 August |
| Good choices did not pay enough. The economy was the least-liked part, and more than one player asked for a stock market instead | 3 renewals in 200 contracts |
| No reason to check the site: no notifications, no daily moment when a result arrived | 15 August went unscored and unnoticed |

**Those four are one problem.** A fantasy game is parasitic on a shared social
event. Fantasy football is built on a fixture list and its scoring days are match
days; FantaSanremo is built on watching Sanremo together. Every fantasy format
that works is attached to something people watch at the same time as each other.
The game is the excuse to be in that moment together, and the app is where the
moment gets settled.

Wikipedia pageviews have no such moment. The world's reading happens, but nobody
watches it happen and no two players are ever watching it together. Nothing in
the design gives the group a reason to be present at the same time, which is why
notifications and a daily result screen are minor causes above: they would have
manufactured an occasion rather than served one.

The only counterexample players could name is a fantasy death pool, which has no
live event either. It is also unpopular and played as a joke, so it does not
rescue the thesis.

Two design gaps sit underneath, both volunteered rather than prompted:

- **Nothing felt competitive.** A leaderboard is a ranking, not a rivalry. Players
  wanted the modern fantasy-football shape: head-to-head fixtures, three points
  for a win in an all-play-all, then the top of the table into a knockout.
- **Chemistry ate the game.** By a distance the best-liked mechanic, more so than
  the pageview scoring it was meant to garnish. Players described playing for an
  all-Excellent board rather than for points, and the contract record shows it.

**Which document this invalidates:** not a feature doc, but the premise on
[What FantasyWiki is](../overview/what-is-fantasywiki.md), which says *"The season
runs for weeks; the squad never stops needing management."* The season ran for
weeks and the squad stopped needing management after roughly two of them. The
private-league thesis was not left untested either: it *was* the run, and on its
own it did not bring anyone back.

## What was changed because of it

Feedback arrived through the in-app report button, which opens a GitHub issue
directly, and through private messages. The button worked: six player reports came
through it, written in the players' own language rather than the project's.

| Report | Status |
|---|---|
| A new player could get past login without naming a team, breaking everything downstream | Fixed 29 to 31 July, with a prompt for a player who has no team |
| Formation auditability: players wanted to see each other's line-ups | Shipped 14 August |
| Yesterday's points chip is broken | Open |
| Bench titles are misplaced | Open |
| An article's info card does not show its market price | Open |
| No way to list every contract bought | Open |
| Relationships between articles on the pitch are not legible | Open |

None of the open ones is hard, and none would have changed the outcome, which is
why none was rushed.

**The largest finding changed nothing yet, deliberately.** Once the retention
answer resolved into the absence of a social event, the remaining items became
small imperfections that could not have fixed it either way. Planning stopped
there. The nexus the project was built on, that Wikipedia's daily trends are good
raw material for a game, still looks right; the shape that material should take is
an open question needing game design rather than another sprint. Where that leaves
the project is recorded in [What we learned](./conclusions.md).

## Related

- [What we learned](./conclusions.md): the verdicts these findings produce
- [Test strategy](./testing.md): what the automated suites cover, and what only players could have found
- [Requirements](../overview/requirements.md): the obligations this run tested
- [What FantasyWiki is](../overview/what-is-fantasywiki.md): the premise the run contradicts
- [Nightly Scoring Pipeline](../docs/architecture/scoring-pipeline.md): the collector whose job history is cited here
