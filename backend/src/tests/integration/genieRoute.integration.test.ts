import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GENIE_ERRORS } from "../../../../dto/genieDTO";
import me from "../../routes/me";
import { PlayerService } from "../../services/player";
import { injectDeps } from "../support/injectDeps";
import { repositories } from "../support/target";

/**
 * The AI binding is supplied by the test, not by the platform: the `test`
 * environment in wrangler.jsonc deliberately omits it, because Workers AI has
 * no local simulator and its mere presence makes the pool demand a
 * CLOUDFLARE_API_TOKEN that CI does not have.
 *
 * Stubbing it is what a test wants regardless — the real binding reaches remote
 * Workers AI even in local dev, so letting it through would spend the day's
 * neuron allocation and assert against whatever the model happened to say.
 * `vi.mock` is no help: this pool resolves a mocked module to the real one
 * without complaining.
 */
const realAi = env.AI;
let aiCalls: unknown[] = [];

function stubAi(reply: unknown | (() => never)) {
  Object.assign(env, {
    AI: {
      async run(model: string, input: unknown) {
        aiCalls.push({ model, input });
        if (typeof reply === "function") {
          return (reply as () => never)();
        }
        return { response: reply };
      },
    },
  });
}

afterEach(() => {
  Object.assign(env, { AI: realAi });
  aiCalls = [];
});

function appFor(googleAccountId: string) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("jwtPayload", { sub: googleAccountId });
    await next();
  });
  app.use("*", injectDeps());
  app.route("/api/me", me);
  return app;
}

function post(app: Hono, body: unknown) {
  return app.request(
    "/api/me/genie-turns",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
  );
}

const VALID_TURN = {
  query: "find me a relation between OpenAI and Portugal",
  // One exchange already answered. The opening turn keeps the whole set by
  // guarantee — there is no answer to narrow on yet — so a turn that means to
  // show narrowing has to be past it.
  history: [{ question: "Is it recent?", answer: "Yes" }],
  candidates: [
    { id: 1, title: "Google", description: "American technology company" },
    {
      id: 2,
      title: "Artificial intelligence arms race",
      description: "Competition between states over AI",
    },
  ],
  bucket: "a handful",
};

const GOOD_REPLY = JSON.stringify({
  utterance: "Curious pairing — is it about a company?",
  question: "Is it about a company?",
  keep: [2],
  options: ["Yes", "No"],
  kind: "filter",
  done: false,
});

describe("POST /api/me/genie-turns", () => {
  let app: Hono;

  beforeEach(async () => {
    // A fresh account per test: the rate limiter is real in this pool and keys
    // on the player, so a reused id leaks quota between tests.
    const accountId = `account-genie-${crypto.randomUUID()}`;
    const player = await new PlayerService(repositories()).createPlayer(
      `seeker-${crypto.randomUUID()}`,
      "seeker@example.com",
      accountId,
    );
    expect(player.ok).toBe(true);
    app = appFor(accountId);
  });

  it("returns the turn and asks the model that ADR 0006 settled on", async () => {
    stubAi(GOOD_REPLY);

    const response = await post(app, VALID_TURN);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      utterance: "Curious pairing — is it about a company?",
      question: "Is it about a company?",
      keep: [2],
      options: ["Yes", "No"],
      kind: "filter",
      done: false,
    });
    expect(aiCalls).toHaveLength(1);
    expect((aiCalls[0] as { model: string }).model).toBe(
      "@cf/mistralai/mistral-small-3.1-24b-instruct",
    );
  });

  it("accepts a reply Workers AI already parsed into an object", async () => {
    // Workers AI pre-parses the generation when it is pure JSON, which is why
    // JSON mode is not needed (ADR 0006). Both shapes must work.
    stubAi(JSON.parse(GOOD_REPLY));

    const response = await post(app, VALID_TURN);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { keep: number[] };
    expect(body.keep).toEqual([2]);
  });

  it("answers 400 for a payload the client should never have built", async () => {
    stubAi(GOOD_REPLY);

    const response = await post(app, { ...VALID_TURN, candidates: [] });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: GENIE_ERRORS.NO_CANDIDATES,
    });
    // Validation runs before the model, so a bad payload costs no neurons.
    expect(aiCalls).toHaveLength(0);
  });

  it("keeps the whole set on the opening turn, whatever the model says", async () => {
    stubAi(GOOD_REPLY);

    const response = await post(app, { ...VALID_TURN, history: [] });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { keep: number[] };
    // GOOD_REPLY narrows to [2]. With nothing answered there is nothing to
    // narrow on, so the model would be picking for the player before they have
    // said a word — and a full seed can drop straight to the result threshold,
    // ending the hunt on a turn that asked rather than answered.
    expect(body.keep).toEqual([1, 2]);
  });

  it("answers 400 for a candidate carrying more text than a real one could", async () => {
    stubAi(GOOD_REPLY);

    const response = await post(app, {
      ...VALID_TURN,
      candidates: [{ id: 1, title: "Google", description: "x".repeat(5000) }],
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: GENIE_ERRORS.TEXT_TOO_LONG,
    });
    // Neurons are an account-wide daily allocation, so an unbounded prompt is
    // one player putting the Genie to sleep for everyone. Nothing is spent.
    expect(aiCalls).toHaveLength(0);
  });

  it("answers 400, not 500, when a field is the wrong type", async () => {
    stubAi(GOOD_REPLY);

    const response = await post(app, {
      ...VALID_TURN,
      candidates: [{ id: 1, title: "Google", description: 7 }],
    });

    expect(response.status).toBe(400);
    expect(aiCalls).toHaveLength(0);
  });

  it("answers 400 for a body that is not JSON", async () => {
    stubAi(GOOD_REPLY);

    const response = await app.request(
      "/api/me/genie-turns",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      },
      env,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: GENIE_ERRORS.MALFORMED_BODY,
    });
  });

  it("answers 503 with the asleep code when the model fails", async () => {
    stubAi(() => {
      throw new Error("Workers AI: daily neuron allocation exhausted");
    });

    const response = await post(app, VALID_TURN);

    // The frontend answers this by dismissing to the ordinary search bar; the
    // feature is additive, so buying an article never depends on it.
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: GENIE_ERRORS.ASLEEP });
  });

  /**
   * The `local` environment leaves Workers AI unbound so a clone with no
   * Cloudflare credentials can still run the app (see `wrangler.jsonc`), and
   * the `test` environment does the same for CI. No stub here, therefore, is
   * exactly that deployment.
   */
  it("answers asleep when the deployment has no model bound at all", async () => {
    expect(env.AI).toBeUndefined();

    const response = await post(app, VALID_TURN);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: GENIE_ERRORS.ASLEEP });
  });

  it("answers asleep on the seeding route too, before it reads the body", async () => {
    // The other half of the feature. The guard runs ahead of body parsing, so
    // an empty body is enough to prove which check answered.
    const response = await app.request(
      "/api/me/genie-seeds",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
      env,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: GENIE_ERRORS.ASLEEP });
  });

  it("spends no rate-limit quota on a deployment that has no model", async () => {
    // The limiter allows 20 a minute and is real in this pool. A build that
    // never offers the feature must not be able to lock the player out of
    // anything, so the check comes first and the 21st call still reports the
    // genie asleep rather than rate-limited.
    for (let i = 0; i < 21; i += 1) {
      const response = await post(app, VALID_TURN);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: GENIE_ERRORS.ASLEEP });
    }
  });

  it("answers 404 when the session has no player behind it", async () => {
    stubAi(GOOD_REPLY);

    const response = await post(
      appFor("account-that-does-not-exist"),
      VALID_TURN,
    );

    expect(response.status).toBe(404);
    expect(aiCalls).toHaveLength(0);
  });
});
