---
title: Frontend Testing
type: development
tags: [testing, frontend, vitest, msw, conventions]
---

# Frontend testing

Every frontend test runs in **vitest + jsdom**, mounts real components, and talks
to a real HTTP layer that MSW answers. **The default is to stub a network
response, not a module** — the app's own service layer, stores and composables
stay in the test. `vi.mock` is reached for only where the collaborator is not
HTTP the app controls: the Wikimedia client a component calls directly, and the
handful of service modules whose behaviour a spec needs to steer per case.

**What these tests are for is narrower than the backend suite's.** The game's
rules are asserted where they are implemented — in `model/`, `dto/` and the
backend tiers — and the frontend specs are **regression smoke**: that a page
mounts, renders what its data says, and reacts to the interaction it exists for.
Asserting a rule a second time through the DOM would not make it truer, and it
would make every rule change a two-suite edit. This is why the frontend's
coverage figure is the lowest of the three and is expected to be
([Backend Testing](./backend-testing.md) is the rigorous one).

```bash
cd frontend
npm test                              # the whole suite, once
npm run hot-test                      # watch mode
npx vitest run src/tests/auth/LoginPage.spec.ts
```

## What every mount already has

`src/tests/setup.ts` registers globally, so a spec that does not care can just
mount:

- a **Pinia** instance, fresh after each test;
- **VueQuery** with retries off and no cache lifetime;
- the **i18n** instance, so assertions can be written against real strings;
- a `matchMedia` stub, because jsdom ships none and the app store reads it on
  creation to fall back to the OS theme.

A spec that cares about cache isolation still builds its **own** `QueryClient`
and passes it through `mountOptions.global`. The global one is a safety net for
specs that do not, not a shared fixture to rely on.

MSW runs with **`onUnhandledRequest: "error"`**. A request no handler covers
fails the test rather than reaching the network. That is the rule that keeps the
suite honest about what the app actually calls: adding a fetch to a page and
forgetting it is a red test, not a silent live request.

## Fixtures, and stubbing one response

`src/mocks/` is the app's mock backend, not a test folder: `handlers.ts` answers
every route the app calls, from data in `mocks/data/`. The same handlers serve
`VITE_MOCK=true` in the browser ([Local Development Setup](./local-dev-setup.md)),
so a fixture that is wrong is wrong in both places at once — which is the point.

The fixtures are shaped to double as edge cases. `mocks/data/leagues.ts` dates
all but one league in the past, so the same list is both the active-league and
the ended-league fixture and no spec has to invent a second one.

Override per test with `server.use(...)`, which `setup.ts` resets after every
test:

```ts
server.use(
  http.get("*/api/leagues", () => HttpResponse.json(leagues.filter(mine)))
);
```

Match on `*/api/...`, not an absolute URL: the base comes from
`VITE_BACKEND_URL`, which the vitest config sets.

Where a spec does mock a module, `vi.hoisted` is what makes the mock's functions
assertable — a `vi.mock` factory is hoisted above the file's own `const`s, so a
plain one is not defined yet when the factory runs.

## Two constraints that cost a debugging session each

**Route guards get their own spec file.** The router and the stores a guard reads
are module singletons, so in a file that also mounts pages an earlier test's
state survives into the guard and decides the outcome instead of the handler the
test just installed. A guard test is a navigation, not a mount —
`router.push(path)` and then read `router.currentRoute` — and it belongs in a
file that does nothing else (`TeamCreationGuard.spec.ts`, `routerAuthGuard.spec.ts`).

**Unmount a page that watches the route or polls.** A spec that mounts one of
those and never unmounts it leaves a live watcher behind; the suite then hangs
rather than failing, which is far harder to attribute. The pattern is an
`afterEach` that unmounts whatever the test mounted — see `LeaguePage.spec.ts`,
`LeaguesPage.spec.ts`, `RivalTeamPage.spec.ts`.

## Where a test goes

| Subject | Where |
| --- | --- |
| a page, a component | `src/tests/<Name>.spec.ts`, or a subfolder for a feature area |
| a composable | `src/tests/use<Name>.spec.ts` — mounted in a host component, never called bare |
| a router guard | its own file, no mounts |
| a DTO or a pure helper | `src/tests/<name>.spec.ts`, no MSW involved |
| a rule of the game | **not here** — `model/`, or the backend suite |

`npm run g:component` scaffolds a view and its spec together, so the pairing is
the default rather than a discipline.

## Coverage

v8 provider, reported as `text`, `json-summary` and `lcov`, over `src/**/*.{ts,vue}`.
Excluded: `src/mocks/**` (the harness), `src/tests/**`, and `src/main.ts` (the
bootstrap no spec drives). **No threshold is configured here** — Codecov gates the
project total, and a second gate in a second place is a second thing to keep in
step.

## Related

- [Backend Testing](./backend-testing.md) — the suite that does carry the rules
- [Local Development Setup](./local-dev-setup.md) — the same MSW handlers, in the browser
- [Frontend Query Keys](../architecture/frontend-query-keys.md) — what a cache-isolating spec is isolating
- [Frontend Localisation](../architecture/frontend-localisation.md) — why real strings are assertable
