import type { Context, Env } from "hono";
import { sign } from "hono/jwt";
import { setCookie } from "hono/cookie";
import { JWTPayload } from "hono/utils/jwt/types";
import { resolveFrontendUrl } from "./auth";

const SESSION_DAYS = 7;

/** Who the session says the caller is. `sub` is what `currentPlayer` resolves by. */
export interface SessionClaims {
  sub: string;
  /** Omitted by a sign-in that has no email to speak of, such as a password one. */
  email?: string;
  name: string;
  picture: string;
}

/** What {@link issueSession} needs bound, whatever else its caller has. */
type SessionEnv = Env & {
  Bindings: { JWT_SECRET: string; FRONTEND_URL: string };
};

/**
 * Signs a session and sets it as the `session_token` cookie.
 *
 * Shared by the sign-ins that do not go through an identity provider: the local
 * demo route and username/password. They must produce *the same session* the
 * Google flow does, or a feature downstream starts having to know which door a
 * player came through, and a hand-copied cookie is how one of them comes to
 * differ on `secure` or on the expiry — drift nothing fails on.
 *
 * `routes/auth.ts` deliberately still mints its own. It is production sign-in
 * and, unlike `devAuth.ts`, nothing tests its claims or its cookie — only
 * `resolveFrontendUrl` is covered — so moving it here would be an unverified
 * change to the one path that locks every real user out when it breaks. Folding
 * it in is worth doing behind a test of its own, not as a side effect of adding
 * a second way to log in.
 *
 * The proxy (Cloudflare Pages Function / Vite dev proxy) serves both the
 * frontend and the backend under the same origin, so the cookie is first-party.
 * SameSite=Lax is sufficient; Secure mirrors the frontend URL scheme so the
 * cookie also works in local dev (http://localhost).
 */
export async function issueSession<E extends SessionEnv>(
  c: Context<E>,
  claims: SessionClaims,
): Promise<void> {
  const payload: JWTPayload = {
    ...claims,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * SESSION_DAYS,
  };

  const token = await sign(payload, c.env.JWT_SECRET, "HS256");

  setCookie(c, "session_token", token, {
    httpOnly: true,
    secure: resolveFrontendUrl(c.env).startsWith("https://"),
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}
