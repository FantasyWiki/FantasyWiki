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

-- Only a private league has a code, so this is null for every league that
-- exists today and there is nothing to backfill: a public league is joinable
-- by anyone, and a credential guarding nothing is just a column that has to be
-- kept in step with reality. The Global League in particular gets none.
--
-- No default either: a constant default on a uniquely-indexed column is a
-- collision the first time an INSERT omits it. Nullable at the DB level too —
-- ALTER TABLE cannot add a NOT NULL UNIQUE column and this repo has never
-- rebuilt a table — so "a private league has a code" is an invariant the
-- creation path keeps rather than one the schema enforces, and the repository
-- types the read as nullable rather than pretending otherwise.
ALTER TABLE leagues ADD COLUMN invitationCode TEXT;

-- SQLite treats NULLs in a unique index as distinct, which is what lets every
-- public league share the absence of a code while no two private leagues can
-- share the same one — and what leaves every existing INSERT that omits the
-- column working untouched.
CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_invitationCode
  ON leagues(invitationCode);
