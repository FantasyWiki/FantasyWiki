---
title: Release Process
type: development
tags: [release, versioning, semver, semantic-release, conventional-commits, ci-cd]
related:
  - ./development-process.md
  - ./api-naming-rules.md
  - ../deployment/deploy-strategy.md
---

# Release process

**A version is computed, never typed.** Nobody decides that the next release is
`1.4.0`; the commits merged since the last one decide it, by a rule written down
once in `release.config.mjs`. There is no release branch, no release checklist,
and no command to run: merging into `master` is the whole procedure.

## What a version names

One version names the whole system at one commit: the SPA, the Worker and the
scoring collector image. They are built, checked and deployed from the same
commit on `master`, so a version per component would only be three names for
one fact.

A version is cut **after the production deploy succeeds**, so a version is what
production is running. A revision that failed to deploy is not released; its
commits go out with the next release that does deploy.

## How it is computed

`.github/workflows/release.yml` runs semantic-release on every push to `master`,
after the deploy. It reads the Conventional Commits since the last tag and
applies the course's shared preset,
`semantic-release-preconfigured-conventional-commits`, unmodified:

| Commits since the last release include | Release |
|---|---|
| a `!` after the type, or a `BREAKING CHANGE:` footer | major |
| a `feat` | minor |
| a `fix`, `perf`, `docs` or `revert` | patch |
| only `chore`, `ci`, `build`, `refactor`, `test`, `style` | none |

When there is something to release it does three things and nothing else:

1. **Tags the commit** with the bare version, `1.4.0`, no `v`, the form
   `gitSemVer` in the Gradle build also reads.
2. **Publishes a GitHub release** whose notes are those commits, grouped by type
   and linked to their pull requests.
3. Hands the version to `publish-images.yml`, which adds it as a tag to the
   **collector's container image** on GHCR beside `latest` and `sha-<short>`. The
   image and the notes that describe it share a name.

It writes no `CHANGELOG.md`. A changelog file only means something if it is
committed back to `master`, and `master` accepts pull requests and signed
commits only. The notes live on the release, where a reader looks for them.

The `version` fields in the `package.json` files are not the release version.
None of those packages is published, and nothing reads the field as a version
of FantasyWiki; the tag is the only place a version is written.

## To release, merge; to not release, choose the type

Everything about a release is decided by the commits, so the lever is the commit
type, chosen when the commit is written:

- A change a player can see is a `feat` or a `fix`, and it will be released.
- A change to the build, the tests or the tooling is a `build`, `test`, `ci` or
  `chore`, and it will not, even though it deploys.
- A breaking change says so with `!`. For the HTTP API that also means a new
  path version, see [API Naming Rules](./api-naming-rules.md).

## Versions so far

| Version | Landed on `master` | Milestone |
|---|---|---|
| 0.1.0 | 2026-02-26 | The app shell and the landing page |
| 0.2.0 | 2026-04-29 | The first playable screens: dashboard, formation, leagues on the backend |
| 0.3.0 | 2026-06-02 | Real Wikipedia data, Chemistry Links, player accounts |
| 0.4.0 | 2026-07-14 | The contract economy, and in-app problem reports |
| 0.5.0 | 2026-07-28 | Nightly scoring on the JVM collector; the beta opens |
| 0.6.0 | 2026-08-14 | Built during the beta: league detail, the Article Genie, rival line-ups |
| 0.7.0 | 2026-08-22 | The league section, every Wikipedia edition, the app in Docker |
| 0.8.0 | 2026-08-31 | MongoDB, password sign-in, WCAG 2.2 AA, the documentation site |
| 0.8.1 | 2026-09-18 | Documentation |

**Why 0.y.z.** SemVer reserves major version zero for initial development,
when anything may change, and that is what these months were: a game whose
rules were still being found, and from 28 July played in a beta by one league of
friends.

**Why 1.0.0 is the API.** SemVer says 1.0.0 defines the public API. The first
breaking change after 0.8.1 is the one that moved the HTTP API under `/api/v1`,
so the release that follows it is 1.0.0, and the version that declares the API
stable is the one that versions it.

## Related

- [Development Process](./development-process.md): how commits reach `master`
- [API Naming Rules](./api-naming-rules.md): the API's own version, and how it relates to this one
- [Deploy Strategy](../deployment/deploy-strategy.md): the deploy a release follows
