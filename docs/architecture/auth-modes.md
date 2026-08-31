---
title: Auth Modes
type: architecture
tags: [backend, auth, security, builds, layering]
related:
  - "[[backend-architecture]]"
  - "[[persistence-targets]]"
  - "[[backend-testing]]"
---

# Auth Modes

There are three ways into the app, and **not every build has all three**:

| | Google OAuth | `/auth/dev` | username/password |
|---|---|---|---|
| Deployed Worker (`wrangler.jsonc`) | yes | mounted, 404s | **not in the bundle** |
| Local MongoDB run (`wrangler.mongo.jsonc`) | yes | yes | yes |

All three produce **the same session**, same claims, same secret, same
`session_token` cookie, so nothing below the routes knows which door a player
came through. `sub` is an account id, and `routes/currentPlayer.ts` resolves the
player from it with `getPlayerByAccountId`, which does not care what kind of
account it was.

## Why absence, and not a flag

Username/password sign-in adds a credential store, a password hasher and a
public register/login pair. On a deployment reachable from the internet that is
a real expansion of what can be attacked: credential stuffing, user enumeration,
hash-CPU exhaustion, and, if the hashing came from npm, a supply-chain
dependency in the login path.

So the requirement is not *disabled in production*. It is **not present in
production**.

A binding cannot deliver that. A Worker's `env` is a runtime value, so

```ts
if (env.AUTH_PASSWORD) app.route("/auth", passwordAuth) // ← does not work
```

is a branch esbuild cannot prove dead. The handlers, the hasher and the
credential repository are bundled and shipped either way; all the flag decides
is whether they answer. Absence has to come from the module graph.

## Two entry points

`main` is a per-file wrangler key, so the two configs name different modules:

```
src/app.ts             createApp(), every route both builds serve
├── src/index.ts               ← wrangler.jsonc       (deployed)
└── src/indexPassword.ts       ← wrangler.mongo.jsonc (local)
        app.route("/auth", passwordAuth)
```

`src/index.ts` imports nothing under `src/auth/**`, nothing from
`routes/passwordAuth.ts`, and nothing from `passwordComposition.ts`. There is no
bundler cleverness to trust and no alias key to keep in sync: the code is
absent because nothing imports it, which is a fact you can check by reading two
short files.

`createApp` deliberately takes no argument saying which build it is in. It
imports only what every build has; an entry point *adds* by importing.

### Why not `alias`, which already removes the Mongo driver

[Persistence Targets](./persistence-targets.md) drops the MongoDB driver from
the deployed bundle with wrangler's `alias`, and the same trick would work here,
its plugin keys on the import specifier as written, relative paths included.
It is the weaker tool for this job on three counts:

- It **substitutes rather than removes**. The deployed build would still carry a
  mount call and a stub module.
- A key that stops matching: someone moves the router, the specifier changes,
  fails **silently**, shipping the real router.
- The Vitest pool resolves through Vite, not esbuild, so the alias never applies
  in tests. No test could observe the difference.

Absence by non-import has none of those properties, and it is assertable.

## The four gates

1. **Not in the module graph.** The deployed entry does not import it.
2. **No store to talk to.** No D1 migration creates a credentials table, and
   there is no D1 implementation of `CredentialRepository`, there cannot be one
   while `players.accountId` is a foreign key onto `google_accounts`
   (migration 0001).
3. **A test that fails when it leaks.** `tests/routes/openapi.spec.ts` imports
   *both* entry points and asserts that the deployed one mounts none of the
   operations `openapi.yaml` marks `x-build: mongo`, and that the two route
   tables are otherwise equal. An anti-vacuity test pins the marked set, so a
   misspelled extension cannot quietly make the guard assert nothing.
4. **No path in from the deployed frontend.** `frontend/functions/auth/` holds
   only `google.ts`. With no `password.ts` beside it, Pages never routes
   `/auth/password/*` to the Worker, the same "neither side has to trust the
   other" argument the dev login already makes.

The route-table test is not a bundle test: code can be imported without being
mounted. What proves the bundle is a dry-run and a grep:

```bash
cd backend
npx wrangler deploy --env production --dry-run --outdir /tmp/d1-bundle --minify
grep -ric "Invalid username or password\|PBKDF2\|auth/password" /tmp/d1-bundle/
```

It runs without Cloudflare credentials. The only password-adjacent string that
*should* appear is `password_credentials`, the collection name in
`repositories/mongo/schema.ts`, see below.

## Where the credential store lives

`Repositories` and `composition.ts` are untouched. The credential store is its
own contract with its own composition function, so the persistence seam stays
about persistence:

| File | Role |
|---|---|
| `src/auth/password/credentialRepository.ts` | The contract and `PASSWORD_ERRORS` |
| `src/auth/password/hash.ts` | PBKDF2 derive/verify, WebCrypto only |
| `src/repositories/mongo/credentialRepositoryMongo.ts` | The one implementation, **not** re-exported from `repositories/mongo/index.ts`, which the deployed entry does reach |
| `src/passwordComposition.ts` | `credentialsFor(env)`, reached only from `routes/passwordAuth.ts`, and so only from the entry that mounts it |
| `src/routes/passwordAuth.ts` | The router |

The collection **is** named in `repositories/mongo/schema.ts` with the rest of
the schema, which puts one string into the deployed bundle. That is deliberate:
keeping it out would split the Mongo schema description in two and silently
break `MongoTestStore.reset()`, which empties exactly `Object.values(COLLECTIONS)`,
credentials would then survive `beforeEach` and leak between tests in a file.
A collection name is not attack surface; the hashing, the lookup and the routes
are, and those are absent.

### Registration is one transaction

`register` writes the credential document and the `players` document together,
on one store. Both or neither: a player with no credential could never sign in
again, a credential with no player would sign in to nothing, and there is no way
back from either, `PlayerRepository` has no delete.

It does **not** go through `LoginService.loginWithGoogleAccount`. That path
auto-suffixes on a taken username, up to 1000 attempts, which is right for
Google (the user never chose the name) and wrong here: the name is the
registrant's choice and only they can change it, so a clash is reported.

Both account kinds share one username space, because they share the `players`
table that `players.username` is unique on.

### One connection per request still holds

`credentialsFor` builds a second `MongoStore`, but not a second connection:
`MongoStore` connects lazily, and a request that signs in never dereferences
`c.var.repositories`. Keep it that way, a password handler that also needed the
domain repositories would make it two connections *and* lose the
cross-collection transaction. And as everywhere on this target, call
`credentialsFor(c.env)` **inside the handler**: a client cached across requests
hangs every request after the one that opened it, and the suite cannot catch it
(see [Persistence Targets](./persistence-targets.md)).

## Password handling

- **PBKDF2-HMAC-SHA256 via `crypto.subtle`, no new dependency.** Argon2id is the
  better algorithm, but every Argon2 build for this runtime is a WASM package,
  the supply-chain expansion this whole design exists to avoid. WebCrypto is
  already in every build and costs nothing.
- Records are **self-describing**: `pbkdf2$sha256$<iters>$<salt>$<hash>`, and
  verification reads the parameters off the record, never off today's constants.
  Raising the cost applies to new passwords without invalidating stored ones.
- Constant-time comparison uses `timingSafeEqual` from `hono/utils/buffer`,
  already the repo's tool for the scoring ingest token.
- An unknown username is verified against a **dummy record** and answered with
  the same error as a wrong password, so neither timing nor response shape says
  who has an account.
- **A password has no floor and no composition rules**: any string is accepted,
  empty included. Minimums and "must contain a digit" push people towards
  `Password1!` and buy less entropy than length does.
- **It does have a ceiling, and that one is not a rule about passwords.** The
  whole submitted string is fed to PBKDF2, so cost grows with length and an
  unbounded password is unbounded CPU on an unauthenticated endpoint. The 4KB
  body limit bounds it too, but coarsely and one layer up, where raising it for
  an unrelated reason would silently widen this, so the limit is stated where
  it is meant, at 200 characters. Both it and the username pattern live in
  `dto/passwordAuthDTO.ts` as `PASSWORD_RULES`, shared with the frontend so hint
  text and a `maxlength` cannot promise a rule the validator does not honour.
- **A 400 names the rule; a 401 never names the half that was wrong.** These
  pull in opposite directions and only one of them is a security question. What
  a login must not reveal is *who has an account*, and neither
  `USERNAME_INVALID` nor `PASSWORD_TOO_LONG` reveals anything about anyone, so
  those are named, and the form can point at the field.
- The **origin check is written out** rather than taken from `hono/csrf`. That
  middleware only fires when the content-type is one an HTML form can send, and
  lets `application/json` through on the reasoning that a cross-site JSON post is
  preflighted and therefore refused. That reasoning does not hold here: the CORS
  layer in `app.ts` reflects whatever origin asks *and* allows credentials, so
  the preflight succeeds and the request arrives with the victim's cookies.

There is **no rate limiting**, unlike the join and report routes. This build is
never deployed, so there is no internet-facing endpoint to protect and no shared
quota to burn.

## What a password session does not have

A password account is registered with a username and a password and nothing
else, so its session carries **no `email` claim**, `SessionDTO.email` is
optional for that reason, and the two places that display it
(`SettingsMenu.vue`, `LogoutConfirmPage.vue`) omit the line rather than render a
blank one. Collecting an unverifiable address with nowhere to send anything
would be a field that only looks like data.

## Running it

```bash
./gradlew devMongo      # backend on wrangler.mongo.jsonc, frontend beside it
```

and in `frontend/.env.local`, `VITE_PASSWORD_AUTH=true` to show the form. Both
halves are needed, and neither trusts the other.

`npm run dev`, `./gradlew dev` and the Compose stack are all the D1 build and
have **no** password sign-in; `/auth/dev` remains the no-Google story there.

## Tests

`*.password.test.ts` is collected only by the Mongo run (`vitest.shared.ts`), the
mirror of the existing `*.d1.test.ts` line. It is named for the feature rather
than the target because this is a *build* distinction that happens to coincide
with MongoDB. A password test named `*.spec.ts` or `*.integration.test.ts` would
run in the D1 pass too, and fail there.

The hashing itself is a `.spec.ts`, pure WebCrypto, nothing to seed, and the one
part of this that both builds can compile.

## Related

- [Sessions and Sign-in Doors](./sessions.md): the session every door mints, and the guards that read it
- [Backend Architecture](./backend-architecture.md): the layering both entries share
- [Persistence Targets](./persistence-targets.md): why the password build is the MongoDB one
