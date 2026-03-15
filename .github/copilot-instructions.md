# Copilot Instructions

## Architecture

Gradle-orchestrated monorepo with two subprojects:

- **`frontend/`** — Vue 3 + Ionic + Vite + TypeScript SPA. Uses Pinia for state, Vue Router (Ionic-flavored), and Vitest for unit tests.
- **`backend/`** — Express + TypeScript REST API. Stateless Google OAuth2 via Passport + JWT. No sessions.

The root `build.gradle.kts` delegates `check` and `dev` tasks to both subprojects. The frontend and backend each have their own `package.json`.

## Commands

### Root (runs both frontend + backend)
```bash
./gradlew check           # lint + test both subprojects
./gradlew dev --parallel  # start both dev servers concurrently
```

### Frontend (`cd frontend`)
```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # vue-tsc + vite build
npm run test-unit    # run all Vitest unit tests
npm run lint         # ESLint
npm run format       # Prettier check
npm run format:fix   # Prettier autofix
npm run g:component  # Plop scaffold: new Vue component + test file
```

Run a single test file:
```bash
npx vitest run src/tests/NavBar.spec.ts
```

### Backend (`cd backend`)
```bash
npm run dev    # tsx watch (hot reload)
npm run build  # tsc
npm run start  # node dist/index.js
```

## Key Conventions

### Services
All services have a separate gradle project. It must work even without the parent project. Each gradle project has a "check" task, which runs linting, formatting and uni testing.
The parent component also as a task called "check", which calls all the tasks "check" of the subproject.

### Frontend

- **Path alias**: `@` maps to `frontend/src/`. Always use `@/` instead of relative paths when importing from `src/`.
- **Component tags**: Use kebab-case in templates (e.g., `<app-logo>`, not `<AppLogo>`).
- **Scaffolding**: Use `npm run g:component` (Plop) to create new Vue components. It generates both the `.vue` file under `src/views/` and a matching `.spec.ts` under `src/tests/`.
- **Prettier**: double quotes, `semi: true`, `trailingComma: "es5"`, 2-space indent.

### Pinia Stores

Stores use the composition API style (`defineStore("id", () => { ... })`). Sections are separated by `// ========== STATE ==========`, `// ========== GETTERS ==========`, `// ========== ACTIONS ==========` comments. State that must persist across reloads is synced to `localStorage` manually inside actions.

### Vitest / Testing

`frontend/src/tests/setup.ts` spies on `console.warn` and `console.error` and **throws** if either is called. Every test (and the components they mount) must not emit any warnings or errors.

Component test pattern:
```ts
it("should mount without errors", async () => {
  await router.push("/");
  await router.isReady();
  const wrapper = mount(MyComponent, {
    global: { plugins: [router, pinia] },
  });
  expect(wrapper.exists()).toBe(true);
});
```

### Auth

- Auth is **stateless JWT** (7-day expiry, signed with `JWT_SECRET`).
- The frontend reads the JWT payload client-side (`decodeJwtPayload`) only for UX purposes (populating `currentUser`, detecting obvious expiry). Signature verification happens exclusively in the backend `requireAuth` middleware.
- The auth token is stored in `localStorage` under the key `auth_token`.
- Protected backend routes use the `requireAuth` middleware, which expects `Authorization: Bearer <token>`.

### Theming

Custom Ionic CSS variables are defined in `frontend/src/theme/variables.css`. Use `--ion-color-wiki-gold` for gold accents (not `--wiki-gold`). Primary color is Wikipedia Green (`#1e7e50`).

### Environment Variables

Backend requires a `.env` file (see `backend/.env.example`):
- `PORT`, `FRONTEND_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`

Frontend has its own `frontend/.env.example`.

## Authentication Flow

### High-Level Flow

1.  **Frontend (Login)**:
    - User clicks "Sign in with Google".
    - Browser redirects to `backend/auth/google`.
2.  **Google & Backend (Handshake)**:
    - Passport.js redirects the user to Google's consent screen.
    - Upon approval, Google redirects back to `backend/auth/google/callback`.
    - The backend verifies the Google profile, generates a **JWT** (signed with `JWT_SECRET`, valid for 7 days), and redirects to the frontend with the token in the URL: `frontend/auth/callback?token=...`.
3.  **Frontend (Storage)**:
    - The `AuthCallbackPage` extracts the token.
    - The token is stored in `localStorage` (key: `auth_token`) and Pinia state (`appStore`).
    - The token payload is decoded to display user info (name, picture).
4.  **Authenticated Requests**:
    - **Backend**: Protected routes use the `requireAuth` middleware, which expects an `Authorization: Bearer <token>` header.
    - **Frontend**: Currently, the frontend **does not automaticallly attach** this header to API requests. You will need to add an interceptor or manually include it for protected endpoints.

### Key Components

*   **Backend Strategy**: `passport-google-oauth20` in `backend/src/routes/auth.ts`.
*   **Token Generation**: `jwt.sign(payload, process.env.JWT_SECRET)` in the callback.
*   **Protection Middleware**: `requireAuth` in `backend/src/middleware/requireAuth.ts` verifies the signature.
*   **Frontend Store**: `frontend/src/stores/app.ts` handles `setUser` and `logout`.

