# Local Development Setup

This document explains how to configure your local environment to run FantasyWiki
with a real Google login and MSW-mocked API data. These files are intentionally
gitignored and must be created manually by each developer.

---

## Overview

The project uses two environment layers:

| File | Location | Purpose |
|------|----------|---------|
| `backend/.dev.vars` | `backend/` | Secrets for Wrangler (backend) |
| `frontend/.env.local` | `frontend/` | Overrides for Vite (frontend) |

Neither file is committed to the repository. Both are loaded automatically by
their respective tools at startup.

---

## Step 1 — Create `backend/.dev.vars`

Create the file at `FantasyWiki/backend/.dev.vars` with the following content:

```ini
GOOGLE_CLIENT_SECRET=<ask a team member>
JWT_SECRET=<any random string, at least 32 characters>
FRONTEND_URL=localhost:5173
WORKERS_CI_BRANCH=
```

**Notes:**
- `GOOGLE_CLIENT_ID` and `FRONTEND_URL` are already in `wrangler.jsonc` for production.
  The `.dev.vars` values override them locally.
- `WORKERS_CI_BRANCH` must be present but empty — this prevents the backend from
  prefixing the branch name onto the frontend URL.
- `JWT_SECRET` can be any random string. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `GOOGLE_CLIENT_SECRET` is sensitive — ask a team member or find it in the
  Google Cloud Console under the OAuth 2.0 client for this project.

---

## Step 2 — Create `frontend/.env.local`

Create the file at `FantasyWiki/frontend/.env.local` with the following content:

```ini
VITE_BACKEND_URL=http://127.0.0.1:8787
VITE_WORKERS_CI_BRANCH=
VITE_MOCK=true
```

**Notes:**
- `VITE_BACKEND_URL` must include `http://` explicitly — without it the frontend
  code adds `https://` automatically, causing an SSL error on localhost.
- `VITE_WORKERS_CI_BRANCH` must be present but empty — without it the frontend
  prefixes `master.` onto the backend URL, pointing to production.
- `VITE_MOCK=true` enables MSW (Mock Service Worker), which intercepts all API
  calls except `/api/session` and `/auth/*`, which pass through to the real
  local backend.

---

## Step 3 — Add Yourself to Google OAuth Redirect URIs

Google blocks logins from unregistered redirect URIs. Each developer must add
their local redirect URI to the Google Cloud Console once.

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Open the OAuth 2.0 Client ID for FantasyWiki
3. Under **Authorized redirect URIs**, add:
   ```
   http://127.0.0.1:8787/auth/google
   ```
4. Save and wait ~1 minute for propagation.

---

## Step 4 — Start the App

Open two terminals:

```bash
# Terminal 1 — backend
cd backend
npx wrangler dev
# Should print: Ready on http://127.0.0.1:8787
```

```bash
# Terminal 2 — frontend
cd frontend
npm run dev
# Should print: Local: http://localhost:5173/
```

Or from the project root using Gradle:

```bash
./gradlew devMock
```

Wait for both "Ready" messages before opening the browser.

---

## How It Works

```
Browser
  │
  ├─ GET /auth/google  ──────────────────► Wrangler (127.0.0.1:8787)
  │                                              │ Google OAuth redirect
  │                                              │ Sets session_token cookie
  │                                              │ Redirects to localhost:5173/auth/callback
  │
  ├─ GET /auth/callback (Vue page)
  │      │
  │      └─ GET /api/session ────────────► Wrangler (127.0.0.1:8787)
  │                                              │ Reads JWT from cookie
  │                                              │ Returns user info
  │
  └─ All other /api/* calls ─────────────► MSW (intercepted in browser)
                                                 Returns mock data from handlers.ts
```

The key insight: MSW uses `passthrough()` for `/api/session` and `/auth/*`,
so those requests reach the real Wrangler backend. Everything else is mocked.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `ERR_SSL_PROTOCOL_ERROR` | `VITE_BACKEND_URL` missing `http://` prefix | Add `http://` explicitly in `.env.local` |
| `redirect_uri_mismatch` | Local URI not registered in Google Console | Follow Step 3 above |
| `401` on `/api/session` | `FRONTEND_URL` in `.dev.vars` still points to production | Check `.dev.vars` exists inside `backend/` and restart Wrangler |
| `master.*.workers.dev` in errors | `VITE_WORKERS_CI_BRANCH` not overridden | Add `VITE_WORKERS_CI_BRANCH=` (empty) to `frontend/.env.local` |
| Backend not reachable | Wrangler not running or wrong port | Run `npx wrangler dev` and check the port in the log |
| Cookie not sent | Browser privacy settings blocking cookies | Use Chrome/Firefox, disable aggressive privacy extensions during dev |

