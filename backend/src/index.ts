import { Hono } from "hono";
import { googleAuth } from "@hono/oauth-providers/google";
import { sign } from "hono/jwt";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";
import { JWTPayload } from "hono/utils/jwt/types";

const app = new Hono<{ Bindings: Bindings }>();

type Bindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
};

app.use(
  "*",
  cors({
    origin: (origin) => origin,
    credentials: true,
  }),
);

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

  const jwtPayload: JWTPayload = {
    sub: user.id!,
    email: user.email!,
    name: user.name!,
    picture: user.picture!,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  };

  const jwt = await sign(jwtPayload, c.env.JWT_SECRET, "HS256");
  const frontendUrl = c.env.FRONTEND_URL || "http://localhost:5173";

  return c.redirect(`${frontendUrl}/auth/callback?token=${jwt}`);
});

app.use("/api/*", async (c, next) => {
  const handler = jwt({
    secret: c.env.JWT_SECRET,
    alg: "HS256",
  });
  return handler(c, next);
});

app.get("/api/me", async (c) => {
  const payload: JWTPayload = c.get("jwtPayload");
  return c.json({
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  });
});

export default app;
