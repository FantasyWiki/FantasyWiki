---
title: League Visibility
type: domain
tags: [league, membership, invitation, visibility]
---

# League Visibility

Every league is **public** or **private**.

## The rule

- A **public** league can be joined by any authenticated player, with nothing
  in hand. It has **no invitation code** — there is nothing for one to guard.
- A **private** league can be joined only by presenting its **invitation
  code**. There is no exception for its **league admin**, and none is needed:
  an admin is already in the league they own — see below — so there is nothing
  for an exception to let in.

The Global League is public, and therefore codeless. It is the one league every
player is enrolled in on first login, so it must stay joinable by anyone.

## Visibility governs joining, not reading

This is the part the [original GDD](./fantawiki-requirements.md) does not say,
and the part most likely to be assumed the other way round.

A private league's page, factsheet and standings stay readable by anyone who
has its id. Only **joining** is gated. Someone handed an invitation should be
able to see what they are being invited to — how many teams, which Wikipedia
edition, how much season is left — before committing to it, and the standings
have always been served unscoped anyway.

The league id is therefore *not* a secret and never was a credential. The
invitation code is the credential.

## Who may hand the code out

Each league carries an **invite policy**, chosen on the creation form. It only
means anything for a private league, since a public one has no code:

- `members` — any player fielding a team in the league can share the code.
- `admin` — only the league admin can.

A public league still stores a policy, and creation still insists on one. It
decides nothing today, but a league that later turned private with no policy
recorded would be read as `admin` — a rule nobody chose, arrived at by omission.

## The founder is a member

Creating a league and fielding a team in it are **one act**: the league row and
its founder's team are written in the same transaction, so there is no moment at
which a league exists that nobody is in. This matters beyond tidiness — the
league list is scoped to the leagues a player has a team in, so a league written
without its founder would be invisible to everyone, and a private one would hold
an invitation code nobody could reach.

The founder is the league's **admin** — and because founding *is* joining, an
admin is a member by construction and never has to get past the gate at all.
Nor is there a back way in for one who left: leaving
[hands the league on](./league-lifecycle.md#when-the-admin-leaves) in the same
transaction, so a founder coming back to their own private league presents its
code like anybody else. The gate therefore never has to name the admin.

A caller the policy does not allow is answered exactly as if the league did not
exist. Telling a stranger that a code exists tells them there is something
worth guessing at.

## Related

- [League Season](./league-season.md) — the other thing fixed at creation: when
  the season starts and how long it may run.
- [League Lifecycle](./league-lifecycle.md) — the other gate on joining (a
  league that has ended or been closed admits nobody), and the admin's other
  privilege: closing the league they own.
- [ADR 0008: League Invitation Codes](../adr/0008-league-invitation-codes.md) —
  the code's format, where it may travel, and how the join is enforced.
- [FantaWiki Requirements](./fantawiki-requirements.md) — the original
  public/private definition (glossary) and the create/join user stories.
- [API Naming Rules](../development/api-naming-rules.md) — §5, on choosing
  between 403 and 404 for a refusal.
