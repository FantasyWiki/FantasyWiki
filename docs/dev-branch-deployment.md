# Dev Branch and QA Deployment

This document explains what the `dev` branch is used for and how QA deployment works on Cloudflare.

## Purpose of the `dev` Branch

The `dev` branch is the cloud **quality assurance** environment:
- it validates frontend, backend, and database integration in a real remote setup
- it catches deployment/configuration issues before merging to `master`

## Branch Policy

- `master` → **production**
- `dev` → **QA**
- `feature/*` → no deployment (CI only)

## Deployment Workflow

Deployment is handled by a single reusable workflow:

- file: `.github/workflows/deploy.yml`
- trigger path: called from `dispatcher.yml` on repository events
- manual trigger: `workflow_dispatch`

## What Gets Deployed on `dev`

When `dev` is deployed, the workflow deploys:

1. **QA Backend Worker**
   - worker name: `backend-qa`
   - deploy command uses `--env=dev` with QA-specific `wrangler` env config

2. **QA Frontend**
   - dedicated Cloudflare Pages project: `frontend-qa`
   - frontend build variable: `VITE_BACKEND_URL=backend-qa.luca0patrignani.workers.dev`

3. **QA D1 Database**
   - remote migrations applied to QA D1
   - selected through GitHub secret `D1_QA_DATABASE_ID`

## What Gets Deployed on `master`

When `master` is deployed, the workflow deploys:

1. backend `backend`
2. frontend Pages project `frontend` (production)
3. D1 migrations on production database `db`

## Required GitHub Secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_MIGRATION_RUNNER_SECRET` (production D1 migrations)
- `D1_QA_DATABASE_ID` (QA D1 database)

## Recommended Delivery Flow

1. develop on feature branches
2. merge to `dev` for full cloud QA validation
3. merge to `master` for production release
