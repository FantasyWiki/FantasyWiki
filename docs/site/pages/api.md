---
title: API reference
description: Every endpoint the FantasyWiki Worker serves, rendered from the repository's own OpenAPI document.
type: guide
---

# API reference

Authentication is decided by the path prefix, not by the endpoint: `/auth/*`
mints a session, `/api/*` reads one from an HTTP-only cookie, `/internal/*` is
the scoring engine presenting a service token. Identity is always resolved
server-side, which is why the self-scoped reads are spelled `my-…` rather than
carrying an id — [API Naming Rules](./docs/development/api-naming-rules.md).

Every failure answers a single `error` field. The status code carries the
meaning; the string is a constant to match on, never to parse —
[Backend Error Constants](./docs/architecture/backend-error-constants.md).

"Try it out" is off: the session cookie is `SameSite=Lax` and will not travel
from this origin. The document is at [`/openapi.yaml`](/openapi.yaml).

<SwaggerUi />
