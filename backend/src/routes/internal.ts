import { Temporal } from "@js-temporal/polyfill";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { timingSafeEqual } from "hono/utils/buffer";
import { ScoringService } from "../services/scoring";
import type { PerformanceIngestDTO } from "../../../dto/scoring";

type Bindings = {
  db: D1Database;
  SCORING_INGEST_SECRET: string;
};

const internal = new Hono<{ Bindings: Bindings }>();

/**
 * Service-token guard. The scoring engine is not a user, so these routes sit
 * *outside* the /api/* Google-JWT guard and authenticate with a shared bearer
 * secret instead (docs/plan-scoring-engine.md §6). Uses Hono's `bearerAuth`
 * (constant-time compare, RFC-compliant 401 + WWW-Authenticate) with a dynamic
 * `verifyToken` because the secret comes from the per-request env; an
 * unset/empty secret fails closed.
 */
internal.use(
  "*",
  bearerAuth({
    verifyToken: async (token, c) => {
      const expected = (c.env as Bindings).SCORING_INGEST_SECRET;
      return Boolean(expected) && (await timingSafeEqual(token, expected));
    },
  }),
);

/**
 * Deserialize a `YYYY-MM-DD` wire string into a `Temporal.PlainDate` at the
 * route boundary (the DTO stays a plain string; the service speaks Temporal).
 * `overflow: "reject"` refuses impossible dates. Returns null on any bad input.
 */
function parseDay(value: string | undefined): Temporal.PlainDate | null {
  if (!value) return null;
  try {
    return Temporal.PlainDate.from(value, { overflow: "reject" });
  } catch {
    return null;
  }
}

// GET /internal/scoring-inputs?date=YYYY-MM-DD — the day's scorable teams.
internal.get("/scoring-inputs", async (c) => {
  const day = parseDay(c.req.query("date"));
  if (day === null) {
    return c.json({ error: "date query param (YYYY-MM-DD) is required" }, 400);
  }
  const service = ScoringService.fromDb(c.env.db);
  const result = await service.getScoringInputs(day);
  if (!result.ok) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.value);
});

// POST /internal/performances — idempotent, chunkable ingest of computed rows.
internal.post("/performances", async (c) => {
  const body = await c.req.json<PerformanceIngestDTO>().catch(() => null);
  if (body === null) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const day = parseDay(body.date);
  if (day === null) {
    return c.json({ error: "date (YYYY-MM-DD) is required" }, 400);
  }
  const service = ScoringService.fromDb(c.env.db);
  const result = await service.ingestPerformances(day, body.results);
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }
  return c.json(result.value);
});

export default internal;
