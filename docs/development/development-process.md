---
title: Development Process
type: development
tags: [process, git, branching, conventional-commits, pull-requests, review, dependencies]
related:
  - ./release-process.md
  - ./ai-assistance.md
  - ../deployment/deploy-strategy.md
  - ../adr/0009-agpl-license.md
---

# Development process

How a change gets from an idea to `master`: the branches it lives on, the shape
its commits must have, and the one gate every change passes. What happens after
`master`, the deploy and the version, is in
[Deploy Strategy](../deployment/deploy-strategy.md) and
[Release Process](./release-process.md).

The process is sized for what the project is: **two authors, one deployed
service, one production version at a time.** Every rule below is there because
it pays for itself at that size, and the heavier conventions a larger team
would reach for are left out on purpose, with the reason.

## Branches

| Branch | Lives | Is for |
|---|---|---|
| `master` | forever | Production. Every push deploys it and may release it. |
| `dev` | forever | Integration and QA. Every push deploys it to the preview environment. |
| `<type>/<topic>` | days | One change. `<type>` is the Conventional Commits type it carries: `feat/`, `fix/`, `docs/`, `refactor/`, `ci/`, `chore/`. |
| `renovate/*` | hours | One dependency update, opened by Renovate. |

A topic branch is merged into `dev` when it needs to be seen next to the other
author's work on a deployed environment first, and straight into `master` when
it does not. `dev` reaches `master` through a pull request like any other
branch.

**Why not GitFlow.** Its `release/*` and `hotfix/*` branches exist to prepare
and patch versions that are shipped and supported side by side. This project
ships one version, the one running in production, and never patches an older
one, so those branches would be ceremony with nothing to protect. What GitFlow
gets right, an integration branch that is exercised before production, is kept,
and it is `dev`.

**Why not trunk only.** With two people changing the same screens in the same
week, a shared environment that is not production is where one author's change
meets the other's before a player does. That is the one job `dev` has, and it is
why it deploys.

## Commits

Every commit follows [Conventional Commits](https://www.conventionalcommits.org/):
`feat(frontend): reveal the podium while the season is still running`. The type
is not decoration. It decides the next version
([Release Process](./release-process.md)), it names the branch, and it sorts
the release notes.

It is enforced where a commit is written: a `commit-msg` hook, installed by the
Gradle build itself (`settings.gradle.kts`), rejects a subject that does not
parse. There is no step to remember, a first `./gradlew` run installs it.

**The hook has one blind spot, and it has been hit.** A squash merge on GitHub
takes its subject from the merge dialog, where no local hook runs. That is how
`Feat: Implement the team dashboard` reached `master` on 2026-03-23, with a type
the release tooling does not recognise. The pull request template asks for a
Conventional Commits title for that reason, and the one who merges is the check.

One commit is one change. A pull request whose history is a series of attempts
is squashed; one whose commits are each a finished change is rebased, and the
commits land as they are.

## The gate: pull requests into `master`

`master` is guarded by a repository ruleset, not by convention:

| Rule | What it stops |
|---|---|
| A pull request is required | A change nobody but its author has seen |
| `ci-cd / success` must pass, on a branch up to date with `master` | A change that is green only against an older `master` |
| Merge by squash or rebase only; linear history | A merge commit, see below |
| Signed commits | A commit whose author cannot be verified |
| No force push, no deletion | Rewriting what production was built from |

`ci-cd / success` is the aggregate of `check.yml`: format, lint, typecheck,
audit, and every test suite on both persistence targets
([Continuous delivery](https://fantasywiki.github.io/FantasyWiki/quality/ci-cd.html)).

**The ruleset asks for no approval**, and that is deliberate at this size. A
mandatory second review would stop whichever author is working while the other
is not, and the checks carry the part of review a machine can do. Review by the
other author happens on the pull request when the change calls for it, and the
tooling does not force it: of the last 25 pull requests other than Renovate's,
10 carry a formal review and 23 a discussion.

**Why no merge commits.** `master`'s history is the input to the release: the
version is computed from its commits and the notes are its commits, grouped.
A merge commit adds an entry that is not a change, and a branch's commits
interleaved with `master`'s make a release's contents depend on commit dates
rather than on what was merged. A linear `master` is also one `git bisect`
can walk without being told which parent to follow.

**Pull requests from forks** run `check.yml` like any other: the workflow names
no secret, and the jobs that need one either skip a fork or run only on a
deploying branch. See the dispatcher in `.github/workflows/ci-cd.yml`.

## Dependencies

Every dependency is declared: `package-lock.json` locks each npm project, and
the JVM module's direct dependencies are pinned in Gradle version catalogs.
Renovate opens a `renovate/*` branch per update and merges it once
`ci-cd / success` passes. The shared preset it extends holds an npm release back
three days first, npm's window for retracting one. Merging updates nobody
watched is acceptable for one reason only: the gate is the whole test suite on
both persistence targets, and an update that breaks an interface breaks a test.

## Related

- [Release Process](./release-process.md): what happens to `master` after a merge
- [Deploy Strategy](../deployment/deploy-strategy.md): which branch deploys where
- [AI Assistance](./ai-assistance.md): how agents fit into the flow above
- [ADR 0009: AGPL-3.0](../adr/0009-agpl-license.md): the licence every contribution is made under
- [API Naming Rules](./api-naming-rules.md): the conventions a new route follows
