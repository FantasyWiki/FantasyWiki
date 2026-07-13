import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";
import auth, { resolveFrontendUrl } from "./routes/auth";
import session from "./routes/session";
import leagues from "./routes/leagues";
import notifications from "./routes/notifications";
import player from "./routes/player";
import internal from "./routes/internal";

const app = new Hono<{ Bindings: Bindings }>();

type Bindings = {
  db: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  SCORING_INGEST_SECRET: string;
};

app.use(
  "*",
  cors({
    origin: (origin) => origin,
    credentials: true,
  }),
);

app.get("/", (c) => {
  return c.json({
    resolved_url: resolveFrontendUrl(c.env),
    FRONTEND_URL: c.env.FRONTEND_URL,
  });
});

// Mount auth routes
app.route("/auth", auth);

// Internal routes for the scoring engine — service-token auth (not user JWT),
// so mounted outside the /api/* Google-JWT guard (docs/plan-scoring-engine.md §6).
app.route("/internal", internal);

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

// Mount leagues routes
app.route("/api/leagues", leagues);

// Mount notifications routes
app.route("/api/notifications", notifications);

// Mount player routes
app.route("/api/player", player);

export default app;
