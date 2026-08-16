---
title: League Lifecycle
type: domain
tags: [league, lifecycle, membership, closure, audit]
related:
  - ./league-season.md
  - ./league-visibility.md
---

# League Lifecycle

A league is **active**, **ended** or **closed**, and a player in one has either
stayed or **left**. This page states those four words once; everything else
links here rather than re-deciding what they mean.

## Nothing anyone can still read is ever deleted

**This is the rule the rest of the page follows from.** No endpoint deletes a
team, and the only one that deletes a league does so when the last player walks
out of it — see [The empty league](#the-empty-league) below.

Deleting a played league would take its contracts, performances and standings
with it. Deleting a team would do the same to one player's whole season, and
would silently change everyone else's — the ranks above and below a team are
only true with that team in them. A fantasy season that cannot be read back
afterwards is not a season; it is a scoreboard someone unplugged.

So both endings are **recorded rather than performed**. Closing a league writes
`leagues.closedAt`; leaving one writes `teams.leftAt`
([migration 0008](../../backend/migrations/0008_league_closure.sql)). Both rows
stay, whole, and "who won that league we closed in March" stays an answerable
question.

### The empty league

The exception, and the reason it is not really one: **a league whose last member
leaves is deleted outright**, and its teams, contracts, performances, lineups
and notifications cascade with it.

An audit trail is reached *through* a league — its page, its final table, its
per-team history. A league nobody is in appears in nobody's list and opens from
nowhere, so there is no one it is auditable *by*; keeping it would preserve the
form of the rule while abandoning its purpose, and would leave rows no query
ever addresses again.

The Global League cannot reach this state: nobody may leave it.

## The four states

| State        | What it means                                            |
| ------------ | -------------------------------------------------------- |
| **active**   | The season is running and the league can be played.       |
| **ended**    | Its `endDate` has passed. Derived, never written.         |
| **closed**   | Its admin ended it early. `closedAt` is set.              |
| **inactive** | **ended or closed** — no click leads back into play.      |

`isLeagueInactive` in `model/league.ts` is the one statement of that last row,
shared by both sides: the frontend filters the league picker with it, and the
backend refuses joins with it.

Only **closed** is stored. **Ended** is derived from `endDate` on every read,
because a stored status column would be a second truth to keep in step with the
clock and would be wrong for exactly as long as nobody wrote to it — the same
reasoning that keeps credits derived in
[ADR 0007](../adr/0007-derived-team-credits.md).

An inactive league is still fully **readable**. Its page, factsheet, podium and
final table all work; that is what closing is *for*.

## Closing a league

Only `leagues.adminId` may close one, and a league closes **once**.

- Both rules are conditions of the `UPDATE` itself, not checks before it, for
  the reason set out in
  [Backend Error Constants §2](../architecture/backend-error-constants.md) —
  two closes racing would both find the column empty, and the later write would
  move the recorded moment the season stopped.
- A second close is an **error**, not a silent success. `closedAt` records
  *when*; letting a repeat through would either overwrite that fact or report a
  close that never happened.
- A closed league **refuses new teams**. There is nothing to join.

## Leaving a league

A player leaves; their team stays. Concretely:

- **They keep their place in the standings.** Their team, its name, its points
  and its contracts are all still there, and the leaderboard still lists them.
  A season they played is a fact about the league, not a possession they take
  with them.
- **`getMyTeam` stops answering with it.** Every self-scoped surface —
  contracts, lineup, market, the invite-code membership check — reaches the
  league through that one read, so all of them close behind a departed player at
  once, without any of them knowing that leaving exists. This is what makes
  leaving *mean* something.
- **They stop counting.** The league's `teamCount` and the player's own league
  list both mean "now", so a departed team is in neither.
- **They can come back, to the same team.** `UNIQUE (playerId, leagueId)` gives
  a player one row per league for good, so rejoining is not a second team: it
  clears `leftAt` on the one they left, and its contracts, its ledger and its
  place in the standings are exactly where they were. That is the only thing
  rejoining can honestly mean here — nothing was removed when they left, so
  there is nothing to restore. They fill the join form in again and may rename
  the team; the league's entry rules are re-checked, so a league that has since
  gone private wants its code from them like anyone else.
- **Their contracts keep running.** The settlement sweep goes on settling what
  they committed to while they were playing. Leaving is a statement about the
  player, not a licence to rewrite the ledger.

### When the admin leaves

The admin may leave like anyone else, but a league must never be left with an
admin who has walked out of it — only an admin can close one, so that league
could never be ended by anybody. So the same transaction hands it on:

- **Adminship passes to the longest-standing member still playing.** They are
  not asked and cannot decline; a league without an admin is the state being
  avoided, so there is no branch in which nobody takes it. Seniority is join
  order, which is the only record `teams` keeps of it.
- **If nobody is still playing, the league is deleted** rather than handed to
  no one — the empty-league rule above.

### Who cannot leave

- **Anyone, from the Global League.** It is the league first login enrols every
  player into, and the app routes a player without a team there to create one.
  Leaving would strand them in that loop, since the join gate would then refuse.
- **Anyone, from an inactive league.** There is nothing left to walk out of, and
  stamping `leftAt` on a finished season would put an abandonment on the record
  that never happened — a player who merely outlived a league did not quit it.

## Where each half is enforced

Split deliberately, and not arbitrarily:

- **`closedAt` can change while a request is in flight**, so every write that
  depends on it carries the condition *inside* the statement — the join
  `INSERT` and the leave `UPDATE` both check `closedAt IS NULL`.
- **`endDate` is fixed when the league is founded and never moves.** Reading it
  and then writing is not a race, so that half is checked in the service, in
  terms of `isLeagueInactive`, rather than spelled a second time in SQL where it
  could drift from the shared rule.

## Related

- [League Season](./league-season.md) — where `endDate` comes from, and why a
  season has a floor and a ceiling.
- [League Visibility](./league-visibility.md) — the other gate on joining, and
  the admin's other privilege.
- [Backend Error Constants](../architecture/backend-error-constants.md) — the
  guarded-write pattern both endings use, and the sentinel-then-re-read protocol
  that names a refusal.
- [ADR 0007: Derived Team Credits](../adr/0007-derived-team-credits.md) — the
  same "derive it, don't store it" reasoning applied to a balance.
