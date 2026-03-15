# Auth0 Migration Plan

This plan outlines the steps to migrate the application from Passport + Google OAuth to Auth0.

## Problem
The current authentication system uses Passport.js with Google OAuth strategy, manually issuing JWTs signed with a local secret. This requires maintaining security-critical code for token issuance and verification.

## Solution
Replace the custom authentication flow with Auth0:
- **Frontend**: Use `@auth0/auth0-vue` SDK for login/logout and token management.
- **Backend**: Use `express-oauth2-jwt-bearer` middleware to verify Auth0 Access Tokens.
- **Architecture**: Move from server-side OAuth flow (Authorization Code) to SPA flow (PKCE) managed by the frontend SDK.

## Steps

### Phase 1: Backend Migration
- [ ] Install `express-oauth2-jwt-bearer` and remove `passport` dependencies
- [ ] Create `backend/src/middleware/checkJwt.ts` to replace `requireAuth.ts`
- [ ] Update `backend/src/routes/auth.ts` (remove Google strategy routes, keep /me if needed for user profile syncing, or remove entirely if frontend gets profile from ID token)
- [ ] Update protected routes to use the new middleware

### Phase 2: Frontend Migration
- [ ] Install `@auth0/auth0-vue`
- [ ] Configure Auth0 plugin in `frontend/src/main.ts`
- [ ] Update `frontend/src/views/auth/LoginPage.vue` to use `loginWithRedirect`
- [ ] Update `frontend/src/views/auth/AuthCallbackPage.vue` (or remove if handled by SDK router guard)
- [ ] Update `frontend/src/stores/app.ts` to use `useAuth0` composable
- [ ] Add an HTTP interceptor (or update API calls) to attach the Access Token to requests

### Phase 3: Cleanup
- [ ] Remove unused dependencies (`passport`, `passport-google-oauth20`, `jsonwebtoken`)
- [ ] Remove unused environment variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`)
- [ ] Verify full login/logout flow

## Requirements
- Auth0 Tenant Domain & Client ID
- API Identifier (Audience) for the backend
