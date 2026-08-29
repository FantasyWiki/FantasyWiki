import { Hono } from "hono";
import { JWTPayload } from "hono/utils/jwt/types";
import { setCookie } from "hono/cookie";
import type { SessionDTO, SessionFeaturesDTO } from "../../../dto/sessionDTO";
import type { WorkersAiBinding } from "../services/llmClient";

type Bindings = {
  JWT_SECRET: string;
  /**
   * Absent in the `local` environment, where declaring it would make Wrangler
   * demand Cloudflare credentials a fresh clone doesn't have — see the comment
   * on that env in `wrangler.jsonc`.
   */
  AI?: WorkersAiBinding;
};

const session = new Hono<{ Bindings: Bindings }>();

/**
 * What this deployment can offer, read off the bindings themselves: a Worker
 * that was never given the model cannot answer for the Genie, whatever any
 * config says.
 */
function featuresFor(env: Bindings): SessionFeaturesDTO {
  return { articleGenie: env.AI !== undefined };
}

session.get("/", async (c) => {
  const payload: JWTPayload = c.get("jwtPayload") as JWTPayload;
  return c.json<SessionDTO>({
    sub: payload.sub as string,
    // Undefined for a username/password account, which has no email — hence
    // the optional field on SessionDTO rather than an empty string on the wire.
    email: payload.email as string | undefined,
    name: payload.name as string,
    picture: payload.picture as string,
    features: featuresFor(c.env),
  });
});

session.delete("/", async (c) => {
  setCookie(c, "session_token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });
  return c.json({ success: true });
});

session.options("/", async (c) => {
  return c.text("", 200);
});

export default session;
