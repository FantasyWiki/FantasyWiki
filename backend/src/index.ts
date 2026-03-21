import { Hono } from "hono";
import { googleAuth } from "@hono/oauth-providers/google";

const app = new Hono<{ Bindings: Bindings }>();

type Bindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
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

app.get("/auth/google", (c) => {
  const token = c.get("token");
  const grantedScopes = c.get("granted-scopes");
  const user = c.get("user-google");

  return c.json({
    token,
    grantedScopes,
    user,
  });
});

export default app;
