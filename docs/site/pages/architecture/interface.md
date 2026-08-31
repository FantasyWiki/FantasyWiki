---
title: Interface design
description: The screens the game is played through, the path a player takes between them, and the rules the visual system is held to.
type: guide
---

# Interface design

The interface has one job that the architecture does not: it has to make a
strategy legible. A player's decision, which article to buy, where to place it,
whether to sell early, is only a decision if the information behind it is
visible at the moment it is taken. Everything below follows from that.

## The screens, and the path between them

Fifteen views, but only four paths a player is ever on: getting in, getting into
a league, playing the week, and looking outward at the competition.

```mermaid
flowchart LR
  H(["Landing"]) --> A{{"Google sign-in"}}
  A --> D(["Dashboard"])

  D --> L(["Leagues"])
  L --> N(["Create a league"])
  L --> J(["Join by code"])
  N --> T(["Team creation"])
  J --> T
  T --> D

  D --> M(["Market"])
  D --> TM(["My team"])
  M --> TM
  D --> LP(["League table"])
  LP --> R(["A rival's team"])

  D --> G(["Guide"])

  classDef entry fill:#eef1ee,stroke:#737f73;
  classDef gate fill:#fdf3d6,stroke:#d8b03a;
  classDef core fill:#e8f2ec,stroke:#1e7e50;
  classDef aside fill:#e8f0f7,stroke:#2f6f9e;
  class H entry; class A gate; class D,M,TM core; class L,N,J,T aside; class LP,R,G aside;
```

Only the landing page, the guide, the legal page and the auth callback are
public. Everything else resolves a player from the session cookie before it
renders, and team creation additionally refuses to open for a player who already
has a team in that league, a guard on the route rather than a check inside the
page, so the rule cannot be reached by a link.
→ [Frontend](./frontend.md)

## What the visual system is held to

The tokens themselves, the greens, the gold, the two typefaces, the spacing
scale, are stated once in
[`DESIGN.md`](../DESIGN.md) and consumed as Ionic CSS variables. They are not
repeated here. What is worth saying is the reasoning they encode:

- **League Green is an action, Wiki Gold is a reward.** The green marks what a
  player can do; the gold marks rank, prestige and outcome. A gold surface that
  is not saying "you placed" is the accent spent for nothing.
- **A serif for knowledge, a sans for control.** Libre Baskerville carries the
  display and title moments, because the subject is an encyclopedia; Source
  Sans 3 carries body and labels, because numbers and controls have to be
  scanned rather than read.
- **Mostly flat, with lift used sparingly.** Elevation is a signal about state,
  not a decoration, so a raised surface means something is modal or active.
- **Error, loading and empty states are designed, not defaulted.** Each one is
  explicit and offers the next action, because an empty league table with no
  explanation is indistinguishable from a broken one.

## The tone the screens are written in

The product's register is a game, not a dashboard, which is a constraint on
copy as much as on colour.
→ [`PRODUCT.md`](../PRODUCT.md)

Two rules the codebase actually holds itself to:

- **Chrome stays understated.** Footers and secondary furniture are compact and
  muted; there are no section headings on structural elements that carry no
  content.
- **Player-facing features stay in character.** Internal counts are turned into
  language a player would use rather than shown as numbers, a bucket, not a
  gauge. The Article Genie being *asleep* when its daily model quota is spent is
  the clearest case: the player is told the Genie is asleep, not that a rate
  limit returned 429.

## Accessibility

<p class="fw-wcag-claim"><a class="fw-wcag-logo" href="https://www.w3.org/WAI/WCAG2AA-Conformance" title="Explanation of WCAG 2 Level AA conformance"><img src="/wcag2.2AA.svg" width="88" height="31" alt="Level AA conformance, W3C Web Content Accessibility Guidelines 2.2"></a></p>

**WCAG 2.2 AA.** Measured on 2026-08-30 with `axe-core` driven against the
running application, twelve screens, in both themes, signed in and with data
on screen, under the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`
rulesets. The run returns no violations in either theme.

A rule engine reaches only the machine-checkable part of the standard, so the
part that decides whether the game can be played without a pointer is held
somewhere else: the formation editor's select-and-place path is covered by a
component test rather than by the audit.

## Related

- [Frontend](./frontend.md): how these screens are built and what holds their state
- [What FantasyWiki is](../overview/what-is-fantasywiki.md): the loop the screens serve
- [`DESIGN.md`](../DESIGN.md): the tokens, stated once
- [`PRODUCT.md`](../PRODUCT.md): the audience, the register and the design principles
