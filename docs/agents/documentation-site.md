---
title: Documentation Site
type: agents
tags: [documentation, vitepress, github-pages, conventions]
---

# Documentation site

The published technical documentation lives at
<https://fantasywiki.github.io/FantasyWiki/> and is built from this repository
by `docs/site/`. This file is the working agreement for keeping it current.

Read it before adding a page, before writing a diagram, and before deciding that
something new belongs on the site rather than in `docs/`.

## The two tiers, and how to choose

| Tier | Lives in | Is | Holds |
|---|---|---|---|
| **Canonical** | `docs/**` and the repo-root charter files | Mirrored to the site verbatim on every build | Rules, decisions, conventions |
| **Authored** | `docs/site/pages/**` | Site-only; never mirrored back | Orientation, diagrams, cross-cutting views |
| **Unpublished** | `docs/agents/**` — these files | Canonical, never mirrored; links to it become GitHub URLs | Machine-read metadata |

**These files are not on the site.** They are loaded by tooling from fixed
paths, and a published page describing a triage label taxonomy is of no use to
anyone browsing. The exclusion is one list, `UNPUBLISHED` in
`docs/site/scripts/prepare.mjs`, and it drives both halves: the walk that builds
the mirror skips it, and the link rewrite sends anything pointing into it to
GitHub instead. Adding a directory to that list means also deleting its entry
from `SECTIONS` in the same file, or the sidebar keeps a heading with nothing
under it.

**The rule that decides it:** if the text would still be needed by someone
reading the repository with no browser, it is canonical and belongs in `docs/`.
If it only makes sense as part of a guided tour — a container diagram, a page
that walks five flows end to end — it is authored.

**A domain rule is stated once**, in `docs/domain/`, and linked to from
everywhere else. This is not a style preference; it is what stops the site and
the repository from drifting into two different specifications. If you find
yourself explaining Chemistry Links on an authored page, stop: replace the
paragraph with a diagram and a link down to
[Chemistry Links](../domain/chemistry-links.md).

**The site describes itself in exactly one place.** That place is
`pages/about-this-site.md`: the mirror, the two tiers, how the Atlas and the
coverage board are derived, and how the publish works. A reader arriving at the
landing page came for FantasyWiki, not for the documentation pipeline, and a
technical reference that keeps explaining its own build reads as a demo of
itself. If you find yourself writing "this site" on any other page, write a link
instead.

The landing page is the strictest case. It carries the Atlas, the coverage
board and the reference shelf, **in that order** — the two things a folder of
markdown cannot do come first, because they are what makes the site worth
visiting rather than cloning — and **no prose about the documentation as an
artefact**. The Atlas legend is the one exception, because a chart needs a key.

It carries no architecture either: the container diagram belongs on
[what FantasyWiki is](https://fantasywiki.github.io/FantasyWiki/overview/what-is-fantasywiki.html),
next to the rest of the orientation, not on a page a reader has not yet decided
to read.

Where a new *canonical* doc goes is decided in
[the documentation index](../README.md): ask what would have to change for the
doc to be wrong — a game rule (`domain/`), a refactor (`architecture/`), a tool
(`development/`), an environment (`deployment/`), or nothing at all (`adr/`).

## When a feature lands

Work through this list. Most items are already automatic; the ones that are not
are marked.

1. **Write or update the canonical doc** under `docs/`, in the section its
   subject belongs to. Add a `## Related` section, or extend the existing one.
2. **Link it from its neighbours.** An edge written from only one end is half an
   edge. The [Atlas](https://fantasywiki.github.io/FantasyWiki/#the-docs-atlas)
   shows a doc nothing points at as an unconnected dot — that is the check.
3. **Add the row to [`docs/README.md`](../README.md)** — the map-of-content
   table for its section. *Manual.*
4. **Update the authored page the feature touches**, if any: a new container or
   seam belongs on `architecture/index.md`, a new deployable piece also on
   `overview/what-is-fantasywiki.md`, a new journey on
   `architecture/data-flow.md`, a new table on `architecture/data-model.md`, a
   new workflow on `quality/ci-cd.md`, and anything about the site's own
   machinery on `about-this-site.md`. Usually one diagram, not new prose.
5. **Add a sidebar entry** only if the feature introduced a new *authored* page —
   the canonical tier's navigation is derived. `docs/site/.vitepress/config.mts`.
   *Manual, and only for authored pages.*
6. **Describe the endpoint in `backend/openapi.yaml`** if the feature added or
   changed a route. Not optional and not a documentation chore — the backend
   suite fails until it is written, in both directions. See
   [OpenAPI Spec](./openapi-spec.md). *Manual.*
7. **Run the build.** `cd docs/site && npm run build`. Two checks gate it: dead
   links, which catch any internal link the mirror could not resolve, and the
   diagram gate, which **renders** every mermaid block headlessly. It renders
   rather than parses on purpose — a diagram can satisfy the grammar and still
   fail while being laid out, and that failure is invisible until it is a grey
   box on the published page.

What you never have to touch: the Atlas and its per-section counts, the
neighbourhood panel at the foot of every page, the reference sidebar, the
coverage board, or the API board on the landing page. All five are derived on
every build — the first four from the documentation tree, the last from
`backend/openapi.yaml`.

## Voice

The existing documentation has a register, and a page written in a different one
reads as an intrusion. Match it.

**Declarative, and about the reason.** State the rule, then why it is the rule.
From `docs/domain/league-lifecycle.md`:

> Nothing anyone can still read is ever deleted.

From `backend/src/composition.ts`:

> The one place that picks a persistence implementation.

**Prefer a stated trade-off to a neutral description.** From
`docs/development/backend-testing.md`:

> What separates the tiers is not how much of the stack they exercise — it is
> **which layer they are allowed to name**.

**Name the failure the rule prevents.** From `docs/architecture/backend-architecture.md`:

> Reuse beats restating: a rule implemented twice is a rule that will eventually
> be two different rules.

**Say what was decided against, and why.** ADRs carry their rejected
alternatives and their open questions; do not quietly drop the parts that are
still unresolved.

Specifics:

- British spelling, sentence case in headings, an em dash where a comma would be
  weaker.
- Second person for instructions, never "we".
- No marketing adjectives. No "simply", "just", "easy", "powerful", "robust".
- Wrap prose at roughly 80 columns.
- Use the vocabulary in [`CONTEXT.md`](../../CONTEXT.md) exactly — *Top Read
  Snapshot*, *Free Agent*, *Chemistry Link*, *Owner Team*. The glossary carries
  an "avoid" list for each term; honour it.
- Absolute dates, never "recently" or "last month".

## Space that is prepared and not yet filled

Sometimes a page has to exist before its evidence does — a section of a report
template that must be covered, or work that was done and not written up. **Never
fill that space with plausible prose.** A sentence that reads like a result is
read back later as one, and the whole claim this site makes is that what is on
it is true.

Mark it instead, in both of the ways below:

- **`<Planned evidence="…">`** wraps the empty section and renders a banner no
  reader can mistake for content. The `evidence` prop names what the section
  will be written *from* — a log, a set of records, an issue tracker — so that
  filling it later is a retrieval task rather than a writing task. Prose inside
  the banner describes what belongs there, never what it will say.
- **`status: planned` in the frontmatter**, when the *whole* page is space. The
  mirror carries it into `graph.json` and `npm run mirror` prints a `planned`
  line naming those pages, so what is still unwritten is a query and not
  something to remember.

Drop both the moment the section is written. A `<Planned>` banner above real
prose is worse than neither.

## Diagrams

**Mermaid by default**, in a fenced ` ```mermaid ` block. Diagrams-as-code is
the point: a diagram that is a PNG is a diagram nobody will update.

The site renders mermaid through `docs/site/.vitepress/theme/components/Mermaid.vue`,
which applies the palette in both light and dark mode, so a diagram needs **no
styling to look right**. Only reach for `classDef` to give one or two nodes
emphasis, and only with these values:

| Meaning | Fill | Stroke |
|---|---|---|
| Emphasis — the subject of the diagram | `#e8f2ec` | `#1e7e50` |
| A seam, a store, or something deliberate | `#fdf3d6` | `#d8b03a` |

Never introduce a third colour, and never hard-code a text colour — it will be
wrong in one of the two themes.

Conventions that keep the diagrams readable as a set:

- `flowchart` for structure, `sequenceDiagram` for a journey over time,
  `erDiagram` for the schema.
- A node label is a name plus, in `<small>`, what it is:
  `"<b>Backend</b><br/><small>Hono on a Worker</small>"`.
- Label the edges that carry a protocol or a credential — `"/internal/* · bearer"`
  says more than an arrow.
- Keep a diagram to one idea. Two diagrams beat one that needs a legend.

**Width is legibility.** A diagram is drawn at whatever width its labels demand
and then scaled down to fit the column, so every extra word costs type size on
every node. `Mermaid.vue` refuses to scale below `MIN_SCALE` and lets the figure
scroll instead, which keeps the type readable but is not free — a reader should
not have to drag every picture sideways. So:

- **Keep a `<small>` subtitle under 25 characters.** They are the width driver;
  `parse · auth · respond` says what `parse input · enforce auth and HTTP · map
  results to responses` said.
- **Under about 1,100 mermaid units fits without scrolling.** Past that, drop a
  participant, split the diagram, or turn an `LR` into a `TB`.

**A notation with a legend may use its own colours.** The two-colour emphasis
rule above is about drawing attention inside an ordinary diagram; a modelling
notation is a different thing, and the sticky-note boards on
[Requirements](https://fantasywiki.github.io/FantasyWiki/overview/requirements.html)
carry one. Its six fills are all drawn from tokens the site already uses, and it
is the only such exception:

| Note | Fill | Stroke |
|---|---|---|
| Actor | `#eef1ee` | `#737f73` |
| Action | `#e8f0f7` | `#2f6f9e` |
| Aggregate | `#fdf3d6` | `#d8b03a` |
| Event | `#f7e7e0` | `#b45a3c` |
| Value | `#e8f2ec` | `#1e7e50` |
| Policy | `#efe9f6` | `#7a5aa8` |

If you add a second notation, give it a legend diagram of its own and add it
here. If you find yourself reaching for a seventh colour inside this one, you
are modelling something the notation does not have a note for.

**Bespoke SVG only where mermaid's layout would actively mislead.** The Atlas is
the standing example: it is a force layout over live data, which no diagram
language can express. Write it inline in a Vue component with `var(--fw-…)`
colours so it follows the theme — never as a checked-in image.

**Screenshots** go in `docs/assets/`, never in `frontend/public/` — that
directory ships in the deployed app bundle, and a documentation GIF there would
be served to every player. Name them by what they show: `market.png`,
`formation-chemistry.gif`. Use the `<Figure>` component so they get a caption
and a border.

## Where everything lives

`docs/` holds both halves. The canonical documentation is the tree you are
reading; `docs/site/` is the machinery that publishes it.

```
docs/
├── domain/ architecture/ development/ deployment/ adr/            ← canonical
├── agents/                                                        ← canonical, unpublished
├── assets/                                                        ← images
├── README.md                                                      ← the index
└── site/                          the VitePress project

backend/openapi.yaml               ← canonical, and the only one outside docs/
    ├── pages/                     authored tier, site-only
    ├── public/                    favicon, logo
    ├── .vitepress/                config + theme + components
    ├── scripts/                   prepare · check-diagrams · snapshot-atlas
    └── build/                     ← everything generated, gitignored
        ├── content/               the markdown mirror (VitePress srcDir)
        ├── data/                  graph.json · toc.json · coverage.json
        ├── coverage-input/        reports CI downloads
        └── dist/                  what gets published
```

**The site sits inside the tree it mirrors, and that is load-bearing.**
`prepare.mjs` prunes `docs/site` from its walk of `docs/`; without that it would
descend into its own `node_modules` and mirror thousands of dependency READMEs.
Do not simplify that walk. The check is the page count — the mirror should
report the same number of pages as there are documents, not thousands.

The payoff is that one path filter, `docs/**`, now covers both halves: the
publish workflow reruns when the docs change *or* when the site that renders
them does.

**One documentation file lives outside the tree.** `backend/openapi.yaml`
describes the Worker's HTTP contract and belongs next to the Worker, where the
test that gates it can read it. It is therefore named separately in the publish
filter in `ci-cd.yml` — a change to the API alone still has to republish the
reference.

## How the build works

```
docs/** (minus site/    ─┐
     and minus agents/)  │
CONTEXT, PRODUCT,        ├─► scripts/prepare.mjs ─► build/content/   (the mirror)
DESIGN, AGENTS, CLAUDE   │                       └► build/data/*.json
docs/site/pages/**  ─────┘                            graph · toc · coverage
                                    │
                                    ▼
                       vitepress build ─► build/dist ─► GitHub Pages
```

Everything under `docs/site/build/` is generated. **Never edit anything inside
it** — it is rebuilt from scratch on every run and your change will vanish
without a message.

What `prepare.mjs` does, in order:

0. Copies `docs/site/public/**` into the mirror's own `public/`. VitePress looks
   for `public/` inside `srcDir`, and `srcDir` is the mirror — without this step
   the logo and the favicon 404 while every page still references them.
1. Copies `backend/openapi.yaml` into that same `public/`, so the API page can
   fetch the spec at runtime rather than bundle it. A missing file is a warning,
   not a failure: the mirror is also built by `npm run dev` against a tree
   someone may be halfway through.
2. Copies `swagger-ui-dist/swagger-ui.css` into that same `public/`. A missing
   file *is* a failure here — it ships inside a dependency, so its absence means
   a broken install rather than an unfinished tree. Why it is copied instead of
   imported is the trap below.
3. Copies `docs/site/pages/**` into the mirror.
4. Copies `docs/**` — excluding `docs/site/` and everything in `UNPUBLISHED`,
   which today is `docs/agents/` — into `build/content/docs/`, renaming
   `README.md` to `index.md` and copying `docs/assets/` alongside.
5. Copies the five repo-root charter files to the mirror root, which is what
   makes `../../CONTEXT.md` resolve from a doc that has moved.
6. Rewrites any link that points somewhere the site does not host — a source
   file like `../../backend/migrations/0008_league_closure.sql`, or one of the
   unpublished `docs/agents/` files — into a GitHub blob URL. Links inside
   backticks are left alone, so the convention examples in `docs/README.md`
   survive.
7. Injects `title`, `source`, `section` and `updated` frontmatter. `source` is
   what makes each page's *Edit* link point at the real file rather than the copy.
8. Builds `graph.json` (nodes, edges, hubs, orphans), `toc.json` (the derived
   sidebar) and `coverage.json`.

Coverage reports are read from `COVERAGE_DIR` if it is set — that is how CI
hands the artefacts over — and otherwise from wherever each tool writes them
locally. A package with no report is rendered as unmeasured, never as zero.

## Never import a stylesheet with `?url`

VitePress decides which file is *the* site stylesheet by taking the first CSS
asset Rollup emits:

```js
output.find((chunk) => chunk.type === "asset" && chunk.fileName.endsWith(".css"))
```

**One CSS asset is the assumption, and nothing enforces it.** A CSS import
written `import sheet from "…/thing.css?url"` makes the build emit a second one,
and if its name sorts first, every page in the site links *that* file and none
links the theme. The theme is still built, still uploaded, still reachable —
just referenced by nothing.

This shipped. The site published with no styling at all and every gate stayed
green: the markdown was valid, the links resolved, all 61 diagrams drew, and the
spec matched its routes. Nothing any check looked at was wrong.

So: a stylesheet that should not be folded into the global bundle goes into
`public/` and is linked by URL at runtime — which is what `mirrorSwaggerStylesheet`
in `prepare.mjs` does for Swagger UI, and what the long comment in
`SwaggerUi.vue` exists to defend. A `public/` file is copied outside the bundle,
so it never reaches that `find`.

`scripts/check-styles.mjs` runs after `vitepress build` and fails if `assets/`
holds anything other than exactly one stylesheet, or if any built page does not
link it.

## Commands

```bash
cd docs/site
npm ci
npm run dev       # mirror, then serve with hot reload
npm run build     # mirror, then build — this is what CI runs
npm run preview   # serve the built output — restart it after every build
npm run mirror    # regenerate the mirror only
npm run diagrams  # render every mermaid block headlessly
npm run styles    # assert the built pages link the theme (needs a build first)
npm run snapshot  # render the Atlas to a standalone SVG
```

`npm run snapshot` exists for the printed report: the Atlas on the site is
interactive and therefore lives in a browser, and a PDF cannot open it. It draws
the same picture from the same layout module, so the two cannot disagree about
where a document sits. Its output is gitignored — a checked-in render would be
stale the moment anyone wrote a link.

Editing a file under `docs/` while `npm run dev` is running does **not** refresh
the page: the dev server watches the mirror, not the source. Re-run
`npm run mirror` in another terminal, or restart.

**`npm run preview` reads the built output once, at startup.** Rebuild while it
is running and it keeps serving the previous `index.html`, whose asset hashes no
longer exist — so every page 404s its own scripts, nothing hydrates, and every
diagram sits at "Rendering diagram…" forever. It looks exactly like a broken
site. Restart the preview after a build; a hard refresh will not do it.

## Choices already made

Recording these so they are not relitigated by accident.

**VitePress, not the tool the reference project used.** The site takes its
structure and ambition from
[crowd-vision](https://nickghignatti.github.io/crowd-vision/), which is built
with Quarkdown. VitePress was chosen instead for two reasons that are specific
rather than aesthetic: the Atlas and the coverage board are interactive Vue
components, which a static markdown compiler cannot host, and the mirror lets
forty-five existing `.md` files stay the single source of truth instead of being
converted into another format.

**Dead-link detection stays on.** It is the only automated proof that the mirror
rewrote every link correctly. Do not reach for `ignoreDeadLinks` to get a build
green — fix the link, or fix the rewrite rule in `prepare.mjs`.

**`base: "/FantasyWiki/"` is required.** The site is served from a project page,
not a user page. Omitting it works perfectly in `npm run dev` and ships a site
with no CSS.

**Swagger UI, mounted rather than generated.** The API reference is the
prebuilt `swagger-ui-dist` bundle over `backend/openapi.yaml`, and two things
about the mount are load-bearing. It is imported inside `onMounted`, because it
touches `window` at module load and VitePress builds every page through SSR — a
top-level import fails the build on a machine where `npm run dev` was perfectly
happy. And its stylesheet is imported with `?url` rather than as CSS, because
VitePress builds one stylesheet for the whole site: an ordinary import puts
150 kB of Swagger UI in front of every page here to serve the one that needs it.

**"Try it out" is off.** The site is served from `github.io` and the session
cookie is `SameSite=Lax`, so a request from the documentation would not carry
one and every protected operation would answer 401 — which reads as the API
being broken. Do not switch it on without changing one of those two facts.

**The site holds no rules.** If an authored page starts to be the best
description of how something works, that is the signal to move it into `docs/`
and leave a link behind.

## Related

- [Documentation index](../README.md) — where a canonical doc goes
- [OpenAPI Spec](./openapi-spec.md) — the API reference's own gate
- [Domain docs layout](./domain.md)
- [Deploy Strategy](../deployment/deploy-strategy.md)
