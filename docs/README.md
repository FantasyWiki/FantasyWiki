---
title: Documentation Index
type: index
tags: [index, map-of-content]
---

# FantasyWiki Documentation

Docs are grouped by **concept**, not by component. Every doc carries YAML
frontmatter (`title`, `type`, `tags`, `related`) so the tree reads as a knowledge
graph — in Obsidian the `related` wikilinks form the edges, and on GitHub the
inline `[text](./path.md)` links stay clickable.

## Map of content

### `domain/` — the model of the system
What the game *is*: rules, entities, and vocabulary. No code structure here.

| Doc | What it answers |
|---|---|
| [Scoring & Economy System](./domain/scoring-system.md) | How points, prices, and settlement work (canonical) |
| [Chemistry Links](./domain/chemistry-links.md) | What a Chemistry Link is and what it scores |
| [Lineup Rules](./domain/lineup-rules.md) | Formation, bench, and the no-contract-is-lost invariant |
| [Article Availability](./domain/article-availability.md) | Free Agent / Owned by Viewer / Owned by Other, and action eligibility |
| [What Are Model Entities](./domain/what-are-model-entities.md) | Why `model/` holds normalized, framework-free entities |
| [Shared DTO Package](./domain/shared-dto-package.md) | Why `dto/` aggregates and nests for the wire |
| [FantaWiki Requirements](./domain/fantawiki-requirements.md) | Original GDD v5.5 — **partly superseded**, see the ADRs |

### `architecture/` — how the code is put together
Seams, layers, and modules. The rules they implement live in `domain/`.

| Doc | What it answers |
|---|---|
| [Backend Architecture](./architecture/backend-architecture.md) | Routes → Services → Repositories layering |
| [Backend Error Constants](./architecture/backend-error-constants.md) | Typed errors instead of string matching |
| [Frontend Query Keys](./architecture/frontend-query-keys.md) | One module owns every TanStack Query key |
| [DTO Dressing Pattern](./architecture/dto-dressing-pattern.md) | How FE/BE each "dress" domain data |
| [Chemistry Links Rendering](./architecture/chemistry-links-rendering.md) | `computeChemistryLinks` + the SVG overlay |
| [Lineup Editing](./architecture/lineup-editing.md) | The `DraftLineup` seam and its pure mutations |
| [Article Ownership Resolution](./architecture/article-ownership-resolution.md) | `buildArticleDetail` + the async team-context seam |
| [Problem Reports](./architecture/problem-reports.md) | How `/report` files a GitHub issue, and what it never publishes |
| [Article Genie LLM Integration](./architecture/article-genie-llm.md) | The Workers AI seam, turn protocol, and quota handling |
| [Wikimedia Client Architecture](./architecture/wikimedia-client-architecture.md) | Composition root and capability modules |
| [Wikimedia Client Behavior Extension](./architecture/wikimedia-client-behavior-extension.md) | How to add a capability |
| [Wikimedia Client Terminology](./architecture/wikimedia-client-terminology-hierarchy.md) | Naming and hierarchy rules |

### `development/` — working on the code
| Doc | What it answers |
|---|---|
| [Local Development Setup](./development/local-dev-setup.md) | Env files, MSW, Wrangler |
| [API Naming Rules](./development/api-naming-rules.md) | URL, identity, and request-body conventions |
| [NPM Script Naming](./development/npm-script-naming.md) | Why `formatfix`, not `format:fix` |

### `deployment/` — shipping it
| Doc | What it answers |
|---|---|
| [Deploy Strategy](./deployment/deploy-strategy.md) | Branch → environment policy |
| [Dev Branch Deployment](./deployment/dev-branch-deployment.md) | What the `dev` QA environment is for |
| [Setup QA Deploy](./deployment/setup-qa-deploy.md) | One-time QA/D1 setup |

### `adr/` — architectural decision records
Numbered, immutable decisions with their reasoning. When an ADR and any other
doc disagree, **the ADR wins**.

[0001 Base Scoring Model](./adr/0001-base-scoring-model.md) ·
[0002 Language Scale Factor](./adr/0002-language-scale-factor.md) ·
[0003 Closed Trading Economy](./adr/0003-closed-trading-economy.md) ·
[0004 Scoring Engine Platform](./adr/0004-scoring-engine-platform.md) ·
[0005 Contract Pricing](./adr/0005-contract-pricing.md) ·
[0006 Article Genie](./adr/0006-article-genie.md)

### `agents/` — machine-read repo metadata
Issue tracker, triage labels, and domain-context layout. Skills read these at
**fixed paths** — do not move or rename them.

## Repo-root documents

These stay at the root because they are entry points, not reference material:

- [`CONTEXT.md`](../CONTEXT.md) — the **canonical domain glossary**. Start here for vocabulary.
- [`PRODUCT.md`](../PRODUCT.md) — product vision and tone.
- [`DESIGN.md`](../DESIGN.md) — brand and UI tone.
- [`CLAUDE.md`](../CLAUDE.md) / [`AGENTS.md`](../AGENTS.md) — agent instructions.

## Conventions

### File naming

**`kebab-case.md`, all lowercase.** No underscores, no capitals, no spaces —
including in acronyms (`shared-dto-package.md`, never `What_are_DTO.md`).

ADRs are the one exception in shape, not in case: they are prefixed with a
zero-padded number, `NNNN-kebab-title.md` (e.g. `0003-closed-trading-economy.md`).

### Frontmatter

Every doc starts with:

```yaml
---
title: Human Readable Title
type: domain | architecture | development | deployment | adr | index
tags: [lowercase, kebab-case]
---
```

Metadata only — **no links here.** GitHub renders frontmatter as an escaped
table, so a link written in it can never be clickable. Links go in the body.

### Linking — one mechanism, both surfaces

**Every link is a relative markdown link in the body**, e.g.
`[Lineup Rules](../domain/lineup-rules.md)`. That single form is clickable on
GitHub *and* counts as a graph edge in Obsidian, so the graph and the rendered
docs can never disagree.

Do **not** use `[[wikilinks]]`, and do not put links in frontmatter — neither
renders as a link on GitHub.

Every doc ends with a **`## Related`** section listing its neighbours. That
section *is* the graph: it is what makes the edges visible to a human reading on
GitHub and to a crawler following links.

Prefer linking over restating. A domain rule is stated **once**, in `domain/`,
and referenced everywhere else.

### Images

Documentation and README media live in **`docs/assets/`** — never in
`frontend/public/`, which ships in the deployed SPA bundle (a demo GIF there
would be served to every player). Name by what it shows:
`formation-chemistry.gif`, `market.png`.

### Where does a new doc go?

Ask what the doc would have to change for: if a **game rule** changed, it is
`domain/`. If a **refactor** changed it, it is `architecture/`. Docs that would
answer "yes" to both should be **split in two and cross-linked** — that is how
chemistry, lineups, and article ownership are handled.
