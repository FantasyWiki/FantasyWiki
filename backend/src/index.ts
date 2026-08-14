import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";
import { Temporal } from "@js-temporal/polyfill";
import auth, { resolveFrontendUrl } from "./routes/auth";
import session from "./routes/session";
import leagues from "./routes/leagues";
import notifications from "./routes/notifications";
import player from "./routes/player";
import me from "./routes/me";
import reports from "./routes/reports";
import wikipediaEditionRoutes from "./routes/wikipediaEditions";
import type { WorkersAiBinding } from "./services/llmClient";
import internal from "./routes/internal";
import type { ContractSettlementParams } from "./workflows/contractSettlement";
import { AppVariables } from "./appEnv";
import { repositoriesFor } from "./composition";
import { createWikimediaClient } from "./services/wikimediaClient";

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

type Bindings = {
  db: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  GH_APP_ID: string;
  GH_APP_INSTALLATION_ID: string;
  GH_APP_PRIVATE_KEY: string;
  GITHUB_REPO: string;
  ENVIRONMENT: string;
  REPORT_RATE_LIMITER: {
    limit(o: { key: string }): Promise<{ success: boolean }>;
  };
  AI: WorkersAiBinding;
  GENIE_RATE_LIMITER: {
    limit(o: { key: string }): Promise<{ success: boolean }>;
  };
  CONTRACT_SETTLEMENT_WORKFLOW: Workflow<ContractSettlementParams>;
  SCORING_INGEST_SECRET: string;
};

app.use(
  "*",
  cors({
    origin: (origin) => origin,
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  c.set("repositories", repositoriesFor(c.env));
  c.set("wikimedia", createWikimediaClient());
  return next();
});

app.get("/", (c) => {
  return c.json({
    resolved_url: resolveFrontendUrl(c.env),
    FRONTEND_URL: c.env.FRONTEND_URL,
  });
});

// Mount auth routes
app.route("/auth", auth);

// Internal routes for the scoring engine — service-token auth (not user JWT),
// so mounted outside the /api/* Google-JWT guard (docs/architecture/scoring-pipeline.md).
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

// Mount self-scoped player routes (/api/me — identity from the JWT)
app.route("/api/me", me);

// Mount problem report routes
app.route("/api/reports", reports);

// The Wikipedia editions a league can be founded on (#531)
app.route("/api/wikipedia-editions", wikipediaEditionRoutes);

/**
 * Daily settlement Cron Trigger (ADR 0003, ~05:00 UTC): kicks off the durable
 * ContractSettlementWorkflow, which settles or renews every contract that has
 * reached the end of its term. The handler stays thin — it only starts the
 * Workflow instance; all the resolution logic lives in the Workflow/service.
 */
const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (
  _controller,
  env,
) => {
  await env.CONTRACT_SETTLEMENT_WORKFLOW.create({
    params: { today: Temporal.Now.plainDateISO().toString() },
  });
};

// Cloudflare requires the WorkflowEntrypoint class to be exported from the
// Worker's main module (referenced by class_name in wrangler.jsonc).
export { ContractSettlementWorkflow } from "./workflows/contractSettlement";

// The Worker's default export is the runtime handler ({ fetch, scheduled }), so
// the Hono instance is also exported by name for integration tests that drive
// the fully wired app via app.request(...).
export { app };

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Bindings>;
