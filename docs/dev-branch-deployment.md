# Master Branch and QA Deployment / Production Release via Tags

This document explains how QA deployment works on `master` and how production releases are cut via version tags.

## Purpose of the `master` Branch

Every push to `master` deploys to the cloud **quality assurance** environment:
- it validates frontend, backend, and database integration in a real remote setup
- it catches deployment/configuration issues before a production release

## Branch / Tag Policy

- `master` (branch push) → **QA**
- `v*` (tag push, e.g. `v1.2.0`) → **production**
- `feature/*` → no deployment (CI only)

## Deployment Workflow

Deployment is handled by a single reusable workflow:

- file: `.github/workflows/deploy.yml`
- trigger path: called from `ci-cd.yml` on repository events
- manual trigger: `workflow_dispatch`

## What Gets Deployed on `master`

When `master` is pushed, the workflow deploys:

1. **QA Backend Worker**
   - worker name: `backend-preview`
   - deploy command uses `--env=preview`

2. **QA Frontend**
   - Cloudflare Pages project: `frontend` (deployed as the dev branch alias, `dev.fantasywiki.pages.dev`)
   - frontend build variable: `VITE_BACKEND_URL=https://backend-preview.luca0patrignani.workers.dev`

3. **QA D1 Database**
   - remote migrations applied to preview D1
   - database name passed to migration step: `db-preview`

## What Gets Deployed on a `v*` Tag

When a tag matching `v*` is pushed, the workflow deploys:

1. backend `backend`
2. frontend Pages project `frontend` (production, `fantasywiki.pages.dev`)
3. D1 migrations on production database `db`

## Required GitHub Secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_MIGRATION_RUNNER_SECRET` (production D1 migrations)

## Recommended Delivery Flow

1. develop on feature branches
2. merge to `master` for full cloud QA validation
3. once verified on QA, push a `v*` tag pointing at that `master` commit for production release:

   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```
