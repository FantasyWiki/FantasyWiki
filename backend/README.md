# Backend

## Development

```txt
npm install
npm run dev
```

## Testing

The backend test suite currently focuses on Cloudflare runtime integration tests
configured in `vitest.config.ts`.

```txt
# Integration tests (watch)
npm run test

# Integration tests (single run)
npm run test:integration

# Backend test command used by Gradle check
npm run test:run
```

Cloudflare integration tests use `@cloudflare/vitest-pool-workers` and:

- load Worker config from `wrangler.jsonc`
- apply D1 migrations from `migrations/` via `applyD1Migrations`
- reset D1 test data before each test

## Deployment

Deploy to Cloudflare Workers:

```txt
npm run deploy
```

## Type Generation

Generate and sync Worker runtime/bindings types:

```txt
npm run cf-typegen
```

Pass `CloudflareBindings` as generic when instantiating `Hono`:

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```

## Environment Configuration

- `wrangler.jsonc` defines the base Worker (`backend`) and D1 binding (`db`).
- `wrangler.jsonc` also defines the `preview` environment used for preview deployment (`backend-preview`) with its own bindings/vars.
