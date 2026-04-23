# Integration Tests

This directory contains backend integration tests executed inside the Cloudflare Workers runtime through `@cloudflare/vitest-pool-workers`.

## Files

- `player.integration.test.ts`: `PlayerService` behavior against a real D1 binding.

## Running Tests

```bash
# Run Cloudflare runtime integration tests
npm run test:integration

# Run Node unit tests + Cloudflare integration tests
npm run test:run
```

## Database Setup

- D1 schema is applied from `backend/migrations` using `readD1Migrations()` + `applyD1Migrations()`.
- Test data is reset before each test through `src/tests/setup-cloudflare.ts`.
- Tests remain fully local (Miniflare/workerd) and isolated from production databases.
