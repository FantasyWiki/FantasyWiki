-- Migration: Let an admin close a league early and a player leave one
-- Date: 2026-08-11

-- Nothing here deletes anything, and that is the point of the whole migration.
--
-- A league had exactly one way to stop: its `endDate` passing. There was no way
-- for an admin to end a league nobody is playing any more, and no way for a
-- player to walk away from one. The obvious implementations of both — DELETE
-- the league, DELETE the team — would take the season's contracts,
-- performances and standings with them, and a fantasy season that cannot be
-- read back afterwards is not a season, it is a scoreboard someone unplugged.
--
-- So both acts are recorded as timestamps on rows that stay. Every contract,
-- every performance and every standing remains queryable exactly as it was, and
-- "who won that league we closed in March" stays an answerable question. There
-- is no hard-delete endpoint for either, and there should never be one:
-- docs/domain/league-lifecycle.md states the rule once.

-- When the league's admin closed it early, or NULL for a league that is still
-- open. The other half of "inactive" — the season simply running out — is
-- derived from `endDate` at read time and is deliberately *not* written here:
-- a stored status column would be a second truth to keep in step with the
-- clock, and it would be wrong for exactly as long as nobody wrote to it.
--
-- TEXT holding an ISO-8601 instant, matching `startDate`/`endDate` beside it,
-- so the whole of a league's calendar reads the same way in a SQL console.
--
-- Nullable with no default, because null *is* the meaning: an open league. That
-- also makes this migration a no-op for every league that exists today, which
-- is the correct outcome — none of them have been closed.
ALTER TABLE leagues ADD COLUMN closedAt TEXT;

-- When this player walked away from this league, or NULL while they are still
-- playing it. The team row itself is never removed: it keeps its name, its
-- contracts and its place in the standings, because the season it played is a
-- fact and erasing it would rewrite the league's history for everyone else too.
--
-- Reads that mean "current member" filter on `leftAt IS NULL`
-- (`TeamRepositoryD1.getByPlayerAndLeague`); reads that mean "the record of who
-- played" do not filter at all (the leaderboard).
ALTER TABLE teams ADD COLUMN leftAt TEXT;

-- No new index and no new constraint, on purpose, and neither is an oversight:
--
--  * Both columns are read through the existing indexed lookups —
--    `leagues.id` (primary key) and `idx_teams_playerId` / `UNIQUE (playerId,
--    leagueId)` — with `IS NULL` applied to the single row those already find.
--    An index on a column that is null for almost every row would earn nothing.
--
--  * "A league closes once" and "a team leaves once" are enforced by the
--    guarded writes rather than by the schema: `UPDATE ... WHERE closedAt IS
--    NULL` and `UPDATE ... WHERE leftAt IS NULL` refuse a second stamp inside
--    one statement, which is the only kind of atomicity D1 offers
--    (docs/architecture/backend-error-constants.md §2). SQLite could not help
--    here anyway — `ALTER TABLE ADD COLUMN` cannot declare `UNIQUE` or a
--    `CHECK`, and expressing it in the schema would mean rebuilding the table,
--    which this repo has never done and should not start doing for a rule a
--    single WHERE clause already holds.
