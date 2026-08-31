---
title: Notifications
type: architecture
tags: [notifications, contracts, frontend, api]
---

# Notifications

The in-box is the only place the game speaks to a player about something that
happened while they were not looking. It is deliberately small: a notification
is a **sentence about one contract**, written by whatever resolved that
contract, and read back per league or across all of them.

## What writes one

Nothing writes a notification for its own sake. Every one of them is the trace
of a money write that has already succeeded:

| written by | when | says |
| --- | --- | --- |
| `ContractService.sellContract` | a player takes an Early Sell | what the sale paid |
| `ContractService.settleDueContract` | the nightly sweep settles at expiry | the signed P&L against Purchase Price |
| the same, on the renewal branch | the sweep renews | the new term, price and premium |

That ordering is the rule: **the write first, the notification after, and a
failed notification is logged rather than thrown.** The credits have already
moved by then, so raising here would only send the caller into a retry loop that
can never succeed, the second attempt fails on `ALREADY_SOLD`. A player who is
never told is a bad outcome; a player charged twice is a worse one.

Because [settlement](./contract-settlement.md) writes its notification only when
the guarded write reports it actually changed a row, a retried step stays silent
instead of announcing the same expiry twice.

## The shape on the wire

A `NotificationDTO` carries the whole `ContractDTO` it is about, not a contract
id. The in-box shows the article, the team and the term next to the sentence, and
it is opened from anywhere in the app, resolving a row's contract client-side
would mean a fetch per row against an endpoint scoped to a league the reader may
not currently have selected.

That expansion happens in the service, which joins the contract, the team and the
player in one repository row (`NotificationRow`) and asks the league repository
only for the **distinct** leagues in the batch, once each, to attach the domain
every article title needs. The result is two round trips for an in-box of any
size.

`date` is a `PlainDate` and, like every Temporal field, crosses the wire as a
string and is rebuilt by `deserializeNotification`, see
[DTO Dressing](./dto-dressing-pattern.md).

## Reading, and the two endpoints

| endpoint | scope |
| --- | --- |
| `GET /api/player/notifications` | every league the caller plays in |
| `GET /api/leagues/{id}/my-notifications` | one league |
| `PATCH /api/notifications/{id}/read` | mark one read |

Both reads resolve the player from the session and never take a `playerId`
([API Naming Rules](../development/api-naming-rules.md)). `markAsRead` matches on
the notification **and** the caller, so another player's row answers 403 rather
than being flipped; a row that does not exist answers 404. The distinction is
made in the repository: the update matches id and owner together, and only when
it changes nothing does a second query ask whether the row exists at all, so
the common case costs one statement and the two failures still answer
differently.

The frontend fetches the unscoped list once. The NavBar badge is a count over
everything, an unread notification in a league the player is not looking at is
exactly what the badge is for, and the per-league views are computed from that
same cached list rather than a second request. `useNotifications` is where both
derivations live.

## What it is not

There is no notification type, no severity, and no delivery channel. The
`NotificationDTO` has a commented-out `type` union which is the record of a
decision not yet taken; until something needs to branch on it, a notification is
a rendered sentence and the game reads the same in every locale it was written
in, which is the honest limitation here: **messages are composed server-side in
English** and are not translated by the frontend's i18n layer
([Frontend Localisation](./frontend-localisation.md)).

## Where each piece lives

| concern | code |
| --- | --- |
| the entity | `model/notification.ts`, `dto/notificationDTO.ts` |
| writing one | `backend/src/services/contract.ts` |
| reading and expanding | `backend/src/services/notification.ts` |
| ownership check and row shape | `backend/src/repositories/notificationRepository.ts` |
| the endpoints | `backend/src/routes/notifications.ts`, `player.ts`, `leagues.ts` |
| badge, list, mark-read | `frontend/src/composables/useNotifications.ts`, `components/InBox.vue` |

## Related

- [Contract Settlement](./contract-settlement.md): the sweep that writes most of them
- [DTO Dressing Pattern](./dto-dressing-pattern.md): how the contract inside one is dressed
- [API Naming Rules](../development/api-naming-rules.md): why neither read takes a `playerId`
- [Frontend Query Keys](./frontend-query-keys.md): the key the in-box list is cached under
