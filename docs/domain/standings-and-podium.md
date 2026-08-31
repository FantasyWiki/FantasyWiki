---
title: Standings and Podium
type: domain
tags: [scoring, standings, leaderboard, podium, league]
---

# Standings, and when a league has a podium

A league's standing is **cumulative points, descending**. Nothing else is
weighted into it: no credits, no team value, no games played. What a night adds
to a team's total is [Scoring & Economy System](./scoring-system.md) §5; this doc
is what the table then says.

## What a row is

| field | meaning |
| --- | --- |
| `cumulativePoints` | the sum of every daily performance the team has ever scored |
| `rank` | position in that order, best first |
| `rankDelta` | places gained or lost against **yesterday's** order, or `null` |

The total is a sum over stored performances, not a running counter kept up to
date by hand. A league that has never been scored therefore reads as a table of
zeroes rather than an empty one, which is deliberate, because the standings are
the only screen that shows who is playing at all.

**Rank movement is a comparison of two orders, not of two scores.** The previous
order is recomputed from each team's cumulative total as it stood before that
team's own most recent scored day, and the delta is the difference between the
two positions. A team can score well and still fall.

`rankDelta` is `null`, and no movement is shown, for a team with no earlier total
to be ranked by, one whose whole history is its first scored day. There is no
such thing as "climbed from nowhere": before that day, movement is not zero, it
is meaningless. A team that had genuinely scored zero up to then is shown the
same way, which is the accepted cost of reading the two cases off one number.

**Ties are broken by nothing.** Two teams on the same total take adjacent ranks
in whatever order the sort produced. This is honest for the case that actually
occurs, a league before its first scored day, where every team is tied on zero,
and it is why the podium is withheld there rather than crowning the first row.

## The podium runs all season

The three medal steps are **not** an end-of-season ceremony. They are shown
through the whole season, as a live reading of who is ahead, and the season's end
escalates the same podium rather than introducing one:

| | live | final |
| --- | --- | --- |
| when | the season is **active** | the season has **ended** |
| shows | the top three, with movement | the top three, still |
| drops |, | movement: nothing is left to move |

Two things withhold the podium entirely:

- **A league nobody has scored in yet.** The ranks are then an arbitrary
  ordering of a universal tie, and crowning anyone would be a fiction. The
  standings still list every team, on zero, with a note saying so, and a
  different note for a season that has not kicked off from one whose first day is
  still open.
- **A board that has not settled.** Mid-fetch the list is empty, and a podium
  built from that stages the wrong three for a frame.

An **inactive** league keeps both: an ended or closed league is fully readable,
podium included, because nothing anyone can still read is ever deleted
([League Lifecycle](./league-lifecycle.md)).

## Where each piece lives

| concern | code |
| --- | --- |
| cumulative totals, and yesterday's | `performanceRepository.getLeagueCumulatives` |
| ranks and movement | `backend/src/services/leaderboard.ts` |
| the table, and the unscored note | `frontend/src/components/league/LeagueStandings.vue` |
| the three steps, live and final | `frontend/src/components/league/LeaguePodium.vue` |
| when a podium is shown at all | `frontend/src/views/LeaguePage.vue` |
| which season phase a league is in | `frontend/src/composables/useLeagueCalendar.ts` |

## Related

- [Scoring & Economy System](./scoring-system.md) §5: what a day adds to a total
- [League Season](./league-season.md): what makes a season active, then ended
- [League Lifecycle](./league-lifecycle.md): why an ended league still has a page
- [Nightly Scoring Pipeline](../architecture/scoring-pipeline.md): what writes the performances
