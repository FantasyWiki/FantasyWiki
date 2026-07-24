import { Hono } from "hono";
import {
  GENIE_ERRORS,
  GenieSeedRequest,
  GenieTurnRequest,
} from "../../../dto/genieDTO";
import { ArticleGenieService } from "../services/articleGenie";
import { WorkersAiBinding, createLlmClient } from "../services/llmClient";
import { playerErrorStatus, resolveCurrentPlayer } from "./helpers";

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

type Bindings = {
  db: D1Database;
  AI: WorkersAiBinding;
  GENIE_RATE_LIMITER: RateLimiter;
};

/**
 * Self-scoped routes for the authenticated player: identity comes from the JWT
 * and no `playerId` is ever accepted from the client
 * (docs/development/api-naming-rules.md).
 */
const me = new Hono<{ Bindings: Bindings }>();

/**
 * Everything the client got wrong about its own request. The Genie is additive,
 * so none of these should ever reach a player — they mean the frontend built a
 * payload it shouldn't have, and a 400 says so instead of burning a model call.
 */
const VALIDATION_ERRORS: string[] = [
  GENIE_ERRORS.MALFORMED_BODY,
  GENIE_ERRORS.QUERY_REQUIRED,
  GENIE_ERRORS.QUERY_TOO_LONG,
  GENIE_ERRORS.TOO_MANY_CANDIDATES,
  GENIE_ERRORS.NO_CANDIDATES,
  GENIE_ERRORS.HISTORY_TOO_LONG,
  GENIE_ERRORS.TEXT_TOO_LONG,
  GENIE_ERRORS.INVALID_BUCKET,
  GENIE_ERRORS.DUPLICATE_CANDIDATE_ID,
];

/**
 * Reads the player's opening text into the searches that seed the candidate
 * set, so the browser can go and run them.
 *
 * Separate from a turn only because of ordering: a turn is defined over a
 * candidate list, and there is no list until the query has been read. Seeding a
 * chemistry query on keywords alone would have the Genie open with a question
 * about articles *describing* OpenAI rather than ones relating it to Portugal.
 */
me.post("/genie-seeds", async (c) => {
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }

  const { success } = await c.env.GENIE_RATE_LIMITER.limit({
    key: playerResult.value.id,
  });
  if (!success) {
    return c.json({ error: GENIE_ERRORS.RATE_LIMITED }, 429);
  }

  let request: GenieSeedRequest;
  try {
    request = await c.req.json<GenieSeedRequest>();
  } catch {
    return c.json({ error: GENIE_ERRORS.MALFORMED_BODY }, 400);
  }

  const service = new ArticleGenieService(createLlmClient(c.env.AI));
  const result = await service.seed(request);

  if (!result.ok) {
    const status = VALIDATION_ERRORS.includes(result.error) ? 400 : 503;
    return c.json({ error: result.error }, status);
  }

  return c.json(result.value);
});

/**
 * One turn of the Article Genie (ADR 0006). The Worker does exactly one thing
 * here — call the model — because every other part of the feature is cheaper in
 * the browser: the Wikimedia search and link fetches run against the client's
 * 7-day cache, where neither the 50-subrequest nor the 10 ms CPU limit applies.
 *
 * A session is several requests in quick succession, so the rate limiter is
 * sized for real play rather than for abuse; the day's neuron allocation is the
 * real ceiling, and it fails closed on its own.
 */
me.post("/genie-turns", async (c) => {
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }

  const { success } = await c.env.GENIE_RATE_LIMITER.limit({
    key: playerResult.value.id,
  });
  if (!success) {
    return c.json({ error: GENIE_ERRORS.RATE_LIMITED }, 429);
  }

  let request: GenieTurnRequest;
  try {
    request = await c.req.json<GenieTurnRequest>();
  } catch {
    return c.json({ error: GENIE_ERRORS.MALFORMED_BODY }, 400);
  }

  const service = new ArticleGenieService(createLlmClient(c.env.AI));
  const result = await service.takeTurn(request);

  if (!result.ok) {
    // Anything that is not the client's fault is the genie being asleep, which
    // the frontend answers by dismissing to the ordinary search bar. 503 rather
    // than 502: the day's allocation coming back is a matter of waiting.
    const status = VALIDATION_ERRORS.includes(result.error) ? 400 : 503;
    return c.json({ error: result.error }, status);
  }

  return c.json(result.value);
});

export default me;
