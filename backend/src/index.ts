import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";
import { Temporal } from "@js-temporal/polyfill";
import auth, { resolveFrontendUrl } from "./routes/auth";
import session from "./routes/session";
import leagues from "./routes/leagues";
import notifications from "./routes/notifications";
import player from "./routes/player";
import reports from "./routes/reports";
import type { ContractSettlementParams } from "./workflows/contractSettlement";

const app = new Hono<{ Bindings: Bindings }>();

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
  CONTRACT_SETTLEMENT_WORKFLOW: Workflow<ContractSettlementParams>;
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

// Mount problem report routes
app.route("/api/reports", reports);

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

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Bindings>;
