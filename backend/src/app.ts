import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";
import { Temporal } from "@js-temporal/polyfill";
import auth, { resolveFrontendUrl } from "./routes/auth";
import devAuth from "./routes/devAuth";
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

export type Bindings = {
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
  // Optional: the `local` env leaves Workers AI unbound so a clone with no
  // Cloudflare credentials can still boot (see `wrangler.jsonc`).
  AI?: WorkersAiBinding;
  GENIE_RATE_LIMITER: {
    limit(o: { key: string }): Promise<{ success: boolean }>;
  };
  CONTRACT_SETTLEMENT_WORKFLOW: Workflow<ContractSettlementParams>;
  SCORING_INGEST_SECRET: string;
};

export type App = Hono<{ Bindings: Bindings; Variables: AppVariables }>;

// Built once per isolate rather than per request: it carries a transport and a
// response cache that only pay off when they outlive a single request. Module
// scope rather than inside `createApp`, so two apps in one isolate — which is
// what `tests/routes/openapi.spec.ts` builds — still share the one client.
const wikimedia = createWikimediaClient();

/**
 * Every route the backend serves in every build.
 *
 * A function rather than a module-level `app` because there is more than one
 * entry point: `index.ts` is what Cloudflare deploys, and `indexPassword.ts`
 * adds username/password sign-in for the local MongoDB run. An entry takes the
 * app from here and mounts whatever else its build has
 * (docs/architecture/auth-modes.md).
 *
 * What it deliberately does not take is a flag saying which build it is in. A
 * Worker's bindings are runtime values, so `if (env.X) app.route(...)` cannot be
 * dead-code-eliminated and the handlers would ship to production regardless.
 * Absence has to come from the module graph: this file imports nothing that a
 * build might not want, and an entry adds by importing.
 */
export function createApp(): App {
  const app: App = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

  app.use(
    "*",
    cors({
      origin: (origin) => origin,
      credentials: true,
    }),
  );

  app.use("*", async (c, next) => {
    c.set("repositories", repositoriesFor(c.env));
    c.set("wikimedia", wikimedia);
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

  // Signing in without Google, refused unless ENVIRONMENT is "local". Mounted
  // beside the Google flow because it produces the identical session — see
  // routes/devAuth.ts.
  app.route("/auth", devAuth);

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

  return app;
}

/**
 * Daily settlement Cron Trigger (ADR 0003, ~05:00 UTC): kicks off the durable
 * ContractSettlementWorkflow, which settles or renews every contract that has
 * reached the end of its term. The handler stays thin — it only starts the
 * Workflow instance; all the resolution logic lives in the Workflow/service.
 */
export const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (
  _controller,
  env,
) => {
  await env.CONTRACT_SETTLEMENT_WORKFLOW.create({
    params: { today: Temporal.Now.plainDateISO().toString() },
  });
};
