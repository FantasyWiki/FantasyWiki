---
title: Market List
type: architecture
tags: [market, wikimedia, pageviews, pricing, frontend]
---

# How the Top Read Snapshot becomes the market

The market shelf is a **Top Read Snapshot** — one Wikipedia edition's most-read
articles for one UTC day — filtered to content articles, priced for the league,
and overlaid with who already owns what. The vocabulary is
[`CONTEXT.md`](../../CONTEXT.md); the ownership states are
[Article Availability](../domain/article-availability.md); the price formula is
[ADR 0005](../adr/0005-contract-pricing.md). This doc is the assembly.

## The four steps

```
1. snapshot   /top/<domain>.wikipedia/all-access/Y/M/D   ── walk back a day at a time
2. filter     drop non-content titles, using the edition's own namespace names
3. hydrate    one per-article view series per surviving entry, ≤3 concurrent
4. dress      normalise views by the league's Language Scale Factor, price at MEDIUM
```

Then ownership is merged from the league's contracts, and the shelf is sorted,
searched and paged over in the browser.

## The snapshot is dated, and the date is not always yesterday

Wikimedia publishes a day's top-read list some hours after that day ends, so
`getTopReadList` starts at yesterday and **walks backwards up to
`maxFallbackDays`**, taking the first day that answers. The date it settled on
comes back with the list (`snapshotDate`) rather than being assumed by the
caller — a market is always *some* day's reading, and which day it is has to be
knowable.

The whole assembled list is cached under a key naming the domain, that snapshot
date and the limit. A new day invalidates it by having a different key; nothing
expires anything.

## The namespace fetch is outside the cache, and that is the point

An edition's most-read titles include its own project pages — `it.wikipedia` puts
`Pagina_principale` at rank 1. Filtering them needs the edition's **own**
namespace names, so the client fetches `siteinfo` first and passes the prefixes
into the filter.

That fetch sits deliberately *outside* the cached region, because the cache key
names the snapshot and the limit — not the filter. A list assembled with the
English fallback rules after one transient `siteinfo` failure would otherwise be
served, main page and all, for the rest of the day. So a failed namespace fetch
degrades rather than empties (a market with the main page in it beats no market),
and the result of that run is **not written to the cache**.

Filtering renumbers. Each surviving entry keeps its **Source Rank** — where it
sat in Wikimedia's list — and gains a **Filtered Rank**, its position in the
market. Both travel, because the second is what the player sees and the first is
what makes the list checkable against Wikimedia.

## Hydration is progressive, and pending is visible

The top-read payload alone already carries every entry's title, rank and that
day's views. The **Range Average** the price is computed from — the mean daily
pageviews over a 30-day window in the same Project Domain — is one request per
article, capped at the client's shared concurrency limit rather
than fanned out fifty at once.

A caller may pass `onPartial` and be handed the list as it fills: once from the
snapshot alone, then after each article's series lands. **An entry with no
`averageViews30d` is not an entry worth zero** — the absence is how a consumer
tells a pending row from a resolved one, and the frontend flags exactly those
rows `pending` so no placeholder figure is read as a measurement. Only the fully
hydrated list is returned, and only it reaches the cache.

In the browser each partial is written straight into the TanStack Query cache
under the market key, which is what makes the table appear after one request and
fill in place instead of after fifty.

## The shelf is assembled in the browser, not on the Worker

The Worker serves no market. It once did — `GET /api/leagues/{id}/market` built
the same shelf server-side — and that endpoint was removed once it was found to
have no caller. A second implementation of a fifty-row shelf, reachable and
gated but never called, is a second thing to keep correct for nothing.

The browser is where it belongs for the same reason the Article Genie keeps its
Wikimedia calls there: the shelf costs one request per row, the Workers Free
plan allows **50 subrequests and 10 ms CPU per invocation**, and the browser has
neither limit *and* already holds the cache the next page view will hit.

What the backend still owns is the part that is not the list: the contracts a
purchase writes, and the ownership the shelf is annotated with.

The browser prices every row through `model/pricing.ts` at `TIER_DAYS.MEDIUM`,
using **the league's frozen Language Scale Factor** — the market grid is where a
player reads a price before buying, so it has to be the number the purchase will
use ([ADR 0002](../adr/0002-language-scale-factor.md)).

Ownership is merged rather than filtered: an owned article **stays on the shelf**
with its Owner Team named, because seeing who took it is half of what the market
is for. The two queries never block each other — the table renders when the
article list resolves, and the owner badges upgrade when the contracts land.

Matching is by canonical title folded to a common key, not by id: a market row's
id is Wikimedia's underscored `canonicalTitle` while a contract carries the same
title in both `article.id` and `article.title`, and `normKey` folds spaces,
underscores and case together so the two sources meet. An article's identity is
its canonical title within the league's domain, which is what makes matching on
the title sound rather than a shortcut.

## Beyond the fifty

Two things reach past the snapshot, both priced at the same MEDIUM tier so every
row on screen stays comparable:

- **Search** (`searchMarket`) — any article in the edition, through the client's
  search capability.
- **Owned-article hydration** (`fetchMarketArticlesByTitle`) — an owned article
  can sit anywhere in the domain, not just in the top fifty, and a team's own
  holdings must still appear on the shelf. A failed or empty fetch here yields
  all-undefined fields rather than throwing, so the row falls back to its stored
  price instead of being priced at zero.

## Where each piece lives

| concern | code |
| --- | --- |
| snapshot, fallback walk, cache | `external-apis/wikimedia/client/getTopReadList.ts` |
| content filter, Source/Filtered Rank | `normalizeTopReadEntries` in `external-apis/wikimedia/wikimedia.ts` |
| the edition's namespace names | `external-apis/wikimedia/client/getSiteNamespaces.ts` |
| per-article view series | `external-apis/wikimedia/client/articleViews.ts` |
| price of a row | `model/pricing.ts` |
| assembling and pricing the shelf | `frontend/src/services/marketService.ts` |
| ownership merge, sort, filter, paging | `frontend/src/composables/useMarket.ts` |

## Related

- [Article Availability](../domain/article-availability.md) — the three ownership states
- [Article Ownership Resolution](./article-ownership-resolution.md) — the same question, one article at a time
- [Wikimedia Client Architecture](./wikimedia-client-architecture.md) — the client both runtimes share
- [Wikipedia Language Editions](../domain/language-editions.md) — the factor a shelf is priced at
- [ADR 0005: Contract Pricing](../adr/0005-contract-pricing.md) — what a price is
- [Article Genie LLM Integration](./article-genie-llm.md) — the other way into the shelf
