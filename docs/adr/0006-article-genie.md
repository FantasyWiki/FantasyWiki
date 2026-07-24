---
title: "ADR 0006: Article Genie"
type: adr
tags: [llm, market, discovery, chemistry, cloudflare, decision]
---

# Article Genie: narrowing a bounded candidate list, not generating guesses

> **Status:** decided in design discussion and validated against live Workers AI + the Wikimedia
> API; not yet implemented in code. Supersedes the flow described in issue #252, which is rewritten
> to match this ADR.

The **Article Genie** is the LLM-assisted discovery feature on the market page. This ADR records
what it is, the two player intents it serves, and — most importantly — the alternatives that were
tried and rejected with measurements rather than argument. The measurements are real: the model,
the narrowing loop, the seeding queries, and the trending-article case were all probed live before
this decision was locked (see *Provider and model*).

## Decision

The Genie **never invents an article title.** It seeds a bounded list of *real* Wikipedia titles
from the search API, then uses the LLM only to **narrow that list** through Akinator-style
questions. Title hallucination is impossible by construction, so no verification step is needed.

It serves two player intents through **one input box and one pipeline**:

| Intent | Example | Seeded by |
|---|---|---|
| **Chemistry scouting** | *"find me a relation between OpenAI and Portugal"* | `linksto:` search + outbound-link intersection |
| **Tip-of-the-tongue recall** | *"the female mathematician who worked at NASA"* | plain keyword search |

Both searches always run and their results are merged — see *Union seeding* below.

## Why narrowing beats generating

The original design (issue #252) had the LLM guess an article from world knowledge and verify the
guesses afterwards. Narrowing a real list is better on every axis:

| | Free-world generation | Bounded narrowing (chosen) |
|---|---|---|
| Invalid titles | possible; needs a verification pass | impossible by construction |
| Question quality | guesses about the world | derived from the actual surviving titles |
| Cost per session | context grows every turn | ~77 neurons (list **shrinks** each turn) |
| Chemistry data | unavailable | exact, from real link sets |

The cost point is non-obvious: because the candidate list shrinks with every answer, context
*shrinks* as the session runs, so the more accurate design is also the cheaper one. The ~77-neuron
figure is measured on the chosen 24B model with the list capped at ~40 (see *Model choice*).

## Union seeding, not routing

The parse call always emits a keyword query, and *additionally* emits anchors when it finds them.
**Both searches run; results are merged and deduped. There is no routing decision.**

Routing to a single mode was rejected because a misparse is silent and unrecoverable: *"the
Portuguese explorer who reached India"* misread as an anchor query would drop Vasco da Gama from
the candidate list entirely, and the player would see only a Genie that failed. With union
seeding a misparse can only *add* surplus candidates — which the narrowing loop already exists to
strip.

## Both link directions are candidates

A **Chemistry Link** is GOOD when a link exists in *either* direction (see
[Chemistry Links](../domain/chemistry-links.md)), so the candidate space for anchors A and B is
`(linksto:A ∪ outbound(A)) ∩ (linksto:B ∪ outbound(B))`. In practice two cheap sets:

- **S1** — `linksto:A linksto:B`, one search call, ≤100 results
- **S2** — `outbound(A) ∩ outbound(B)`, from link sets the client already caches

**Outbound-only intersection was tried first and is insufficient alone.** Measured on the
flagship query, `outbound(Portugal) ∩ outbound(OpenAI)` returns 9 items, 7 of which are
citation-identifier redirects (ArXiv, Bibcode, Doi, ISSN, OCLC, PMID) plus Austria and
Switzerland — nothing a player would want. The interesting relations run the other way: articles
that link *to* both anchors. CirrusSearch's `linksto:` operator [1] supplies exactly that in a
single call, and the REST endpoint the Wikimedia Client already uses accepts it (verified
identical to the Action API).

**S2 is retained anyway, and must not be filtered out.** Those cheap, low-traffic articles are
strategically valuable: they cost almost nothing and still carry chemistry. Discarding them as
"boilerplate" would remove the most efficient plays in the game.

## Rank, never filter

No interestingness heuristic, no dropping of years, lists, or hub articles. Candidates are
ordered by **(mutual links desc, price asc)** and let to compete. Measured for Portugal/OpenAI:

| Article | vs Portugal | vs OpenAI | avg views/day |
|---|---|---|---|
| Google | GOOD | **EXCELLENT** | 24,501 |
| Albania | **EXCELLENT** | GOOD | 6,693 |
| International Mathematical Olympiad | GOOD | **EXCELLENT** | 492 |
| **Artificial intelligence arms race** | GOOD | **EXCELLENT** | **126** |

*Artificial intelligence arms race* carries the same chemistry as *Google* at 1/200th the
traffic — and therefore a small fraction of the [Contract Price](../domain/scoring-system.md).
Ranking surfaces it without any hand-tuned notion of "interesting".

Note that **no candidate achieves EXCELLENT with both anchors.** Mutual links with two unrelated
articles is essentially unachievable, so one mutual link plus a low price is the realistic
optimum, and the UI should not promise otherwise.

## Provider and model: Workers AI on the Free plan

| Option | Verdict |
|---|---|
| **Cloudflare Workers AI** | **Chosen.** Native binding, no API keys, no CI/preview secrets, first-party free tier |
| Workers AI + Groq/Gemini fallback | Rejected — doubles capacity but adds secrets to two environments and a second set of rate-limit semantics |
| `freellmapi` self-hosted proxy | Rejected — a separate service to host, up to 28 upstream accounts to hold, and its own README scopes it to "personal experimentation only" |

On the **Workers Free** plan the 10,000 neurons/day allocation is a hard ceiling: further calls
fail with an error [2][3]. That is a feature, not a limitation — it makes overspend structurally
impossible and turns quota exhaustion into a single `catch`, surfaced to the player as *"the genie
is asleep"*. On Workers Paid the same allocation would silently bill at $0.011/1,000 neurons, so
the Free plan is the safer host for this feature.

### Model choice — measured, not assumed

Model: **`@cf/mistralai/mistral-small-3.1-24b-instruct`**, with the candidate list capped at ~40.
This was chosen by running the actual multi-turn interrogation against three model sizes on the
live binding (5 scripted questions, each true of a planted target, feeding the model's own
surviving subset forward each turn, tracking whether the correct answer survives every turn):

| Model | Correct answer survived all 5 turns | neurons/session | sessions/day (free 10k) |
|---|---|---|---|
| `llama-3.1-8b-instruct-fp8-fast` | 2/3 — **loses the answer** | ~22 | ~450 |
| **`mistral-small-3.1-24b-instruct`** | **40/40** | **~77** | **~130** |
| `llama-3.3-70b-instruct-fp8-fast` | 8/8 | ~102 | ~98 |

The 8B model — the obvious "cheap" pick — cannot hold the loop: per-turn recall of ~92% compounds
to losing the correct article in roughly a third of sessions over five turns. 24B is both more
reliable *and* cheaper than 70B, so it is the sweet spot; there is no reason to pay for 70B. JSON
output is reliable by prompting alone (Workers AI pre-parses the response when the content is pure
JSON), so JSON-mode-capable models — which cost 3.3x more input for a guarantee Cloudflare declines
to make [4] — are not needed. Gemini's free tier was considered as a stronger host but rejected for
now: it reintroduces an API key as a secret in production *and* preview/CI and a second provider's
rate-limit semantics. The `llmClient` seam (see the architecture doc) leaves it as a drop-in future
fallback.

### Descriptions are mandatory — this is what makes the game's trending articles work

The game trades on Wikipedia top-read, which is dominated by articles that **postdate the model's
training cutoff** (a 2026 prime minister, a 2026 film, a footballer who debuted last season). The
model cannot know them. It does not need to: each candidate carries the **one-line description the
search API returns**, and the model classifies from that. Measured on the *actual* current
top-read set:

| single-turn "is it a person?" over unknowable 2026 articles | correct people kept | non-people dropped |
|---|---|---|
| titles only | 84.6% | 100% |
| **with the live description** | **100%** | **100%** |

So descriptions are a hard requirement in the candidate listing (titles-only loses ~15% of people
the model has never heard of), and interrogation questions must be answerable from
title + description (person / nation / woman / sport / century), not from deep world knowledge.

## Consequences

- **The Genie is additive.** Its output is a title handed to the existing market search path, so
  pricing, ownership badges, and the buy flow are untouched.
- **One new route, no schema change.** `POST /api/me/genie-turns` calls the AI binding and nothing
  else — one subrequest, no D1, no migration. All Wikimedia work stays in the browser, where the
  client's 7-day cache lives and neither the 50-subrequest nor the 10 ms CPU limit applies [3].
- **Classification error replaces hallucination as the failure mode.** The model wrongly deciding
  a surviving title does not match an answer silently deletes the right article. This is why model
  choice was settled empirically rather than by cost: 8B fails here, 24B does not. Further
  mitigations are specified in [Article Genie LLM Integration](../architecture/article-genie-llm.md).
- **Capacity is bounded and modest** — ~130 sessions/day across all players on the free tier
  (~77 neurons each). Ample at friends-scale; the "genie is asleep" popup absorbs any overflow,
  and Gemini behind the `llmClient` seam is the escape hatch if a larger player base ever needs it.
- **Surfaced an existing bug.** Link lists contain redirect titles (`"ArXiv (identifier)"`) while
  `chemistryKey` matches canonical ones, so pairs linked through a redirect score WEAK instead of
  GOOD today. Tracked separately from this ADR.

## Sources

1. MediaWiki — CirrusSearch `linksto:` and other search keywords: https://www.mediawiki.org/wiki/Help:CirrusSearch
2. Cloudflare Workers AI — Pricing and free allocation: https://developers.cloudflare.com/workers-ai/platform/pricing/
3. Cloudflare Workers — Limits (subrequests, CPU, per plan): https://developers.cloudflare.com/workers/platform/limits/
4. Cloudflare Workers AI — JSON Mode: https://developers.cloudflare.com/workers-ai/features/json-mode/

## Related

- [Article Genie LLM Integration](../architecture/article-genie-llm.md)
- [Chemistry Links](../domain/chemistry-links.md)
- [Scoring & Economy System](../domain/scoring-system.md)
- [Wikimedia Client Behavior Extension](../architecture/wikimedia-client-behavior-extension.md)
- [API Naming Rules](../development/api-naming-rules.md)
