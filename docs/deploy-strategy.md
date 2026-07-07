# Deploy Strategy and Branch Policy

This document describes the FantasyWiki Cloudflare deployment strategy across local, QA (`master`), and production (version tag) environments.

---

## Branch / Tag Policy

| Ref | Trigger | Deploy | Environments |
|-----|---------|--------|--------------|
| **master** (branch) | push / PR | ✅ QA | `backend-preview`, `frontend` (dev branch), `db-preview` |
| **v\*** (tag) | push (tag creation) | ✅ Production | Prod Workers, Prod Pages, Prod D1 |
| **feature/** | push / PR | ❌ CI only | No deploy |
| **renovate/** | push | ❌ Skip | No deploy (dependency updates) |

Every commit on `master` is automatically deployed to `dev.fantasywiki.pages.dev` (QA). Once a feature on `master` is confirmed working, create a `v*` tag (e.g. `v1.2.0`) pointing at that commit — pushing the tag deploys that exact commit to production (`fantasywiki.pages.dev`).

```bash
git tag v1.2.0
git push origin v1.2.0
```

---

## CI/CD Workflows

### 1. CI/CD Workflow (`ci-cd.yml`)
- **Trigger**: `push` (branches and tags), `pull_request`, `workflow_dispatch`
- **Purpose**: route CI/CD execution and call reusable workflows
- **Output**: calls `check.yml` (CI) and `deploy.yml` (deployment flow)

### 2. Check Workflow (`check.yml`)
- **Trigger**: `workflow_call` from `ci-cd.yml`
- **Purpose**:
  - run `./gradlew check` on all branches and tags
  - no deployment logic (CI only)

### 3. Deploy Workflow (`deploy.yml`)
- **Trigger**: `workflow_call`, `workflow_dispatch`
- **Purpose**: deploy backend, frontend, and D1 migrations to explicit target environments
  - `master` (branch push): backend `backend-preview`, Pages project `frontend`, D1 `db-preview`
  - `v*` (tag push): backend `backend`, Pages project `frontend`, D1 `db`

---

## Cloudflare Environments

### Production (`v*` tag)
- **Backend Worker**: `backend` (`luca0patrignani.workers.dev`)
- **Frontend Pages**: `frontend` (`fantasywiki.pages.dev`)
- **D1 Database**: production database (`db`)
- **Main vars**:
  - `FRONTEND_URL=fantasywiki.pages.dev`
  - `VITE_BACKEND_URL=luca0patrignani.workers.dev`

### QA (`master`)
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
git push origin master
```

Then verify the `deploy.yml` workflow in GitHub Actions.

---

## Rollback and Debug

### Production Rollback

Re-tag a known-good commit on `master` and push it; pushing a `v*` tag always (re)deploys production from that commit.

```bash
git tag v1.2.1 <known-good-commit-hash>
git push origin v1.2.1
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
