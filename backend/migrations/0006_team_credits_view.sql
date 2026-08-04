-- Migration: State the derived-credits rule once, as a view
-- Date: 2026-08-04

-- The single SQL statement of the derived-credits rule (ADR 0007), replacing
-- four hand-copied versions of it. Team-anchored, so a team with no contracts
-- still appears at the full starting budget and callers need no COALESCE.
--
-- The 1000 is STARTING_CREDITS from model/team.ts — a view takes no bind
-- parameters, so it is pinned to the TS constant by
-- backend/src/tests/integration/teamCredits.integration.test.ts instead.
CREATE VIEW IF NOT EXISTS team_credits AS
SELECT t.id AS teamId,
       1000 - COALESCE(SUM(c.purchasePrice), 0)
            + COALESCE(SUM(CASE WHEN c.settled = 1 THEN c.salePayout ELSE 0 END), 0) AS credits
FROM teams t
LEFT JOIN contracts c ON c.teamId = t.id
GROUP BY t.id;
