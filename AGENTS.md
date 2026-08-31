## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for this repository. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Domain docs use a single-context layout (`CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.

### OpenAPI spec

The HTTP contract is hand-written in `backend/openapi.yaml` and gated in both directions against the Worker's mounted route table by `backend/src/tests/routes/openapi.spec.ts`, adding a route without describing it fails the suite. Before writing one, read `docs/agents/openapi-spec.md`.

### Documentation site

The technical documentation is published to GitHub Pages from `docs/site/`, which mirrors `docs/` rather than copying it. Before adding a page, a diagram, or a section, read `docs/agents/documentation-site.md`, it carries the tier rules, the voice, the diagram palette, and the update checklist.
