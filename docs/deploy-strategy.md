# Deploy Strategy and Branch Policy

This document describes the FantasyWiki Cloudflare deployment strategy across local, QA (`dev`), and production (`master`) environments.

---

## Branch Policy

| Branch | Trigger | Deploy | Environments |
|--------|---------|--------|--------------|
| **master** | push / PR | ✅ Production | Prod Workers, Prod Pages, Prod D1 |
| **dev** | push | ✅ QA | `backend-qa`, `frontend-qa`, QA D1 |
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
  - `dev`: backend `backend-qa`, Pages project `frontend-qa`, D1 via `D1_QA_DATABASE_ID`

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
- **Backend Worker**: `backend-qa`
- **Frontend Pages**: `frontend-qa` (dedicated QA Pages project)
- **D1 Database**: QA D1 database (from `D1_QA_DATABASE_ID`)
- **Main vars**:
  - `FRONTEND_URL=frontend-qa.pages.dev`
  - `VITE_BACKEND_URL=backend-qa.luca0patrignani.workers.dev`

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
| `D1_QA_DATABASE_ID` | QA D1 database ID |

---

## QA Setup Procedure

### 1. Create QA D1 Database

```bash
npx wrangler d1 create fantasydb-qa --remote
```

Save the returned `database_id` as a GitHub repository secret.

### 2. Add GitHub Secret

1. Open: https://github.com/luca0patrignani/FantasyWiki/settings/secrets/actions
2. Click **New repository secret**
3. Name: `D1_QA_DATABASE_ID`
4. Value: `<database_id_from_step_1>`
5. Save

### 3. (Optional) Create and Apply D1 Migrations

```bash
cd backend
npx wrangler d1 migrations create fantasydb-qa init
npx wrangler d1 migrations apply fantasydb-qa --remote
```

### 4. Test QA Deployment

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
npx wrangler d1 execute fantasydb-qa "SELECT * FROM users;" --remote
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
