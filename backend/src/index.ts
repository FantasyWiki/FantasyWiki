import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";
import auth from "./routes/auth";
import session from "./routes/session";

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

// Mount auth routes
app.route("/auth", auth);

// Protected routes - apply JWT middleware
app.use("/api/*", async (c, next) => {
  const handler = jwt({
    secret: c.env.JWT_SECRET,
    alg: "HS256",
    cookie: "session_token",
  });
  return handler(c, next);
});

// Mount session routes
app.route("/api/session", session);

export default app;
