import { Hono } from "hono";
import { googleAuth } from "@hono/oauth-providers/google";
import { sign } from "hono/jwt";
import { JWTPayload } from "hono/utils/jwt/types";
import { setCookie } from "hono/cookie";

type Bindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  WORKERS_CI_BRANCH: string;
};

export function resolveFrontendUrl(env: Bindings): string {
  let url = env.FRONTEND_URL ?? "localhost:5173";
  // Only add branch prefix if not master
  if (env.WORKERS_CI_BRANCH && env.WORKERS_CI_BRANCH !== "master") {
    url = env.WORKERS_CI_BRANCH + "." + url;
  }

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
  });
  return handler(c, next);
});

auth.get("/google", async (c) => {
  const token = c.get("token");
  const user = c.get("user-google");

  const frontendUrl = resolveFrontendUrl(c.env);
  if (!token || !user) {
    return c.redirect(`${frontendUrl}/home?error=auth_failed`);
  }

  if (!c.env.JWT_SECRET) {
    return c.json({ error: "Missing JWT_SECRET env variable" }, 500);
  }

  const jwtPayload: JWTPayload = {
    sub: user.id!,
    email: user.email!,
    name: user.name!,
    picture: user.picture!,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  };

  const jwt = await sign(jwtPayload, c.env.JWT_SECRET, "HS256");
  setCookie(c, "session_token", jwt, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
  });
  return c.redirect(`${frontendUrl}/auth/callback`);
});

export default auth;
