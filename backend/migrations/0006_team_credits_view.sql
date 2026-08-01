-- Migration: State the derived-credits rule once, as a view
-- Date: 2026-08-01

-- Team credits are derived from the contracts ledger, never stored (migration
-- 0005 dropped teams.credits). Until now that derivation was hand-copied into
-- four repositories, so the aggregate's core invariant lived in four places at
-- once. This view is its single canonical statement in SQL:
--
--   credits = STARTING_CREDITS - sum(purchasePrice) + sum(salePayout where settled)
--
-- Driven from teams (not from contracts) so that every team gets exactly one
-- row: a team with no contracts yields STARTING_CREDITS rather than no row at
-- all. That is what lets every caller plain-JOIN the view, and lets the
-- guarded contract INSERT read it as a scalar subquery without a COALESCE
-- fallback re-stating the starting budget.
--
-- The starting budget is inlined because SQLite views cannot take parameters.
-- It MUST stay equal to STARTING_CREDITS in model/team.ts -- an integration
-- test asserts the two agree, so drift fails the build rather than silently
-- mispricing every balance.
--
-- Rationale and the race this shape protects:
-- docs/adr/0007-team-credits-derived-and-enforced-at-write.md
CREATE VIEW IF NOT EXISTS team_credits AS
SELECT t.id AS teamId,
       1000
         - COALESCE(SUM(c.purchasePrice), 0)
         + COALESCE(SUM(CASE WHEN c.settled = 1 THEN c.salePayout ELSE 0 END), 0) AS credits
FROM teams t
LEFT JOIN contracts c ON c.teamId = t.id
GROUP BY t.id;
