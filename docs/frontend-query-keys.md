# Frontend: TanStack Query keys

All TanStack Query keys are defined in **one module**:
`frontend/src/composables/queryKeys.ts`. Never write a query key as an inline
array literal.

## Why

A query key is a contract between two distant call sites:

- the **composable that owns the query** (`useQuery({ queryKey: ... })`), and
- every **mutation that invalidates it** (`queryClient.invalidateQueries(...)`).

When both sides spell the key as a literal (`["team-lineup", leagueId]`), the
compiler cannot tell them apart from any other array. Rename or re-scope the
key on one side and the other side keeps "working" — it just matches nothing.
The result is the worst kind of bug: no error anywhere, the cache silently
serves stale data. (This actually shipped once: the market page invalidated a
set of hand-copied literals after a purchase, and the credits pill kept the
pre-purchase balance.)

With a single factory, a key's shape has exactly one definition. Changing it
is one edit, and *Find usages* on the factory function lists every reader and
invalidator.

## Using an existing key

```ts
import { queryKeys } from "@/composables/queryKeys";

// Owning a query (inside a composable):
const { data } = useQuery({
  queryKey: computed(() => queryKeys.teamLineup(leagueStore.currentLeagueId)),
  queryFn: () => fetchTeam(leagueStore.currentLeagueId!),
  enabled: computed(() => !!leagueStore.currentLeagueId),
});

// Invalidating after a mutation (inside a view or composable):
await queryClient.invalidateQueries({
  queryKey: queryKeys.teamLineup(league.id),
});
```

Wrap the key in `computed(...)` when any argument is reactive (league
switches, search text): TanStack Query re-fetches automatically when a
computed key changes — that is the mechanism that replaces manual "refetch on
league change" code.

## Adding a new key

1. Add a factory function to `queryKeys.ts`. Scope the key with every
   parameter the response depends on (usually `leagueId`, sometimes `domain`
   or a search term):

   ```ts
   myPerformances: (leagueId: string | null) =>
     ["my-performances", leagueId] as const,
   ```

2. Use it in the owning composable **and** in every mutation that changes the
   underlying data.
3. Do not export the string from anywhere else, and do not re-declare it in a
   test — import the factory.

## Mutation checklist

When you add a mutation (buy, sell, renew, save lineup, ...), list every
cached view whose data it changes and invalidate each one. For contract
mutations the market page already centralizes this in
`refreshContractViews()` (`MarketPage.vue`) — extend that helper instead of
building a second list. Today a contract mutation touches:

- `queryKeys.leagueContracts(leagueId)` — ownership badges in the market
- `queryKeys.teamLineup(leagueId)` — bench / formation
- `queryKeys.dashboard(leagueId)` — credits, portfolio KPIs
- `queryKeys.myTeam(leagueId)` — the player's team and balance pill

## Server state does not live in Pinia

`useMyTeam()` (`frontend/src/composables/useMyTeam.ts`) is the reference
example: the player's team (id, credits) is remote data, so it is a query —
not a store ref that must be manually re-fetched after every mutation. Pinia
stores hold only shared UI state (selected league, league list; see the
docstring in `stores/league.ts`). If you find yourself writing
`store.fetchX()` after a mutation, the data belongs in a query instead.

## Testing

Component/composable tests that only need "a team exists / is loading /
errored" should mock the query composable with mutable state (see
`useArticleOwnership.spec.ts`, `MarketPage.spec.ts`) rather than fetching
through MSW — the states become deterministic and each test controls them
directly. When a test genuinely exercises the query plumbing, seed the cache
with `queryClient.setQueryData(queryKeys.myTeam(leagueId), team)` and keep
the MSW handler as the refetch target.
