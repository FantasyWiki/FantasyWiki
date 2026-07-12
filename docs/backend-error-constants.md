# Backend: typed error constants and guarded writes

Services and repositories return `Result<T, string>` (`repositories/result.ts`).
The string is fine as a *message*, but it must never be an *interface*: code
that branches on `error.includes(...)`, regexes, or a re-built copy of another
module's message breaks silently the moment someone rewords the text. This doc
describes the two patterns that replace string matching.

## 1. Error constants: compare by reference, not by content

The module that *produces* an error owns its constant and exports it; callers
compare against the constant, never against a literal:

```ts
// The producer (repository contract or service) owns the constant:
export const CONTRACT_ERRORS = {
  PURCHASE_CONFLICT: "Purchase conditions no longer hold",
} as const;

// A consumer branches on identity with the constant:
if (createResult.error !== CONTRACT_ERRORS.PURCHASE_CONFLICT) {
  return createResult; // a real persistence failure — pass it through
}
// ...handle the conflict case
```

Existing constants and their owners:

| Constant             | Owner                                    | Consumers                     |
| -------------------- | ---------------------------------------- | ----------------------------- |
| `CONTRACT_ERRORS`    | `repositories/contractRepository.ts`     | `services/contract.ts`        |
| `LINEUP_ERRORS`      | `services/lineup.ts`                     | `routes/leagues.ts`           |
| `NOTIFICATION_ERRORS`| `repositories/notificationRepository.ts` | `routes/notifications.ts`     |

Rules for new code:

- **Producer owns the constant.** Repository-level errors live in the
  repository *contract* file (so services depend only on the interface
  module); service-level errors live in the service.
- **The wording is then free to change** — it is display text, nothing more.
- **Never re-construct another module's message** to compare against it, and
  never branch on raw driver text (`"UNIQUE constraint failed: ..."`). If you
  need to distinguish a persistence failure, classify it *inside the
  repository* and surface a constant.
- Routes map constants to HTTP statuses explicitly:

  ```ts
  result.error === LINEUP_ERRORS.NO_TEAM ? 404 : 500
  ```

  Do not derive statuses from message content (`/not found/i` on free text
  will misclassify the first unrelated message containing those words).

## 2. Guarded writes: check-and-write in one statement

D1 has no interactive transactions, so a service-side check followed by a
write is a race: another request can change the world between the two
statements. The fix is to evaluate the conditions *inside* the write — one
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
   `CONTRACT_ERRORS.PURCHASE_CONFLICT` — at write time it cannot know which
   condition failed, and it should not guess.
2. The service re-reads and re-runs the *same* rule set to name the cause
   (`ContractService.purchaseRejection`, shared by the pre-check and the
   post-conflict classification, so the two paths cannot drift). If every
   ownership rule passes on the re-read, the credits guard was the one that
   rejected — it is the only other condition in the statement.

When adding a new business invariant to a write (e.g. a per-league roster
rule), extend all three places together:

- the SQL guard in the repository implementation,
- `purchaseRejection` (or the equivalent shared rule helper), and
- an integration test that violates the invariant *at the repository level*,
  bypassing the service pre-checks — that simulates exactly the state a
  concurrent request creates (see `contract.integration.test.ts`,
  `"ContractRepositoryD1.create guarded INSERT"`).

## What to avoid (real examples from this codebase)

These patterns still exist in older code and are queued for cleanup — do not
copy them into new code; migrate them to constants when you touch the area:

- `error.includes("UNIQUE constraint failed: players.username")`
  (`services/login.ts`) — couples login behavior to SQLite's message format.
- Re-building `` `Player with account id ${id} not found` `` in
  `services/login.ts` to detect "new user" — couples it to the repository's
  copywriting in `playerRepositoryD1.ts`.
- `/not found/i.test(error)` to pick 404 vs 400 (`contractErrorStatus` in
  `routes/leagues.ts`) — a D1 outage message containing "not found" becomes a
  client error.
