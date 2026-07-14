---
title: Problem Reports
type: architecture
tags: [reports, github, privacy, rate-limiting]
---

# Problem Reports

Signed-in players file a problem from `/report`. The backend opens a **GitHub issue** on
`FantasyWiki/FantasyWiki` on their behalf and returns the issue number and URL.

There is no `problem_report` table. GitHub is the store of record: it assigns the id, the
timestamp and the permanent URL, and returns `html_url` in the create response.

## The pieces

| Layer | Module | Responsibility |
| --- | --- | --- |
| Route | `backend/src/routes/reports.ts` | `POST /api/reports`. Resolves the player from the session, checks the rate limiter, maps failures to status codes. |
| Service | `backend/src/services/problemReport.ts` | Validates, builds the issue title/body/labels. |
| Client | `backend/src/services/githubClient.ts` | `GitHubClient` interface + `GitHubApiClient`. Injected, so tests substitute a stub. |
| Composable | `frontend/src/composables/useProblemReport.ts` | Form state, submission, cooldown, fallback URL. |
| View | `frontend/src/views/ReportProblemPage.vue` | Bindings over the composable. |

The reporter is never taken from the request body — the route resolves them from the JWT, per
[API Naming Rules](../development/api-naming-rules.md).

## What goes into the issue

The body is the reporter's own text, followed by a collapsed `<details>` block holding the route
they came from, locale, viewport, user agent, and the opaque `players.id`.

**The email is never published.** The repository is public, so an address in an issue body would
be indexed and harvested permanently. To reply to a reporter, resolve their id server-side —
there is no tooling for this, it is a hand-run query:

```sql
SELECT ga.email
FROM players p JOIN google_accounts ga ON ga.id = p.accountId
WHERE p.id = '<uuid from the issue body>';
```

The consent checkbox covers **this report only** ("You can contact me about this report") and adds
the `contact-ok` label. It is not a marketing opt-in.

## Labels

Every report gets `user-report`, so maintainers can filter player reports out of their own board
with `-label:user-report`. Outside production, reports also get `preview`, keeping QA noise
filterable and bulk-deletable.

| Category (what the player picks) | Labels |
| --- | --- |
| Something is broken | `bug` |
| Something looks wrong | `bug`, `visual` |
| Propose a new functionality | `feature` |
| Request a new language | `feature`, `language` |
| I don't understand a rule | `question` |
| Something else | — |

Categories name the problem in the player's words, not by subsystem — a player should not need to
know the architecture to file a bug. Maintainers add any further labels at triage.

## Rate limiting

A Cloudflare rate-limit binding (`REPORT_RATE_LIMITER`) allows **3 submissions per 60s per
player**. The platform only supports a 10s or 60s period, so there is no daily cap. The binding
counts *attempts*, not successes: a GitHub outage consumes quota.

The client also disables the form for 60s after a submission via `localStorage`. That is a
courtesy to stop double-clicks, not a security control — the binding is the real limit.

## Failure handling

| Condition | Status | What the player sees |
| --- | --- | --- |
| Invalid payload | `400` | Inline validation message. |
| Rate limited | `429` | A cooldown message. **No** GitHub link — that would defeat the limit. |
| GitHub unreachable | `502` | The form keeps their text, plus a link to GitHub's own pre-filled `issues/new` form. |

A fallback issue filed through that link arrives **unlabelled and authored by the reporter's own
GitHub account** (`labels` in the query string is ignored for users without triage rights), so it
will not match the `user-report` filter.

## Screenshots

The form does not upload images. GitHub has no public API for attaching a file to an issue, so
the success screen links the created issue and invites the reporter to drag their screenshot in
there — GitHub's own uploader handles it.

## Authentication: a GitHub App, not a token

Issues are filed by a **GitHub App**, so they are authored by `FantasyWiki[bot]`. A personal
access token would author every player report under the maintainer who minted it, and would
expire (366 days maximum) — failing silently, since an expired token simply turns every
submission into a `502`.

On each report the Worker signs a short-lived **RS256 JWT** with the App's private key
(WebCrypto — no library), exchanges it at `/app/installations/{id}/access_tokens` for an
installation token, and creates the issue with that. Installation tokens last an hour and are
cached per isolate, so the exchange is not paid on every request. Nothing needs rotating.

### Setting it up

1. Create a GitHub App under the **FantasyWiki org** (*Org Settings → Developer settings → GitHub
   Apps → New*). Repository permissions: **Issues: Read and write**. No webhook, no user
   authorization.
2. **Install** it on the org, granting it only `FantasyWiki/FantasyWiki`.
3. Note the **App ID** and the **Installation ID** — the latter is the trailing number in the URL
   of *Org Settings → GitHub Apps → Configure*. Neither is secret; both go in `wrangler.jsonc`
   under `GH_APP_ID` and `GH_APP_INSTALLATION_ID`, in **all three** environments.
4. Generate a private key. GitHub hands you a **PKCS#1** PEM (`BEGIN RSA PRIVATE KEY`), which
   WebCrypto cannot import. Convert it once:

   ```bash
   openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt \
     -in fantasywiki.private-key.pem -out fantasywiki.pkcs8.pem
   ```

   The result starts `-----BEGIN PRIVATE KEY-----`.
5. Store that PKCS#8 PEM as the GitHub **Actions secret** `GH_APP_PRIVATE_KEY` (one key serves
   both environments). The deploy workflow pushes it to the Worker as a secret on every deploy,
   the same way `JWT_SECRET` flows.

The binding is deliberately **not** named `GITHUB_APP_PRIVATE_KEY`: GitHub reserves the `GITHUB_`
prefix and refuses to create an Actions secret that uses it.

## Prerequisite: the labels must exist

`user-report`, `visual`, `preview`, `contact-ok` and `language` must exist on the repository. GitHub **drops
unknown labels from a create-issue call and still returns `201`**, so a missing label fails
silently — the issue is filed, just unlabelled, and the `-label:user-report` filter that keeps the
maintainers' board clean quietly matches nothing.

## Related

- [Local Development Setup](../development/local-dev-setup.md) — where `GITHUB_TOKEN` goes.
- [API Naming Rules](../development/api-naming-rules.md) — why the reporter comes from the session.
- [Backend Architecture](./backend-architecture.md) — the Routes → Services layering this follows.
- [Backend Error Constants](./backend-error-constants.md) — the `REPORT_ERRORS` convention.
