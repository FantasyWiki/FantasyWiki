import { Hono } from "hono";
import { googleAuth } from "@hono/oauth-providers/google";
import { sign } from "hono/jwt";

const app = new Hono<{ Bindings: Bindings }>();

type Bindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
};

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.use("/auth/google", async (c, next) => {
  const handler = googleAuth({
    client_id: c.env.GOOGLE_CLIENT_ID,
    client_secret: c.env.GOOGLE_CLIENT_SECRET,
    scope: ["openid", "email", "profile"],
  });
  return handler(c, next);
});

app.get("/auth/google", async (c) => {
  const token = c.get("token");
  const user = c.get("user-google");

  if (!token || !user) {
    const frontendUrl = c.env.FRONTEND_URL || "http://localhost:5173";
    return c.redirect(`${frontendUrl}/home?error=auth_failed`);
  }

  const jwtPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  };

  const jwt = await sign(jwtPayload, c.env.JWT_SECRET);
  const frontendUrl = c.env.FRONTEND_URL || "http://localhost:5173";

  return c.redirect(`${frontendUrl}/auth/callback?token=${jwt}`);
});

export default app;
