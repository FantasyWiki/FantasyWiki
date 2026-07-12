# Backend: typed error constants and guarded writes

Services and repositories return `Result<T, string>` (`repositories/result.ts`).
The string is fine as a _message_, but it must never be an _interface_: code
that branches on `error.includes(...)`, regexes, or a re-built copy of another
module's message breaks silently the moment someone rewords the text. This doc
describes the two patterns that replace string matching.

## 1. Error constants: compare by reference, not by content

The module that _produces_ an error owns its constant and exports it; callers
compare against the constant, never against a literal:

```ts
// The producer (repository contract or service) owns the constant:
export const CONTRACT_WRITE_ERRORS = {
  PURCHASE_CONFLICT: "Purchase conditions no longer hold",
} as const;

// A consumer branches on identity with the constant:
if (createResult.error !== CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT) {
  return createResult; // a real persistence failure — pass it through
}
// ...handle the conflict case
```

Existing constants and their owners:

| Constant                | Owner                                    | Consumers                                    |
| ----------------------- | ---------------------------------------- | -------------------------------------------- |
| `PLAYER_ERRORS`         | `repositories/playerRepository.ts`       | `services/login.ts`, `routes/helpers.ts`     |
| `LEAGUE_ERRORS`         | `repositories/leagueRepository.ts`       | `routes/leagues.ts`                          |
| `TEAM_ERRORS`           | `repositories/teamRepository.ts`         | `services/contract.ts`, `services/lineup.ts` |
| `NOTIFICATION_ERRORS`   | `repositories/notificationRepository.ts` | `routes/notifications.ts`                    |
| `CONTRACT_WRITE_ERRORS` | `repositories/contractRepository.ts`     | `services/contract.ts`                       |
| `CONTRACT_ERRORS`       | `services/contract.ts`                   | `routes/leagues.ts`                          |
| `LINEUP_ERRORS`         | `services/lineup.ts`                     | `routes/leagues.ts`                          |
| `LOGIN_ERRORS`          | `services/login.ts`                      | —                                            |

Rules for new code:

- **Producer owns the constant.** Repository-level errors live in the
  repository _contract_ file (so services depend only on the interface
  module); service-level errors live in the service. One message with one
  meaning has one owner: `TEAM_ERRORS.NO_TEAM_IN_LEAGUE` is the single "player
  has no team here" string, which `CONTRACT_ERRORS.NO_TEAM` and
  `LINEUP_ERRORS.NO_TEAM` alias rather than re-spell.
- **The wording is then free to change** — it is display text, nothing more.
  Tests must compare against the constant too, never against a copy of its text.
- **Never re-construct another module's message** to compare against it, and
  never branch on raw driver text (`"UNIQUE constraint failed: ..."`). If you
  need to distinguish a persistence failure, classify it _inside the
  repository_ and surface a constant — `PlayerRepositoryD1.save` recognises
  SQLite's uniqueness message and returns `PLAYER_ERRORS.USERNAME_TAKEN`, so
  the login retry loop never sees driver text.
- **Routes map constants to statuses by identity, and default to 500.** An
  error the service never named is _ours_ (a D1 outage, a Wikimedia failure),
  not the client's:

  ```ts
  const CONTRACT_ERROR_STATUS: Record<ContractError, 404 | 400> = { ... };
  ```

  Declaring the map as a total `Record` over the error union means adding a
  constant without giving it a status is a compile error. Never derive a status
  from message _content_ (`/not found/i` on free text served D1 outages as 404).

## 2. Guarded writes: check-and-write in one statement

D1 has no interactive transactions, so a service-side check followed by a
write is a race: another request can change the world between the two
statements. The fix is to evaluate the conditions _inside_ the write — one
statement is one implicit transaction, and SQLite/D1 serialize writers:

```sql
INSERT INTO contracts (...)
SELECT ?, ?, ...
WHERE <derived credits cover the price>
  AND NOT EXISTS (<an active contract on this article in this league>)
  AND (<active contracts held by the team>) < ?
```

(`contractRepositoryD1.create`; `settleSale` uses the same idea with a guarded
`UPDATE ... WHERE settled = 0`.)

The calling service keeps its pre-checks — they exist to give the user a
precise error without paying for a write — but they are advisory. The INSERT
is the arbiter. The protocol on rejection (`meta.changes === 0`):

1. The repository returns the single sentinel
   `CONTRACT_WRITE_ERRORS.PURCHASE_CONFLICT` — at write time it cannot know
   which condition failed, and it should not guess.
2. The service re-reads and re-runs the _same_ rule set to name the cause
   (`ContractService.purchaseRejection`, shared by the pre-check and the
   post-conflict classification, so the two paths cannot drift). If every
   ownership rule passes on the re-read, the credits guard was the one that
   rejected — it is the only other condition in the statement.

When adding a new business invariant to a write (e.g. a per-league roster
rule), extend all three places together:

- the SQL guard in the repository implementation,
- `purchaseRejection` (or the equivalent shared rule helper), and
- an integration test that violates the invariant _at the repository level_,
  bypassing the service pre-checks — that simulates exactly the state a
  concurrent request creates (see `contract.integration.test.ts`,
  `"ContractRepositoryD1.create guarded INSERT"`).

## What this replaced

For reference, the patterns that used to live here — none of them survive, and
none should come back:

- `error.includes("UNIQUE constraint failed: players.username")` in
  `services/login.ts`, coupling login behavior to SQLite's message format.
  Now classified in `PlayerRepositoryD1.save` as `PLAYER_ERRORS.USERNAME_TAKEN`.
- Re-building `` `Player with account id ${id} not found` `` in
  `services/login.ts` to detect a first-time login, coupling it to the
  repository's copywriting. Now `PLAYER_ERRORS.ACCOUNT_NOT_FOUND`.
- `/not found/i.test(error)` picking 404 vs 400 in `routes/leagues.ts`, which
  served D1 outages to clients as 404s and every other infrastructure failure
  as a 400. Now `CONTRACT_ERROR_STATUS` + a 500 default, with `playerErrorStatus`
  doing the same for session-player resolution.

Still free text, and fine as such: messages nobody branches on (e.g. the
Wikimedia views-fetch failures in `services/contract.ts`). They reach the
client as 500s. Give one a constant the moment any code needs to _decide_
something from it.
