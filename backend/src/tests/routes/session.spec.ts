import { Hono } from "hono";
import { describe, it, expect } from "vitest";
import type { SessionDTO } from "../../../../dto/sessionDTO";
import session from "../../routes/session";

const PAYLOAD = {
  sub: "google-123",
  email: "player@example.com",
  name: "Player One",
  picture: "https://example.com/avatar.png",
};

/**
 * A whole app rather than a fake context, and the bindings passed the way the
 * runtime passes them: what the route reports is a property of the environment
 * it was deployed into, which is the thing under test here.
 */
function get(env: Record<string, unknown>) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("jwtPayload", PAYLOAD);
    return next();
  });
  app.route("/session", session);
  return app.request("/session", {}, env);
}

describe("GET /api/session", () => {
  it("carries the signed-in player's identity from the JWT", async () => {
    const body = (await (await get({})).json()) as SessionDTO;

    expect(body).toMatchObject(PAYLOAD);
  });

  /**
   * The frontend hides the Article Genie's entry point on this flag, so a
   * deployment that was never given the model must not claim it. Reading the
   * binding itself — rather than a var — is what makes that impossible to get
   * out of step: the `local` environment omits the binding so a clone with no
   * Cloudflare credentials can still run (see `wrangler.jsonc`).
   */
  it("reports the Genie off when Workers AI is not bound", async () => {
    const body = (await (await get({})).json()) as SessionDTO;

    expect(body.features.articleGenie).toBe(false);
  });

  it("reports the Genie on when Workers AI is bound", async () => {
    const ai = { run: async () => ({ response: "" }) };

    const body = (await (await get({ AI: ai })).json()) as SessionDTO;

    expect(body.features.articleGenie).toBe(true);
  });
});
