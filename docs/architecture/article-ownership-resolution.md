---
title: Article Ownership Resolution
type: architecture
tags: [articles, ownership, frontend, composables]
---

# Article Ownership Resolution (architecture)

How the Article Detail view resolves an article's **Article Availability** at
runtime. The **rules** — the three states, what Owner Team means, which actions
each state permits — live in
[Article Availability (domain)](../domain/article-availability.md).

## The two layers

Resolving ownership has a synchronous part and an asynchronous part, kept
separate:

1. **Pure model — `buildArticleDetail` (`frontend/src/types/articleDetail.ts`).**
   Given the contract plus the **Viewer Team Context** (viewer team id and
   credits), it derives **Article Availability** (`free-agent`,
   `owned-by-viewer`, `owned-by-other`), the **Owner Team** name when not a free
   agent, and which actions are shown/enabled (buy / renew / swap). It assumes
   the viewer's team context is already known.

2. **Async seam — `useArticleOwnership`
   (`frontend/src/composables/useArticleOwnership.ts`).**
   The **Viewer Team Context** loads asynchronously through the league store
   (`currentTeam`, `isTeamLoading`, `teamError`). This composable owns that
   "wait for team context" state machine and only calls `buildArticleDetail` once
   the context is `ready`.

Splitting them this way keeps the branchy eligibility logic pure and testable
while isolating the loading/error states in one place.

## The composable interface

`useArticleOwnership(selectedContract: Ref<ContractDTO | null>)` returns:

- `status: "loading" | "ready" | "error"` — `loading` while the team context is
  fetching or absent, `error` when the fetch failed, `ready` otherwise.
- `detail: ArticleDetail | null` — the built model, `null` until `ready`.
- `retry()` — re-runs `leagueStore.fetchCurrentTeamContext()` after an error.

`ArticleDetail.vue` consumes the composable and is pure presentation: it shows a
loading/error placeholder (with a retry button) until `status` is `ready`, then
renders `ArticleActions` from `detail`. The logic is unit-tested without mounting
Vue in `frontend/src/tests/articleDetail/useArticleOwnership.spec.ts`.

## Related documentation

- [Article Availability (domain)](../domain/article-availability.md) — the states
  and action eligibility rules.
