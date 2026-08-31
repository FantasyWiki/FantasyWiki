---
title: FantasyWiki
description: Technical documentation for a fantasy league played with Wikipedia articles.
layout: doc
sidebar: false
aside: false
outline: false
pageClass: fw-landing
---

<h1 class="fw-brand-title">Fantasy<span>Wiki</span> documentation</h1>

A fantasy league played over Wikipedia pageviews. These pages are how it is
built: the rules the game runs on, the seams the code is cut along, the
decisions that got it here, and what the test suites reach.

<a class="fw-report-cta" href="./report.html">
  <span class="fw-report-cta__eyebrow">Start here</span>
  <span class="fw-report-cta__title">Exam report</span>
  <span class="fw-report-cta__go">Read it →</span>
</a>

## The Docs Atlas

Every document, and every link between them, drawn from the markdown itself.

<DocsAtlas />

- **A dot is a document** — coloured by its section, sized by how many links
  touch it, so the hubs are visibly the hubs.
- **A solid line is a curated edge**, taken from a document's closing
  `## Related` list. A dashed one is a reference made in passing, mid-sentence.
  Both count; they do not mean the same thing.
- **A dot with no lines is a finding** — a rule that was written down and then
  orphaned, which is the failure a folder of markdown cannot show you.

## Coverage

Three packages, three test runners, three report formats, read from the reports
the runs on `master` actually wrote — not from a badge, and not from a number
typed into a page.

<CoverageBoard />

These are line coverage, and the three figures are not comparable with one
another. The backend excludes the route modules the integration tier already
drives end to end; the frontend's specs are deliberately regression smoke, with
the game rules asserted where they are implemented rather than a second time in
the browser; the Kotlin collector counts everything it has, including the
Wikimedia response parsing that carries most of its risk.

[What each suite is for, and which layer it may name →](./quality/testing.html)

## The API

Every endpoint the Worker serves, counted out of the specification that
describes it — not from a list anybody maintains.

<ApiBoard />

Nothing can be missing from this. The backend suite compares the spec with the
Worker's own mounted route table in both directions, so an endpoint that exists
and is not described fails the build, and so does one described and no longer
served.

[Every endpoint, with the status it answers and why →](./api.html)

---

If none of the vocabulary on this page means anything yet, start from
[what FantasyWiki is](./overview/what-is-fantasywiki.html); if you are here to
change something, start from the [architecture overview](./architecture/); and
if you already know what you are looking for, the
[documentation index](./docs/) is the shelf it is on.

Where these pages come from, and how the Atlas and the board are derived:
[About this site](./about-this-site.html).

<div class="fw-stamp">
  <a class="fw-wcag-logo" href="https://www.w3.org/WAI/WCAG2AA-Conformance" title="Explanation of WCAG 2 Level AA conformance"><img src="/wcag2.2AA.svg" width="88" height="31" alt="Level AA conformance, W3C Web Content Accessibility Guidelines 2.2"></a>
  <p class="fw-stamp__scope">The FantasyWiki application, measured against <strong>WCAG 2.2 AA</strong> on 2026-08-30 — <code>axe-core</code> across twelve screens, in both themes, with no violations. <a href="./architecture/interface.html#accessibility">How it was tested →</a></p>
</div>
