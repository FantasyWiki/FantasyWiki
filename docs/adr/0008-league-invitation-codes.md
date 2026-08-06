---
title: "ADR 0008: League invitation codes are short, off the DTO, and checked inside the write"
type: adr
tags: [league, membership, invitation, security, persistence, concurrency, decision]
related:
  - ./0007-derived-team-credits.md
  - ../domain/league-visibility.md
---

# League invitation codes are short, off the DTO, and checked inside the write

> **Status:** decided and implemented (#253; the join-by-code UI remains #5 and #7).
> Migration `0007_league_visibility_and_invitation_codes.sql` adds `visibility`, `invitePolicy` and
> `invitationCode` to `leagues`, and `TeamRepositoryD1.create` became a guarded `INSERT`.

Leagues could not be private, and joining one was ungated: any authenticated player who knew a
league id could create a team in it. This ADR records how the invitation code is shaped, where it
is allowed to travel, and where the rule is enforced.

The rule itself — who may join what — is stated once in
[League Visibility](../domain/league-visibility.md) and not repeated here.

## Decision

### 1. Five characters from a 30-character ambiguity-free alphabet

`23456789ABCDEFGHJKMNPQRSTVWXYZ` — digits and capitals minus `0`/`O`, `1`/`I`/`L`, and `U`.
Thirty characters over a length of five is 30^5 ≈ **24.3 million** codes.

The exclusions are the pairs a code gets misheard as when it is read down a phone, which is the
way these actually get shared. `U` is dropped so a random draw cannot spell something unfortunate.

Uppercase and symbol-free is also exactly QR's **alphanumeric mode**, the densest encoding — so
rendering a code as a QR (deferred) fits in a version-1 symbol rather than falling back to byte
mode. That is a reason for the constraint, not a coincidence.

Codes are stored uppercase and normalized before comparison (`normalizeInvitationCode` strips
whitespace and hyphens, uppercases), so a code pasted out of a chat as `" ab-cde "` still works.

**Accepted risk.** 24.3 million codes is ≈24.5 bits. Collisions are a non-issue — the unique index
plus a bounded retry handles them. *Guessability* is the open flank: at ten thousand private
leagues, roughly one in 2,400 random guesses would hit some league. The impact is a stranger
joining a fantasy league, which does not justify a longer code that nobody can read aloud. The
mitigation is rate-limiting the redeem path, which belongs with the join-by-code UI (#5). Codes are
rotatable — the code is not the league's identity, so a `UPDATE` is safe.

### 2. The code is never a field on `LeagueDTO`

`GET /api/leagues/:id` is deliberately unscoped (see the domain doc: the id lets you *read* a
league, the code lets you *join* one). A code riding on `LeagueDTO` could therefore be lifted off a
public endpoint and used to walk straight through the gate it exists to guard.

So it is not on the DTO, and it is not on `model/League` either — that shape is handed to five
services every time one looks a league up for its Wikipedia domain, and one stray spread in a
future mapper would leak it. It is read only by `LeagueRepository.getInvitationCode`, and served
only by `GET /api/leagues/:id/invite-code`, which applies the league's invite policy and answers a
disallowed caller exactly as it answers a missing league.

`visibility` *is* on the DTO — it is not a secret and the UI must badge it.

This is pinned by tests asserting no league read contains the code, in
`backend/src/tests/routes/leagues.integration.test.ts`.

### 3. The gate is inside the write

D1 has no interactive transactions, so reading a league's visibility and then inserting a team is a
race — the league can turn private in between. Following
[backend-error-constants.md](../architecture/backend-error-constants.md) §2 and the guarded
purchase `INSERT` of [ADR 0007](./0007-derived-team-credits.md), the conditions live in the
statement:

```sql
INSERT INTO teams (id, name, playerId, leagueId)
SELECT ?, ?, ?, l.id
  FROM leagues l
 WHERE l.id = ?
   AND (l.visibility = 'public' OR l.adminId = ? OR l.invitationCode = ?)
```

On rejection the repository returns one sentinel, `TEAM_ERRORS.JOIN_CONFLICT` — at write time it
cannot know which condition failed and must not guess. `TeamService` re-reads to name the cause: a
league that is not there is `LEAGUE_ERRORS.NOT_FOUND` (404), anything else is
`TEAM_ERRORS.LEAGUE_IS_PRIVATE` (403).

"Code missing" and "code wrong" are deliberately the same error. Distinguishing them tells someone
holding a guess whether they are close.

### 4. Uniqueness is an index plus a bounded retry

`ALTER TABLE ADD COLUMN` cannot declare `UNIQUE` inline and this repo does not rebuild tables, so
uniqueness is `idx_leagues_invitationCode`. A lost race is classified inside the repository as
`LEAGUE_ERRORS.INVITATION_CODE_TAKEN` — no caller ever sees SQLite's wording, the same arrangement
as `PLAYER_ERRORS.USERNAME_TAKEN`.

`withUniqueInvitationCode(write)` wraps a write that needs a free code and redraws on that error.
It is **bounded**: with 24.3 million codes, repeated collisions mean a stuck RNG or a mis-declared
index, and an unbounded loop would turn that into a hung request instead of an error.

It has no production caller until league creation (#4) lands. That is deliberate — it exists so
that creation states only its `INSERT` and inherits the retry policy, and it ships with unit tests
that exercise the policy against a fake write.

### 5. The column is nullable, and the invariant lives in the creation path

Same constraint as above: `ALTER TABLE` cannot add a `NOT NULL UNIQUE` column. SQLite treats NULLs
in a unique index as distinct, which is what let migration 0007 leave 22 existing test inserts
untouched. "Every league has a code" is therefore a rule the creation path keeps, not one the
schema enforces, and the repository types the read as `string | null` rather than pretending
otherwise.

## Consequences

- `adminId` becomes load-bearing. It was stored, selected by both repositories, and read by no
  production code; it now decides both admin entry and the `admin` invite policy.
- `TEAM_ERRORS` grew from one constant to six, because the route could no longer map every
  `createTeam` failure to 400 — a permission refusal is 403 and a missing league 404, and a status
  may never be derived from message content.
- Joining a league that does not exist now answers 404 instead of silently attempting an insert and
  surfacing a foreign-key failure as a 400.

## Related

- [League Visibility](../domain/league-visibility.md) — the rule this mechanism enforces.
- [ADR 0007: Derived Team Credits](./0007-derived-team-credits.md) — the guarded-write precedent.
- [Backend Error Constants](../architecture/backend-error-constants.md) — §1 constants, §2 guarded
  writes.
- `model/league.ts` — `INVITATION_CODE_ALPHABET`, `INVITATION_CODE_LENGTH`, `isInvitationCode`,
  `normalizeInvitationCode`.
