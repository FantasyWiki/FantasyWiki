---
title: League Visibility
type: domain
tags: [league, membership, invitation, visibility]
---

# League Visibility

Every league is **public** or **private**, and every league carries an
**invitation code**.

## The rule

- A **public** league can be joined by any authenticated player. Its invitation
  code is a share shortcut, never a requirement.
- A **private** league can be joined only by presenting its invitation code —
  or by its **league admin**, who is never locked out of the league they own.

The Global League is public. It is the one league every player is enrolled in
on first login, so it must stay joinable with nothing in hand.

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

Each league carries an **invite policy**, chosen when the league is created:

- `members` — any player fielding a team in the league can share the code.
- `admin` — only the league admin can.

A caller the policy does not allow is answered exactly as if the league did not
exist. Telling a stranger that a code exists tells them there is something
worth guessing at.

## Related

- [ADR 0008: League Invitation Codes](../adr/0008-league-invitation-codes.md) —
  the code's format, where it may travel, and how the join is enforced.
- [FantaWiki Requirements](./fantawiki-requirements.md) — the original
  public/private definition (glossary) and the create/join user stories.
- [API Naming Rules](../development/api-naming-rules.md) — §5, on choosing
  between 403 and 404 for a refusal.
