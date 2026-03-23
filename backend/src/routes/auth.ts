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
};

const auth = new Hono<{ Bindings: Bindings }>();

auth.use("/google", async (c, next) => {
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

  if (!token || !user) {
    const frontendUrl = c.env.FRONTEND_URL || "http://localhost:5173";
    return c.redirect(`${frontendUrl}/home?error=auth_failed`);
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
    sameSite: "Lax", // 'Lax' is better for OAuth redirects
    path: "/",
  });
  const frontendUrl = c.env.FRONTEND_URL || "http://localhost:5173";
  return c.redirect(`${frontendUrl}/auth/callback`);
});

export default auth;
