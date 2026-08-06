-- Migration: Give leagues a visibility, an invite policy and an invitation code
-- Date: 2026-08-06

-- A private league of friends is the product's unit of play (ADR 0002, ADR
-- 0003), but nothing in the schema said so: every league was equally open and
-- `POST /leagues/:id/my-team` let anyone who knew an id walk in. `visibility`
-- is what the join now checks.
--
-- TEXT rather than the `INTEGER NOT NULL DEFAULT 0` boolean this schema uses
-- elsewhere (contracts.settled), deliberately: this is an enum, it reads in a
-- SQL console, and a third value would not need another migration.
--
-- 'public' is the default because the Global League is the one league every
-- player is auto-enrolled in — it must come out of this migration joinable.
ALTER TABLE leagues ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';

-- Who may hand the invitation code out: 'members' (anyone fielding a team) or
-- 'admin' (only leagues.adminId). Chosen when the league is created; 'members'
-- is the default because the Global League's admin is the seeded 'system'
-- player that nobody logs in as, so 'admin' would make its code unreachable.
ALTER TABLE leagues ADD COLUMN invitePolicy TEXT NOT NULL DEFAULT 'members';

-- No default: a constant default on a uniquely-indexed column is a collision
-- the first time an INSERT omits it. Left nullable at the DB level too —
-- ALTER TABLE cannot add a NOT NULL UNIQUE column and this repo has never
-- rebuilt a table. "Every league has a code" is therefore held by the creation
-- path, not by the schema; the repository types the read as nullable rather
-- than pretending otherwise.
ALTER TABLE leagues ADD COLUMN invitationCode TEXT;

-- The seeded Global League gets a fixed code rather than a random one so it is
-- the same everywhere and can be asserted on. It is public, so this code is a
-- share shortcut, not a secret. Every character is drawn from the alphabet in
-- model/league.ts — a migration takes no bind parameters, so that link is
-- pinned by backend/src/tests/integration/leagueVisibility.integration.test.ts
-- instead (the same arrangement as STARTING_CREDITS and the team_credits view).
UPDATE leagues
SET invitationCode = 'EARTH'
WHERE id = 'global' AND invitationCode IS NULL;

-- Any other league predating this migration gets its own code. In practice
-- there are none — nothing can create a league yet (#4) — but a league left
-- with NULL here would be one nobody could ever share, and this is cheaper
-- than finding that out later. Five independent draws: SQLite re-evaluates
-- random() per occurrence. The modulo is very slightly biased towards the
-- front of the alphabet, which does not matter for codes nobody is guessing
-- at; the TypeScript generator that issues codes from now on rejection-samples
-- instead. This is the first UPDATE backfill in this directory.
UPDATE leagues
SET invitationCode =
  substr('23456789ABCDEFGHJKMNPQRSTVWXYZ', ((random() >> 0) & 1023) % 30 + 1, 1) ||
  substr('23456789ABCDEFGHJKMNPQRSTVWXYZ', ((random() >> 10) & 1023) % 30 + 1, 1) ||
  substr('23456789ABCDEFGHJKMNPQRSTVWXYZ', ((random() >> 20) & 1023) % 30 + 1, 1) ||
  substr('23456789ABCDEFGHJKMNPQRSTVWXYZ', ((random() >> 30) & 1023) % 30 + 1, 1) ||
  substr('23456789ABCDEFGHJKMNPQRSTVWXYZ', ((random() >> 40) & 1023) % 30 + 1, 1)
WHERE invitationCode IS NULL;

-- SQLite treats NULLs in a unique index as distinct, which is what lets the
-- column stay nullable and leaves every existing INSERT that omits it working.
CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_invitationCode
  ON leagues(invitationCode);
