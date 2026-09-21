---
title: "ADR 0009: FantasyWiki is licensed under the GNU AGPL v3.0"
type: adr
tags: [license, agpl, open-source, decision]
related:
  - ../development/development-process.md
  - ../development/release-process.md
---

# FantasyWiki is licensed under the GNU AGPL v3.0

> **Status:** decided when the repository was created (2025-12-14), recorded
> 2026-09-21.

FantasyWiki's source is published under the **GNU Affero General Public License
v3.0** (`LICENSE`). Anyone may run, study, change and redistribute it, and
anyone who offers a modified FantasyWiki to players over a network must offer
those players the modified source.

## The constraint that shaped it

FantasyWiki is not distributed; it is **served**. Nobody installs it. A player
opens a page, and the code runs on Cloudflare. That one fact decides between
the licences, because the obligations of most of them are triggered by
*distribution*, and a hosted game never distributes anything.

## Options considered

| Licence | What a third party hosting a modified copy owes its players | Verdict |
|---|---|---|
| MIT / Apache-2.0 | Nothing | Rejected: a closed fork of an open game is allowed |
| GPL-3.0 | Nothing, because serving is not distribution | Rejected: copyleft in name, permissive in practice for a web service |
| **AGPL-3.0** | **The modified source, to every player it serves** | **Chosen** |
| Proprietary | Not applicable, nobody may host it | Rejected: the project is public and is meant to be read, studied and played with |

GPL-3.0 is the instructive rejection. It is the licence usually meant by
"copyleft", and for this project it would protect nothing: a host could change
the scoring, the economy or the data it keeps about players and never publish a
line, because no copy of the program ever leaves its servers. The AGPL's section
13 closes exactly that gap, and it is the only difference between the two that
matters here.

## Consequences

- **The deployed service carries its source link.** The app's footer links to
  this repository (`frontend/src/layout/InfoFooter.vue`); removing it would put
  the deployment itself out of compliance. It is listed as a constraint in
  [Requirements](https://fantasywiki.github.io/FantasyWiki/overview/requirements.html).
- **Dependencies must be compatible, and are.** The shipped dependencies are
  under permissive licences (MIT, ISC, Apache-2.0, BSD), which may be combined
  into an AGPL work. A dependency under a licence that forbids that, or under
  the SSPL, cannot be added.
- **Contributions arrive under the same terms.** There is no contributor licence
  agreement; a pull request is a contribution under the AGPL, which is what the
  licence's own section 5 provides for. See
  [Development Process](../development/development-process.md).
- **The licence covers the code, not the data.** Article text shown in the app
  is Wikipedia's, under CC BY-SA, and pageview counts are Wikimedia's, under CC0.
  Neither becomes AGPL by passing through FantasyWiki.

## Related

- [Development Process](../development/development-process.md): how a contribution reaches `master`
- [Release Process](../development/release-process.md): what is published, and where
