import { Hono } from "hono";
import { googleAuth } from "@hono/oauth-providers/google";
import { sign } from "hono/jwt";
import { JWTPayload } from "hono/utils/jwt/types";
import { setCookie } from "hono/cookie";
import { LoginService } from "../services/login";

type Bindings = {
  db: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
};

export function resolveFrontendUrl(env: Bindings): string {
  let url = env.FRONTEND_URL ?? "localhost:5173";

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    const isLocal = url.startsWith("localhost") || url.startsWith("127.");
    url = (isLocal ? "http://" : "https://") + url;
  }
  return url;
}

const auth = new Hono<{ Bindings: Bindings }>();

auth.use("/google", async (c, next) => {
  if (!c.env.GOOGLE_CLIENT_ID) {
    return c.json({ error: "Missing OAuth GOOGLE_CLIENT_ID" }, 500);
  }
  if (!c.env.GOOGLE_CLIENT_SECRET) {
    return c.json({ error: "Missing OAuth GOOGLE_CLIENT_SECRET" }, 500);
  }
  const handler = googleAuth({
    client_id: c.env.GOOGLE_CLIENT_ID,
    client_secret: c.env.GOOGLE_CLIENT_SECRET,
    scope: ["openid", "email", "profile"],
    redirect_uri: `${resolveFrontendUrl(c.env)}/auth/google`,
  });
  return handler(c, next);
});

auth.get("/google", async (c) => {
  const oauthToken = c.get("token");
  const user = c.get("user-google");

  const frontendUrl = resolveFrontendUrl(c.env);
  if (!oauthToken || !user) {
    return c.redirect(`${frontendUrl}/home?error=auth_failed`);
  }

  if (!c.env.JWT_SECRET) {
    return c.json({ error: "Missing JWT_SECRET env variable" }, 500);
  }

  // Login or create player with Google account
  const loginService = new LoginService(c.env.db);
  const playerResult = await loginService.loginWithGoogleAccount(
    user.id!,
    user.email!,
  );

  if (!playerResult.ok) {
    console.error(playerResult.error);
    return c.redirect(`${frontendUrl}/home?error=player_creation_failed`);
  }

  const jwtPayload: JWTPayload = {
    sub: user.id!,
    email: user.email!,
    name: user.name!,
    picture: user.picture!,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  };

  const token = await sign(jwtPayload, c.env.JWT_SECRET, "HS256");

  // The proxy (Cloudflare Pages Function / Vite dev proxy) serves both the
  // frontend and the backend under the same origin, so the cookie is
  // first-party. SameSite=Lax is sufficient; Secure mirrors the frontend URL
  // scheme so the cookie also works in local dev (http://localhost).
  const secure = frontendUrl.startsWith("https://");
  setCookie(c, "session_token", token, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  const callbackUrl = playerResult.value.isNew
    ? `${frontendUrl}/auth/callback?new=1`
    : `${frontendUrl}/auth/callback`;
  return c.redirect(callbackUrl);
});

export default auth;
