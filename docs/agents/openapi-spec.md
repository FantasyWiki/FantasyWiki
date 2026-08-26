---
title: OpenAPI Spec
type: agents
tags: [api, openapi, conventions]
---

# The OpenAPI spec

`backend/openapi.yaml` describes every endpoint the Worker serves. **Adding a
route without adding it here fails the build.** Read this before writing one.

## Why it is written and not generated

The routes are plain Hono handlers, with no schema decorators and no validation
library, so there is nothing attached to them to derive a document from.

Generating from the shared DTOs instead would produce a wrong document rather
than a weaker one. They carry `@js-temporal/polyfill` values, and a
`Temporal.Instant` is a class in the code and an ISO-8601 string on the wire; a
type-to-schema generator emits the class, which is the one thing the wire never
contains. Adopting `@hono/zod-openapi` would work, but that is a rewrite of
every route rather than a documentation decision — it stays open if the routes
ever grow a validation layer.

## What keeps it true

`backend/src/tests/routes/openapi.spec.ts` reads the Worker's own mounted route
table and compares it with the documented operations **in both directions**: a
route the spec does not describe fails, and so does an operation no route
serves. It also refuses a `$ref` that resolves to nothing, which Swagger UI
renders as an empty box rather than as an error.

What no test can check is whether an operation describes its payload
*correctly*. The surface is what is mechanisable, and it is also the half that
rots — a body shape is wrong the day it is written or not at all, whereas an
endpoint list goes stale on its own.

Middleware is excluded from the comparison: Hono registers `app.use(...)` in the
same table as a handler, under the method `ALL`, and the JWT guard is not an
endpoint. `OPTIONS` is dropped for the same reason.

## Writing an operation

The path is decided by
[API Naming Rules](../development/api-naming-rules.md) — document what exists,
and never invent an id-bearing variant of a self-scoped route.

Worth the effort, because it is what the reader came for: **every status the
handler can answer**, and what causes it; **which security scheme applies**,
where the operation departs from the document default; and **the reason**, where
there was a decision — a 409 rather than a 403 was a choice, and saying which
and why is the difference between a reference and a route list.

Schemas are named for the domain — `Contract`, not `ContractDTO`. The wire shape
is the contract, not the TypeScript that happens to build it.

Match the voice the rest of the documentation is written in:
[Documentation Site](./documentation-site.md) carries it.

## Where it surfaces

The published site renders the file with Swagger UI at
<https://fantasywiki.github.io/FantasyWiki/api.html> and serves it unchanged at
`/openapi.yaml`; the same build counts it into the API board on the landing
page. Neither is anything to maintain — both are derived on every publish. The
mechanics are in [Documentation Site](./documentation-site.md).

## Related

- [Documentation Site](./documentation-site.md)
- [API Naming Rules](../development/api-naming-rules.md)
- [Backend Error Constants](../architecture/backend-error-constants.md)
- [Backend Testing](../development/backend-testing.md)
