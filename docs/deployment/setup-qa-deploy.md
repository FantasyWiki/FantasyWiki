---
title: Setup QA Deploy
type: deployment
tags: [cloudflare, qa, d1, how-to]
---

# Setup QA Deploy

Quick guide to enable automatic QA deployment on branch `dev` with a dedicated QA D1 database.

---

## Prerequisites

- Cloudflare account with Workers and Pages enabled
- GitHub repository with GitHub Actions enabled
- Local `wrangler` CLI (v4.80.0+)

---

## Step 1: Create the QA D1 Database

Run locally:

```bash
cd backend
npx wrangler d1 create fantasydb-qa --remote
```

Expected output:

```
✓ Created new D1 database 'fantasydb-qa'
Created D1 database 'fantasydb-qa' with ID: 12345678-1234-1234-1234-123456789012
```

Save the `database_id` (example: `12345678-1234-1234-1234-123456789012`).

---

## Step 2: Add GitHub Secret

1. Go to: https://github.com/luca0patrignani/FantasyWiki/settings/secrets/actions
2. Click "New repository secret"
3. **Name**: `D1_QA_DATABASE_ID`
4. **Value**: paste the database ID from Step 1
5. Click "Add secret"

---

## Step 3: Verify Existing Secrets

Make sure these secrets already exist:

- `CLOUDFLARE_API_TOKEN` — da https://dash.cloudflare.com/profile/api-tokens
- `CLOUDFLARE_ACCOUNT_ID` — da https://dash.cloudflare.com (Account ID)

If any are missing, add them with the same process as Step 2.

---

## Step 4: Create the QA Pages Project

1. Create a Cloudflare Pages project named `frontend-qa`
2. Use the same build/output settings as the production project `frontend`

---

## Step 5: Create Branch `dev`

```bash
git checkout -b dev
git push origin dev
```

GitHub Actions will automatically run the `deploy.yml` workflow.

---

## Step 6: Verify Deployment

Go to: https://github.com/luca0patrignani/FantasyWiki/actions

Find the "Deploy" workflow. The following jobs should pass:
- ✅ check
- ✅ deploy-backend (matrix: dev)
- ✅ deploy-frontend (matrix: dev)
- ✅ migrate-d1 (matrix: dev)

If `migrate-d1` fails on `dev`, ensure:
1. `D1_QA_DATABASE_ID` is configured (Step 2)
2. The QA database exists on Cloudflare (`wrangler d1 list --remote`)

---

## Manual Trigger

If you need to deploy QA without a push:

1. Open: https://github.com/luca0patrignani/FantasyWiki/actions/workflows/deploy.yml
2. Click "Run workflow"
3. Select branch: `dev`
4. Click "Run workflow"

---

## QA Rollback

If QA is broken:

```bash
git revert <commit-hash>
git push origin dev
```

The workflow will redeploy with the reverted code.

---

## QA Target Environment

After deployment, QA is available on:

- **Backend API**: `backend-qa.luca0patrignani.workers.dev/api`
- **Frontend**: domain associated with the `frontend-qa` Pages project
- **Database**: `fantasydb-qa` (D1 remote)

---

## Troubleshooting

### `migrate-d1` job fails

```
ERROR: D1_QA_DATABASE_ID secret is not set
```

**Fix**: add `D1_QA_DATABASE_ID` as a GitHub secret (Step 2).

### QA backend cannot reach frontend

If you see CORS or redirect issues, check:
- `backend/wrangler.jsonc` QA env vars (`FRONTEND_URL`)
- local frontend env points to the local backend (`VITE_BACKEND_URL=http://127.0.0.1:8787`) during local testing

### Frontend cannot reach QA backend

If build or runtime fails due to backend URL:
- verify `deploy-frontend` (dev branch entry) uses `VITE_BACKEND_URL: backend-qa.luca0patrignani.workers.dev`

---

## Next Steps

1. [Read the full deploy strategy](./deploy-strategy.md)
2. [Configure D1 migrations (optional)](../../backend/README.md#type-generation)
3. Validate on `dev` before opening a PR to `master`

## Related

- [Deploy Strategy & Branch Policy](./deploy-strategy.md)
- [Dev Branch & QA Deployment](./dev-branch-deployment.md)
