---
title: "ADR 0008: League invitation codes are short, off the DTO, and checked inside the write"
type: adr
tags: [league, membership, invitation, security, persistence, concurrency, decision]
related:
  - ./0007-derived-team-credits.md
  - ../domain/league-visibility.md
---

# League invitation codes are short, off the DTO, and checked inside the write

> **Status:** decided and implemented (#253, #4, #7).
> Migration `0007_league_visibility_and_invitation_codes.sql` adds `visibility`, `invitePolicy` and
> `invitationCode` to `leagues`; `TeamRepositoryD1.create` became a guarded `INSERT`; and
> `LeagueRepositoryD1.createWithFoundingTeam` is the path that issues codes.
> The join-by-code flow (#7) landed with `GET /api/leagues/by-code/:code`,
> `LeagueRepository.findIdByInvitationCode`, the `/leagues/join` page and invitation links, and
> with the rate limiting §1 left as the one accepted risk's outstanding mitigation.
>
> **Amended (#537):** the third arm of the gate below, `l.adminId = ?`, was removed from both the
> join `INSERT` and the rejoin `UPDATE`. Once league creation wrote the founder's team in the same
> transaction, no path could reach it, an admin is a member by construction, and one who leaves
> has handed the league on before they can come back. The snippet and the wording here are the
> amended ones.

Leagues could not be private, and joining one was ungated: any authenticated player who knew a
league id could create a team in it. This ADR records how the invitation code is shaped, where it
is allowed to travel, and where the rule is enforced.

The rule itself, who may join what, is stated once in
[League Visibility](../domain/league-visibility.md) and not repeated here.

## Decision

### 1. Five characters from a 30-character ambiguity-free alphabet

`23456789ABCDEFGHJKMNPQRSTVWXYZ`, digits and capitals minus `0`/`O`, `1`/`I`/`L`, and `U`.
Thirty characters over a length of five is 30^5 ≈ **24.3 million** codes.

The exclusions are the pairs a code gets misheard as when it is read down a phone, which is the
way these actually get shared. `U` is dropped so a random draw cannot spell something unfortunate.

Uppercase and symbol-free is also exactly QR's **alphanumeric mode**, the densest encoding, so
rendering a code as a QR (deferred) fits in a version-1 symbol rather than falling back to byte
mode. That is a reason for the constraint, not a coincidence.

Codes are stored uppercase and normalized before comparison (`normalizeInvitationCode` strips
whitespace and hyphens, uppercases), so a code pasted out of a chat as `" ab-cde "` still works.

**Only private leagues have one.** A public league is joinable by anyone, so a code on it would
guard nothing and would be one more thing to keep in step with reality, an earlier draft gave one
to every league "for a uniform share link", which is what a URL already is. Migration 0007
therefore backfills nothing: every league that exists comes out public and codeless, the Global
League included.

**Accepted risk, and its mitigation.** 24.3 million codes is ≈24.5 bits. Collisions are a
non-issue, the unique index plus a bounded retry handles them. *Guessability* is the open flank:
at ten thousand private leagues, roughly one in 2,400 random guesses would hit some league. The
impact is a stranger joining a fantasy league, which does not justify a longer code that nobody can
read aloud.

The mitigation is the `JOIN_RATE_LIMITER` binding (namespace `1003`, **5 requests per 60 seconds**),
keyed on the **player id**, every caller here is authenticated, and an account is the more
expensive thing to mint than an IP.

**One bucket covers both code-bearing paths**: `GET /leagues/by-code/:code` and the
`POST /leagues/:id/my-team` requests that present an `invitationCode`. Two limiters would let a
guesser alternate between resolving and redeeming and spend twice the budget, so the shared
namespace is the decision, not an implementation detail, and it is pinned by a test that exhausts
the limit through resolve and then asserts redeem answers 429.

A join that presents **no** code is deliberately not charged. That keeps the limiter off signup and
off the public-league shelf, neither of which is a guessing surface, and it closes no loophole: a
codeless request to a private league is answered with `LEAGUE_IS_PRIVATE`, the same sentence for
every private league in the database, so there is nothing there to grind.

What this buys is honest but bounded: the platform's rate limiter only supports a 10s or 60s
period, so this caps the *rate*, not a daily total. It converts "grind the code space as fast as
HTTP allows" into "five attempts a minute per authenticated account", which is the difference
between a script and a nuisance. Codes are also rotatable, the code is not the league's identity,
so an `UPDATE` is safe, and that is the answer if one is ever known to have leaked.

The resolve endpoint is the one that most needed this. It is the cheapest possible probe, one GET,
no body, no write, so it, not the join, is what a guesser would grind, and it answers a wrong
code, an unused code and a malformed one with one identical 404 for the reason §3 gives.

### 2. The code is never a field on `LeagueDTO`

`GET /api/leagues/:id` is deliberately unscoped (see the domain doc: the id lets you *read* a
league, the code lets you *join* one). A code riding on `LeagueDTO` could therefore be lifted off a
public endpoint and used to walk straight through the gate it exists to guard.

So it is not on the DTO, and it is not on `model/League` either, that shape is handed to five
services every time one looks a league up for its Wikipedia domain, and one stray spread in a
future mapper would leak it. It is served only by `GET /api/leagues/:id/invite-code`, which applies
the league's invite policy and answers a disallowed caller exactly as it answers a missing league.

Exactly two repository calls touch the column, and neither can carry it out by accident:
`getInvitationCode(leagueId)` takes an id and returns a code, and `findIdByInvitationCode(code)`
takes a code and returns **an id, not a league**. The second is what
`GET /api/leagues/by-code/:code` resolves an invitation through, and returning only the id is what
forces it back through the ordinary unscoped `getById`, so the preview a player sees is the same
codeless `LeagueDTO` every other league read produces, reached by a different key. A call that
answered with a league would have been the obvious place for the code to hitch a ride out.

`visibility` *is* on the DTO, it is not a secret and the UI must badge it.

This is pinned by tests asserting no league read contains the code, in
`backend/src/tests/routes/leagues.integration.test.ts`, including the **creation** response, which
is where bundling it in would be most tempting, since the founder is by definition entitled to it.
They read it from `/:id/invite-code` one call later instead, which they pass by being a member of
the league they just founded. One endpoint serves codes; that is checkable, "mostly one endpoint"
is not.

Two different failures answer 404 there, "no such league" and "this league has no code", and
they carry different bodies. That is deliberate and safe: the policy check runs first, so an
unauthorised caller only ever sees the first. Only a caller already entitled to the code can tell
the two apart, and for them the distinction is the useful one.

### 3. The gate is inside the write

D1 has no interactive transactions, so reading a league's visibility and then inserting a team is a
race, the league can turn private in between. Following
[backend-error-constants.md](../architecture/backend-error-constants.md) §2 and the guarded
purchase `INSERT` of [ADR 0007](./0007-derived-team-credits.md), the conditions live in the
statement:

```sql
INSERT INTO teams (id, name, playerId, leagueId)
SELECT ???, l.id
  FROM leagues l
 WHERE l.id = ?
   AND (l.visibility = 'public' OR l.invitationCode = ?)
```

On rejection the repository returns one sentinel, `TEAM_ERRORS.JOIN_CONFLICT`, at write time it
cannot know which condition failed and must not guess. `TeamService` re-reads to name the cause: a
league that is not there is `LEAGUE_ERRORS.NOT_FOUND` (404), anything else is
`TEAM_ERRORS.LEAGUE_IS_PRIVATE` (403).

"Code missing" and "code wrong" are deliberately the same error. Distinguishing them tells someone
holding a guess whether they are close.

The preview endpoint holds the same line, and had to be built so it could not quietly break it:
`GET /api/leagues/by-code/:code` answers a malformed code, a well-formed code no league carries,
and a league that is not there with **one** 404 carrying **one** body, byte-identical, which is
what its test asserts rather than merely checking three 404s. Splitting them would have handed back
through the front door the oracle the join path refuses at the back: "right shape, no league" tells
a guesser their generator is aimed correctly, which is most of what they want to know.

One join refusal is deliberately *not* hidden. A league whose season has ended, or that its admin
closed early, answers `TEAM_ERRORS.LEAGUE_INACTIVE` (409), the rule is `isLeagueInactive` in
`model/league.ts` and is not respelled anywhere else. It is safe to be plain about because it is
not about the caller: a valid code is turned away by it too, and the league's dates are already
readable by anyone with its id. Telling someone holding a real invitation that the season is over,
rather than that their code is bad, is the difference between an explanation and a dead link. This
one check sits in the service rather than inside the guarded `INSERT`, because moving it there
would mean writing the model function out a second time as SQL; what that costs is a race one
request wide, and one extra team in a league that has stopped scoring is not the failure the
guarded write exists to prevent.

### 4. Uniqueness is an index plus a bounded retry

`ALTER TABLE ADD COLUMN` cannot declare `UNIQUE` inline and this repo does not rebuild tables, so
uniqueness is `idx_leagues_invitationCode`. A lost race is classified inside the repository as
`LEAGUE_ERRORS.INVITATION_CODE_TAKEN`, no caller ever sees SQLite's wording, the same arrangement
as `PLAYER_ERRORS.USERNAME_TAKEN`.

`withUniqueInvitationCode(write)` wraps a write that needs a free code and redraws on that error.
It is **bounded**: with 24.3 million codes, repeated collisions mean a stuck RNG or a mis-declared
index, and an unbounded loop would turn that into a hung request instead of an error.

Its production caller is `LeagueService.createLeague`, which states only its write and inherits the
retry policy, the reason the helper was written before there was anything to call it. A **public**
league does not go through it at all: it is written with a `null` code, because there is nothing
for one to guard.

### 5. The column is nullable, and the invariant lives in the creation path

Same constraint as above: `ALTER TABLE` cannot add a `NOT NULL UNIQUE` column. SQLite treats NULLs
in a unique index as distinct, which is doing double duty here: it lets every public league share
the absence of a code while no two private leagues share the same one, and it left 22 existing test
inserts untouched. "A private league has a code" is therefore a rule the creation path keeps, not
one the schema enforces, and the repository types the read as `string | null` rather than
pretending otherwise.

That path is now a specific one: `LeagueService.createLeague` is the **only** writer of a league
row, and it branches on `visibility` to decide between a drawn code and `null`. The invariant holds
because there is one place that could break it, not because the column forbids it. A league that
predates it, the Global League, and anything inserted by a test, is public and codeless, which is
consistent rather than an exception.

## Consequences

- `adminId` becomes load-bearing. It was stored, selected by both repositories, and read by no
  production code; it now decides the `admin` invite policy. (It also decided entry to the league
  the admin owned, until #537 found that arm of the gate unreachable and removed it.)
- `TEAM_ERRORS` grew from one constant to six, because the route could no longer map every
  `createTeam` failure to 400, a permission refusal is 403 and a missing league 404, and a status
  may never be derived from message content.
- Joining a league that does not exist now answers 404 instead of silently attempting an insert and
  surfacing a foreign-key failure as a 400.
- `TEAM_ERROR_STATUS` gained 409 as a possible answer, for `LEAGUE_INACTIVE`. It is the first join
  refusal that is about the league's state rather than the caller's standing, and 403 would have
  invited the client to read it as "get permission and retry".
- The code now travels in a URL, in the invitation link `/leagues/join?code=…`. That is a genuine
  widening, a link is forwardable in a way a spoken code is not, and it is the point of a link.
  It changes nothing about what the code can do, and the join page keeps it in the query string
  rather than trading it for the league id, so the URL a player was sent is one they can resend.
- An invitation link opened while logged out is **lost**: `router.beforeEach` bounces any
  non-public route to `/home` and the query string goes with it. That is consistent with every
  other deep link in the app rather than specific to invitations, and surviving OAuth would mean
  carrying intent through the round trip, worth doing, and not part of this decision.

## Related

- [League Visibility](../domain/league-visibility.md): the rule this mechanism enforces.
- [ADR 0007: Derived Team Credits](./0007-derived-team-credits.md): the guarded-write precedent.
- [Backend Error Constants](../architecture/backend-error-constants.md): §1 constants, §2 guarded
  writes.
- `model/league.ts`: `INVITATION_CODE_ALPHABET`, `INVITATION_CODE_LENGTH`, `isInvitationCode`,
  `normalizeInvitationCode`.
