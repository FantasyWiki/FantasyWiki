---
title: Article Availability
type: domain
tags: [articles, ownership, contracts, market]
---

# Article Availability (domain)

The ownership status of an article when its detail is shown, and what a viewer
may do about it. The glossary entries are canonical in
[`CONTEXT.md`](../../CONTEXT.md). For the code that resolves this at runtime, see
[Article Ownership Resolution](../architecture/article-ownership-resolution.md).

## The three states

**Article Availability** is an explicit three-state value — deliberately not a
generic "unavailable" boolean:

| State | Meaning |
|---|---|
| **Free Agent** | No team currently holds a contract on the article |
| **Owned by Viewer** | Held by the viewer's own team |
| **Owned by Other Team** | Held by another team in the league |

## Owner Team

The **Owner Team** is the team holding a non-free article. It **exists only when
availability is not Free Agent**, and it is always shown in that case.

## Viewer Team Context

The **Viewer Team Context** is the team id representing the authenticated
player's active team in the selected league.

Ownership is decided by **comparing team ids** — `Owner Team` against
`Viewer Team Context`. It is never decided by player id or session subject id:
both concepts are team-level, and a player may hold a different team per league.

## Action eligibility

Which actions the viewer is offered follows from availability plus the viewer's
credits:

- **Buy** — eligibility depends on **Article Availability** and viewer credits.
  A Free Agent the viewer cannot afford is shown but not enabled.
- **Renew** — only meaningful when the article is **Owned by Viewer**.
- **Swap** — only meaningful when the article is **Owned by Viewer**.

Availability is resolved per viewer: the same article is `Owned by Viewer` for
one player and `Owned by Other Team` for their opponent, from the same contract.

## Related

- [Article Ownership Resolution](../architecture/article-ownership-resolution.md)
- [Scoring & Economy System](./scoring-system.md)
