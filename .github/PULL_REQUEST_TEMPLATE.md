<!--
The title is not decoration. `master` allows squash and rebase only, and a
squash of a single-commit pull request takes its subject from the commit, not
from this title. So write both as Conventional Commits, and make them agree:

    feat(frontend): reveal the podium while the season is still running
    fix(backend): stop settling a contract twice on a retried Workflow step

Types in use: feat, fix, docs, refactor, perf, test, build, ci, chore, style.
A breaking change takes a `!` before the colon and a BREAKING CHANGE footer.
-->

## What this changes

<!-- One paragraph. What the reader of the diff would otherwise have to infer. -->

## Why

<!--
The reason, not the restatement. If it closes an issue, link it (`Closes #123`)
and put here only what the issue does not already say.
-->

## How it was verified

<!--
Tick what you actually ran. `./gradlew check` runs format, lint, and the tests
on both persistence targets; CI runs the same thing, so a local failure here is
a CI failure you found early.
-->

- [ ] `./gradlew check` passes locally
- [ ] New behaviour has a test that fails without this change
- [ ] Checked in the running app, not only in the tests
- [ ] Not applicable, and the next section says why

## Gates that are easy to forget

<!-- Delete the lines that do not apply. Each one fails the build if skipped. -->

- [ ] **A route changed** and `backend/openapi.yaml` describes it. The backend
      suite fails in both directions until it does.
- [ ] **A domain rule changed** and it is stated once, in `docs/domain/`, with
      everything else linking to it. A rule that moved needs an ADR.
- [ ] **Docs changed** and `cd docs/site && npm run build` passes. Its dead-link
      and diagram checks are the gate, and a diagram that parses can still fail
      while being laid out.
- [ ] **A new term appeared** and it is in `CONTEXT.md`, with its `_Avoid_` list,
      before it appeared in a type name.
- [ ] **A user-facing string changed** and both locale catalogues carry it.

## Anything left undone

<!--
Known gaps, follow-up issues, decisions deliberately postponed. A pull request
that says what it did not do is easier to approve than one that looks complete
and is not.
-->
