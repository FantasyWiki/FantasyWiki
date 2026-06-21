import { Hono } from "hono";
import { JWTPayload } from "hono/utils/jwt/types";
import { setCookie } from "hono/cookie";

type Bindings = {
  JWT_SECRET: string;
};

const session = new Hono<{ Bindings: Bindings }>();

session.get("/", async (c) => {
  const payload: JWTPayload = c.get("jwtPayload") as JWTPayload;
  return c.json({
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  });
});

session.delete("/", async (c) => {
  setCookie(c, "session_token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });
  return c.json({ success: true });
});

session.options("/", async (c) => {
  return c.text("", 200);
});

export default session;
