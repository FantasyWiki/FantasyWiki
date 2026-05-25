# Deploy Strategy and Branch Policy

This document describes the FantasyWiki Cloudflare deployment strategy across local, QA (`dev`), and production (`master`) environments.

---

## Branch Policy

| Branch | Trigger | Deploy | Environments |
|--------|---------|--------|--------------|
| **master** | push / PR | ✅ Production | Prod Workers, Prod Pages, Prod D1 |
| **dev** | push | ✅ QA | `backend-preview`, `frontend` (dev branch), `db-preview` |
| **feature/** | push / PR | ❌ CI only | No deploy |
| **renovate/** | push | ❌ Skip | No deploy (dependency updates) |

---

## CI/CD Workflows

### 1. Dispatcher Workflow (`dispatcher.yml`)
- **Trigger**: `push`, `pull_request`, `workflow_dispatch`
- **Purpose**: route CI/CD execution and call reusable workflows
- **Output**: calls `build.yml` (CI) and `deploy.yml` (deployment flow)

### 2. Build Workflow (`build.yml`)
- **Trigger**: `workflow_call` from `dispatcher.yml`
- **Purpose**:
  - run `./gradlew check` on all branches
  - no deployment logic (CI only)

### 3. Deploy Workflow (`deploy.yml`)
- **Trigger**: `workflow_call`, `workflow_dispatch`
- **Purpose**: deploy backend, frontend, and D1 migrations to explicit target environments
  - `master`: backend `backend`, Pages project `frontend`, D1 `db`
  - `dev`: backend `backend-preview`, Pages project `frontend`, D1 `db-preview`

---

## Cloudflare Environments

### Production (`master`)
- **Backend Worker**: `backend` (`luca0patrignani.workers.dev`)
- **Frontend Pages**: `frontend` (`fantasywiki.pages.dev`)
- **D1 Database**: production database (`db`)
- **Main vars**:
  - `FRONTEND_URL=fantasywiki.pages.dev`
  - `VITE_BACKEND_URL=luca0patrignani.workers.dev`

### QA (`dev`)
- **Backend Worker**: `backend-preview`
- **Frontend Pages**: `frontend` (`dev.fantasywiki.pages.dev`)
- **D1 Database**: preview database (`db-preview`)
- **Main vars**:
  - `FRONTEND_URL=dev.fantasywiki.pages.dev`
  - `VITE_BACKEND_URL=backend-preview.luca0patrignani.workers.dev`

### Local
- **Backend**: `wrangler dev` (`localhost:8787`)
- **Frontend**: `npm run dev` (`localhost:5173`)
- **D1**: local SQLite (`.wrangler/state/v3/d1/`)

---

## Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_D1_MIGRATION_RUNNER_SECRET` | Token used for production D1 migrations |

---

## QA Setup Procedure

### 1. Create Preview D1 Database

```bash
npx wrangler d1 create db-preview --remote
```

Set the returned `database_id` in `backend/wrangler.jsonc` under `env.preview.d1_databases[0].database_id`.

### 2. Apply preview migrations

```bash
cd backend
npx wrangler d1 migrations create db-preview init
npx wrangler d1 migrations apply db-preview --remote
```

### 3. Test QA Deployment

```bash
git push origin dev
```

Then verify the `deploy.yml` workflow in GitHub Actions.

---

## Rollback and Debug

### Production Rollback

```bash
git revert <commit-hash>
git push origin master
```

### QA D1 Debug Query

```bash
npx wrangler d1 execute db-preview "SELECT * FROM users;" --remote
```

### Workflow Logs

https://github.com/luca0patrignani/FantasyWiki/actions

---

## D1 Binding Notes

The `db` binding is declared in Worker configuration and injected by Wrangler at runtime. In backend code:

```typescript
type Bindings = {
  db: D1Database;
  // ...
};

const app = new Hono<{ Bindings: Bindings }>();
```

`c.env.db` resolves to the correct database for each environment.
