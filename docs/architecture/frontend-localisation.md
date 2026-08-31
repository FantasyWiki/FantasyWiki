---
title: Frontend Localisation
type: architecture
tags: [frontend, i18n, vue, lint, conventions]
---

# Frontend localisation

The app ships in **English and Italian**, and which one a visitor gets is decided
before the first frame. Two catalogues, one schema, and two lint rules that make
a missing translation a build failure rather than a key printed on screen.

## English is the schema of record

The catalogues are JSON, `src/i18n/locales/en.json` and `it.json`, because the
i18n lint tooling can read JSON and cannot read a TypeScript module. That trade
lost the compile-time completeness the old typed catalogue gave, so
`locales/schema.ts` buys it back in three lines:

```ts
export type MessageSchema = typeof en;
const _itParity: MessageSchema = it;   // a missing key is a type error
```

English is the shape every other catalogue is checked against, and it is the
`fallbackLocale`, so a key that somehow escapes both checks renders in English
rather than as its own name.

Two ESLint rules from `@intlify/eslint-plugin-vue-i18n` close the other two
directions: `no-missing-keys` fails on a `t("…")` whose key is in no catalogue,
and `no-unused-keys` reports a catalogue key nothing references. The parity type
catches *absence in Italian*; the lint rules catch *drift between code and
catalogues*. Neither subsumes the other.

## Choosing the locale, once

`resolveInitialLocale()` is the whole policy, in order: a locale the visitor
previously chose (persisted under `language`), then the browser's preferred
language, then English.

It is **exported and used twice**, the `createI18n` instance boots with it, and
the app store's `languageCode` initialises from it. Two independent guesses at
the same question is how the switcher comes to show one flag while the page reads
in another language.

The switcher itself is built from `AVAILABLE_LANGUAGES` in the app store, whose
codes are lowercase to match the i18n locales, the persisted key and the
`<html lang>` attribute all at once. Adding a locale is: a catalogue file, an
entry in `SUPPORTED_LOCALES`, and an entry in that list.

vue-i18n runs in **Composition API mode** with `globalInjection` on, so `$t` stays
available in templates while composables use `useI18n()`.

## What is not translated

**Server-composed sentences.** A notification's message is written in English by
the backend when a contract settles, stored as text, and rendered as-is
([Notifications](./notifications.md)). It is a known gap, not an oversight: making
it translatable means sending a key and its parameters instead of a sentence, and
that is a change to the DTO rather than to this layer.

Article titles, team names and player names are not translated either, for the
obvious reason, they are data.

## Where each piece lives

| concern | code |
| --- | --- |
| catalogues | `frontend/src/i18n/locales/en.json`, `it.json` |
| the parity type | `frontend/src/i18n/locales/schema.ts` |
| instance, supported locales, initial choice | `frontend/src/i18n/index.ts` |
| the switcher and the persisted choice | `frontend/src/stores/app.ts` |
| the two lint rules | `frontend/eslint.config.ts` |

## Related

- [Notifications](./notifications.md): the text this layer does not reach
- [Frontend Testing](../development/frontend-testing.md): the i18n plugin every mount gets
- [`DESIGN.md`](../../DESIGN.md): the tone the strings are written in
