```txt
npm install
npm run dev
```

## Deployment

### Production Deployment

Deploy to production (main branch):

```txt
npm run deploy
```

### Preview Deployment

Deploy to preview environment (feature branches):

```txt
npm run deploy:preview
```

The preview environment allows you to test changes on a separate worker instance before merging to main. Each branch preview will be deployed as `backend-preview` on Cloudflare Workers.

## Type Generation

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```

## Environment Configuration

The project uses two environments:

- **Production** (`wrangler.jsonc` root): Deploys to `backend` worker (main branch)
- **Preview** (`wrangler.jsonc` → `env.preview`): Deploys to `backend-preview` worker (feature branches)

Both environments can have different configurations (variables, KV namespaces, R2 buckets, etc.)
