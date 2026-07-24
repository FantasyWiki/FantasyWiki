---
title: Article Genie LLM Integration
type: architecture
tags: [llm, workers-ai, cloudflare, seam, testing, quota]
---

# Article Genie LLM Integration

How the **Article Genie** talks to a language model: the seam, the turn protocol, the prompt
contract, and what happens when the daily quota runs out. The *decision* behind this feature —
and the alternatives rejected — lives in [ADR 0006](../adr/0006-article-genie.md); this document
describes the mechanism.

## Scope: the Worker does exactly one thing

Everything except the model call already runs in the browser. `frontend/src/services/marketService.ts`
calls the Wikimedia Client directly and prices with `computeContractPrice` client-side, and
`useTeamLineup` already fetches link sets through the client's 7-day cache. The Genie inherits
all of it.

```
BROWSER  (useGenie composable)
  seed    S1 = search("linksto:A linksto:B" | keywords), title + description, cap ~40
          S2 = outbound(A) ∩ outbound(B)          — from the cached link sets
          merge + dedupe, rank by (mutual links desc, price asc)
  loop    POST /api/me/genie-turns { history, candidates, bucket }
          ← { utterance, keep: [ids], done }
  finish  survivors → existing market search path → priced rows

WORKER   (one route)
  env.AI.run("@cf/mistralai/mistral-small-3.1-24b-instruct", { messages })
  one subrequest · no D1 · no migration
```

The model id and the ~40 cap are not arbitrary — both were fixed by live testing; see
[ADR 0006 → Provider and model](../adr/0006-article-genie.md). The 8B model that a cost-first
reading would pick **cannot hold the loop** (it loses the correct answer ~1 session in 3); 24B
survives 40/40 at ~77 neurons.

Keeping the Wikimedia calls in the browser is deliberate: the Workers **Free** plan allows
**50 subrequests** and **10 ms CPU** per invocation, and the browser has neither limit *and*
already holds the cache.

## The `llmClient` seam

The AI binding is wrapped in a service under `backend/src/services/`, alongside `wikimediaClient`
and `githubClient`, and is **constructor-injected** — matching
`ArticleMarketService(db, wikimedia?, leagueRepo?)`:

```ts
export class ArticleGenieService {
  constructor(private readonly llm: LlmClient = createLlmClient()) {}
}
```

Injection is not stylistic here. Under `@cloudflare/vitest-pool-workers`, **`vi.mock` silently
no-ops** — a mocked module resolves to the real one without an error, so a test that appears to
stub the model would quietly spend real neurons and assert against real output. The constructor
parameter is the only reliable substitution point.

`LlmClient` exposes one method so the provider stays swappable:

```ts
type LlmClient = { ask(messages: Message[]): Promise<string> };
```

## Turn protocol

`POST /api/me/genie-turns` — self-scoped, identity from the JWT, no `playerId` from the client
(see [API Naming Rules](../development/api-naming-rules.md)).

**Request**

| Field | Notes |
|---|---|
| `query` | opening free text, first turn only; clamped to ~200 chars |
| `history` | prior `{question, answer}` pairs — **questions only, never the flavour text** |
| `candidates` | `{id, title, description}[]`, ids are small integers assigned by the client. **The description is mandatory** — see *Descriptions carry recency* |
| `bucket` | a word, not a number — see *Progress without numbers* |

**Response**

| Field | Notes |
|---|---|
| `utterance` | one sentence: flavour plus the next question |
| `keep` | numeric ids that survive; **numbers, not titles** |
| `done` | model signals it is confident enough to stop |

The session is **stateless** — the client carries the history. This is safe because resetting the
history is equivalent to starting a new game, which is already free; the abuse control is the
rate limiter, not the protocol.

**Numeric ids are load-bearing for cost.** Output tokens cost far more than input, and the
survivor list is returned every turn. Returning ids (~2 tokens each) rather than full titles
(~6 tokens) roughly halves session cost — the difference between the chosen design and one that
echoes titles back.

## Descriptions carry recency

The candidate listing sent to the model **must** include each article's one-line description, not
just its title. The game trades on trending articles, which are mostly newer than the model's
training cutoff — it cannot know a 2026 prime minister or a last-season footballer by name. It does
not need to: it classifies from the description. Measured on the real current top-read set, single
turn "is it a person?": with descriptions the model keeps 100% of the people and drops 100% of the
non-people; **titles only drops to 84.6% recall**, silently losing people it has never heard of. A
five-turn interrogation toward a post-cutoff target (a 2007-born footballer) survived 5/5 with
descriptions, including a "born after 2000?" question answered by reading "born 2007" from the
description. Consequently, interrogation questions must be answerable from title + description
(person / nation / woman / sport / century), not from world knowledge the model may lack.

## The two question kinds

The model may ask either kind, and the distinction is a safety boundary:

| Kind | Example | Effect | Can lose the answer? |
|---|---|---|---|
| **Filter** | *"Is it a person?"* | partitions the list | **Yes** — see Risks |
| **Preference** | *"Something niche, or something famous?"* | re-ranks only, drops nothing | No |

Preference questions are strictly safe and map directly onto the price axis players care about,
so the prompt should favour them once the list is already small.

## Adaptive stop

Turns scale with the candidate count. The loop stops when **survivors ≤ 5**, when the model sets
`done`, or at the soft cap of 10 turns (with one optional "+5" extension).

| Seeded candidates | Expected questions |
|---|---|
| ~17 (anchored, narrow) | ~2 |
| ~40 (recall query, at the cap) | ~4–5 |

Showing five results is a fine outcome; the loop is not required to reach exactly one. A single
result is shown only when the model is confident. The recall seed is capped at ~40 because the
search API puts the intended article in roughly the top three, so 40 reliably contains it while
keeping per-turn cost and the model's attention load low.

## Progress without numbers

The player must never see a raw candidate count — it reads as debug output and breaks character.
The frontend maps the exact count to a **bucket word** (`vast`, `many`, `a dozen or so`,
`a handful`, `almost there`) and passes only that word into the prompt; the model weaves it into
its utterance:

> *"Mhh, interesting — I'm down to a handful. Did she work on spaceflight?"*

The model therefore never sees a number and cannot contradict one. The flavour is **display-only**:
it is not written back into `history`, so it never re-enters the input on later turns.

## Quota exhaustion — "the genie is asleep"

On the **Workers Free** plan the 10,000 neurons/day allocation is a hard ceiling and further calls
fail. There is no counter to maintain and no way to be billed:

```ts
try {
  return await this.llm.ask(messages);
} catch {
  return failure(GENIE_ASLEEP);
}
```

Any model failure — quota, transport, or an unparseable response after one retry — maps to the
same player-facing state: a brief popup saying the genie is asleep, and the panel dismisses to the
ordinary search bar. The feature is purely additive, so degrading it never blocks buying an
article.

### Neuron budget

Measured on the chosen 24B model (5-turn interrogation, candidate list capped at ~40):

| Scenario | neurons/session | sessions/day |
|---|---|---|
| Recall, ~40 candidates, ~5 turns (24B) | ~77 | ~130 |
| Same on 8B — but 8B loses the answer 1/3 of the time | ~22 | ~450 |
| Same on 70B — works, but no better than 24B | ~102 | ~98 |

If budget ever needs reclaiming, tighten the candidate cap or the extension, or drop a Gemini
fallback in behind the seam. The flavour narration is a small fraction of a session and is not
worth cutting.

## Input safety

The opening `query` is the **only** free-text field that reaches the prompt; every later answer is
a tap. That keeps the injection surface to one clamped field.

- Clamp `query` to ~200 chars, and the candidate list to ~40 entries (also the design cap).
- **Reject oversized payloads, do not truncate** — silent truncation hides a client bug and makes
  the model's answer depend on invisible state.
- Constrain the model to return ids drawn only from the supplied list; discard any id that is not
  in it rather than trusting the response.
- Rate-limit per player with an `unsafe` ratelimit binding, following the `REPORT_RATE_LIMITER`
  pattern already in `wrangler.jsonc`. **Size it against a real session, not just abuse:** a
  session fires several requests within a minute, so a tight per-minute cap throttles legitimate
  play.

## Risks

- **Classification error is the real failure mode**, not hallucination. A filter question the
  model answers wrongly deletes the right article from the survivor set, and the Genie cannot
  recover. This is the single reason the 24B model is mandated over 8B (see the diagram note).
  Further mitigations: allow an *unsure* bucket that is never dropped; if survivors reach zero,
  restore the previous turn's list and tell the model it went wrong; prefer preference questions
  once the list is small.
- **Multi-word anchors must be underscored or quoted.** `linksto:Formula One` silently parses as
  `linksto:Formula` plus free text and returns unrelated results; `linksto:Formula_One` is
  correct. Enforce in the prompt *and* defensively in code.
- **Redirect titles.** `prop=links` returns targets as written (`"ArXiv (identifier)"`), so link
  data must be resolved to canonical titles before matching against article titles.

## Testing

- **Backend** — inject a stub `LlmClient`; never rely on `vi.mock` under the Workers pool.
  Cover: valid JSON, malformed JSON then a successful retry, malformed twice → asleep, ids outside
  the candidate list discarded, oversized payload rejected.
- **Frontend** — MSW with `onUnhandledRequest: "error"`, per `frontend/src/tests/setup.ts`.
  Cover: seeding merge and dedupe, ranking order, the asleep popup, and dismissal to the search
  bar.
- **Model fidelity — already validated against the live binding** (the load-bearing assumption
  behind the whole loop). A scripted 5-turn interrogation over ~40 real candidates, feeding the
  model's own surviving subset forward each turn, keeps the planted correct answer 40/40 on 24B and
  loses it ~1/3 of the time on 8B; recency holds when descriptions are included (see *Descriptions
  carry recency*). Re-run this probe whenever the model id or the prompt changes — it is the
  cheapest guard against a regression that would silently start deleting correct answers.

## Related

- [ADR 0006: Article Genie](../adr/0006-article-genie.md)
- [Backend Architecture](./backend-architecture.md)
- [Wikimedia Client Behavior Extension](./wikimedia-client-behavior-extension.md)
- [Chemistry Links Rendering](./chemistry-links-rendering.md)
- [API Naming Rules](../development/api-naming-rules.md)
- [Local Development Setup](../development/local-dev-setup.md)
