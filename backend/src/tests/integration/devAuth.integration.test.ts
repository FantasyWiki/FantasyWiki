import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, it, expect } from "vitest";
import { verify } from "hono/jwt";
import devAuth from "../../routes/devAuth";
import { PlayerService } from "../../services/player";
import { injectDeps } from "../support/injectDeps";
import { repositories } from "../support/target";

const JWT_SECRET = "super-secret-for-tests";

/**
 * The route reads `ENVIRONMENT` off the bindings, and the `test` environment
 * sets it to `"production"` — so every case has to pass its own, the way
 * `routes/session.spec.ts` does. That is the point of the guard: the value only
 * says `"local"` on a machine someone is running Wrangler on.
 */
function get(environment: string | undefined) {
  const app = new Hono();
  app.use("*", injectDeps());
  app.route("/auth", devAuth);
  return app.request(
    "/auth/dev",
    { redirect: "manual" },
    {
      ...env,
      JWT_SECRET,
      FRONTEND_URL: "localhost:5173",
      ENVIRONMENT: environment,
    },
  );
}

function sessionCookie(response: Response): string {
  const header = response.headers.get("set-cookie") ?? "";
  return header.split(";")[0].replace("session_token=", "");
}

describe("GET /auth/dev", () => {
  /**
   * The whole safety argument in one test. A deployed Worker must not carry a
   * route that hands out a session for the asking, and `ENVIRONMENT` is the
   * only thing standing between the two — so every value it actually takes in
   * `wrangler.jsonc`, plus the ways it could go missing, has to be refused.
   */
  it.each(["production", "preview", "", undefined, "Local", "local "])(
    "does not exist when ENVIRONMENT is %o",
    async (environment) => {
      const response = await get(environment);

      expect(response.status).toBe(404);
      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );

  it("signs a session the JWT middleware accepts, in local development", async () => {
    const response = await get("local");

    expect(response.status).toBe(302);

    // The same secret and algorithm the Google flow signs with — this is one
    // session type, not two, which is why nothing downstream special-cases it.
    const claims = await verify(sessionCookie(response), JWT_SECRET, "HS256");
    expect(claims.email).toBe("demo@localhost");
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("creates an ordinary player, and the same one on a second sign-in", async () => {
    const first = await get("local");
    // A brand-new account is sent to team creation, exactly as Google's is.
    expect(first.headers.get("location")).toContain("/auth/callback?new=1");

    const second = await get("local");
    expect(second.headers.get("location")).toContain("/auth/callback");
    expect(second.headers.get("location")).not.toContain("new=1");

    // Google subjects are numeric strings, so this id cannot collide with one.
    const player = await new PlayerService(
      repositories(),
    ).getPlayerByGoogleAccountId("dev-local-player");
    expect(player.ok).toBe(true);
  });

  it("refuses to sign anything when JWT_SECRET is unset", async () => {
    const app = new Hono();
    app.use("*", injectDeps());
    app.route("/auth", devAuth);

    const response = await app.request(
      "/auth/dev",
      { redirect: "manual" },
      {
        ...env,
        JWT_SECRET: "",
        FRONTEND_URL: "localhost:5173",
        ENVIRONMENT: "local",
      },
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
