import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import { JwtPayload } from "../types";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL!;
const FRONTEND_URL = process.env.FRONTEND_URL!;
const JWT_EXPIRES_IN = "7d";

// Configure Passport with the Google OAuth 2.0 strategy.
// We use a stateless approach: no session serialization needed.
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    (_accessToken, _refreshToken, profile: Profile, done) => {
      const user = {
        id: profile.id,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value ?? "",
        picture: profile.photos?.[0]?.value ?? "",
      };
      done(null, user);
    }
  )
);

// Passport session stubs (required even without sessions)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user as Express.User));

/**
 * GET /auth/google
 * Redirects the browser to Google's OAuth consent screen.
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

/**
 * GET /auth/google/callback
 * Google redirects here after the user grants/denies consent.
 * On success, issues a signed JWT and redirects the browser back to
 * the frontend with the token as a query parameter.
 */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=auth_failed`,
  }),
  (req, res) => {
    const user = req.user!;
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.displayName,
      picture: user.picture,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

/**
 * GET /auth/google/exchange?code=<code>
 * Exchanges a Google OAuth2 authorization code for a signed JWT.
 * Used when the Google callback URL points to the frontend, which then
 * forwards the code here.
 */
router.get("/google/exchange", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).json({ error: "Missing code parameter" });
    return;
  }

  try {
    // Exchange the authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      id_token?: string;
      error?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      res.status(401).json({ error: tokenData.error ?? "Token exchange failed" });
      return;
    }

    // Fetch user profile using the access token
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfo = (await userRes.json()) as {
      id?: string;
      name?: string;
      email?: string;
      picture?: string;
      error?: unknown;
    };

    if (!userRes.ok || !userInfo.id) {
      res.status(401).json({ error: "Failed to fetch user info" });
      return;
    }

    const payload: JwtPayload = {
      sub: userInfo.id,
      email: userInfo.email ?? "",
      name: userInfo.name ?? "",
      picture: userInfo.picture ?? "",
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /auth/me
 * Returns the authenticated user's profile.
 * Requires a valid Bearer JWT in the Authorization header.
 */
import { requireAuth } from "../middleware/requireAuth";

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/**
 * POST /auth/logout
 * Stateless: the client simply discards the token.
 * This endpoint exists for API completeness.
 */
router.post("/logout", (_req, res) => {
  res.json({ message: "Logged out successfully" });
});

export default router;
