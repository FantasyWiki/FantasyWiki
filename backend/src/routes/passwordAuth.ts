import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { validator } from "hono/validator";
import {
  PASSWORD_REQUEST_ERRORS,
  PASSWORD_RULES,
  type PasswordCredentialsRequest,
  type PasswordSessionDTO,
} from "../../../dto/passwordAuthDTO";
import { PASSWORD_ERRORS } from "../auth/password/credentialRepository";
import { hashPassword, verifyPassword } from "../auth/password/hash";
import { AppVariables } from "../appEnv";
import { credentialsFor } from "../passwordComposition";
import { resolveFrontendUrl } from "./auth";
import { issueSession } from "./issueSession";

type Bindings = {
  JWT_SECRET: string;
  FRONTEND_URL: string;
  PERSISTENCE?: string;
  MONGO_URL?: string;
  MONGO_DB?: string;
};

/**
 * Signing in with a username and a password.
 *
 * Mounted only by `src/indexPassword.ts`, which only `wrangler.mongo.jsonc`
 * names. The Worker Cloudflare deploys does not import this module, so it does
 * not contain these handlers, the hashing, or the credential store — which is
 * the point, a public register/login pair being a genuine expansion of what an
 * internet-facing deployment can be attacked through
 * (docs/architecture/auth-modes.md).
 *
 * JSON in, JSON out, unlike the Google and demo routes: the caller is a form in
 * the SPA rather than a browser mid-navigation, so there is no redirect dance
 * to join. The session it produces is the same one — same claims, same secret,
 * same cookie — so nothing downstream knows this route exists.
 */
const passwordAuth = new Hono<{
  Bindings: Bindings;
  Variables: AppVariables;
}>();

/**
 * A real record to verify against when the username is unknown, so a failed
 * login costs the same whether or not the account exists. Without it the
 * lookup-miss returns in microseconds and the miss becomes a way to enumerate
 * who has an account.
 *
 * Built once per isolate and cached as the promise, so concurrent first
 * requests share one derivation. Safe to hold across requests, unlike a
 * connection: it is a string, not I/O.
 *
 * It is derived at today's iteration count while a stored record is verified at
 * whatever count *it* carries, so the two costs match only while every record
 * was written with the current one. Raising `ITERATIONS` in `hash.ts` without
 * re-hashing on login therefore makes an unknown username cost more than a
 * known one, and this defence quietly stops equalising anything. Re-hash on the
 * next successful login when the two differ, and they stay matched.
 */
let dummyRecord: Promise<string> | undefined;
const unknownUserRecord = (): Promise<string> =>
  (dummyRecord ??= hashPassword(crypto.randomUUID()));

/**
 * Only the frontend may ask, and a cross-site POST to login is not a nuisance
 * but an attack: it signs the victim into an account the attacker controls.
 *
 * Written out rather than taken from `hono/csrf`, which does not cover this.
 * That middleware only fires when the content-type is one an HTML form can send
 * — `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain` —
 * and lets `application/json` through untouched, on the usual reasoning that a
 * cross-site JSON post is preflighted and so already refused. That reasoning
 * does not hold here: the CORS layer in `app.ts` reflects whatever origin asks
 * and allows credentials, so the preflight succeeds and the request arrives
 * with the victim's cookies attached.
 *
 * A missing `Origin` is refused too. Browsers send one on every cross-site POST
 * and on same-site ones as well, so the only callers this turns away are the
 * ones that are not the frontend.
 *
 * The header is compared against the frontend's own URL, not the request's: the
 * browser talks to the dev proxy on one port while the Worker sees another, and
 * `changeOrigin` rewrites `Host`, not `Origin`.
 */
passwordAuth.use("/password/*", async (c, next) => {
  if (c.req.header("origin") !== resolveFrontendUrl(c.env)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  return next();
});

/**
 * These are the only unauthenticated endpoints that do real work per request,
 * so a large body would otherwise become a large key derivation.
 */
passwordAuth.use("/password/*", bodyLimit({ maxSize: 4 * 1024 }));

/**
 * Any password is accepted up to a length: no floor, no composition rules, but
 * a ceiling.
 *
 * The ceiling is the one check here that is not about usability. The whole
 * submitted string is fed to PBKDF2, so an unbounded password is unbounded CPU
 * on an unauthenticated endpoint. The body limit above bounds it as well, but
 * coarsely and for a different reason — raising it for a larger request body
 * would quietly widen this too.
 *
 * A password that is not a string is read as no password rather than refused:
 * with no floor left there is nothing for an empty one to fail.
 */
const credentialsBody = validator("json", (value, c) => {
  const { username, password } = (value ?? {}) as Partial<
    Record<keyof PasswordCredentialsRequest, unknown>
  >;

  // Named, unlike the 401 below: what a login must never say is *who has an
  // account*, and an illegal username says nothing about anyone.
  if (
    typeof username !== "string" ||
    !PASSWORD_RULES.USERNAME_PATTERN.test(username)
  ) {
    return c.json({ error: PASSWORD_REQUEST_ERRORS.USERNAME_INVALID }, 400);
  }

  const supplied = typeof password === "string" ? password : "";
  if (supplied.length > PASSWORD_RULES.PASSWORD_MAX) {
    return c.json({ error: PASSWORD_REQUEST_ERRORS.PASSWORD_TOO_LONG }, 400);
  }

  return { username, password: supplied } satisfies PasswordCredentialsRequest;
});

passwordAuth.post("/password/register", credentialsBody, async (c) => {
  if (!c.env.JWT_SECRET) {
    return c.json({ error: "Missing JWT_SECRET env variable" }, 500);
  }

  const { username, password } = c.req.valid("json");

  const registered = await credentialsFor(c.env).register(
    username,
    await hashPassword(password),
  );

  if (!registered.ok) {
    // The one failure the caller can act on. Unlike the Google flow, which
    // quietly retries under another name, the name here is the caller's choice
    // and only they can change it.
    if (registered.error === PASSWORD_ERRORS.USERNAME_TAKEN) {
      return c.json({ error: registered.error }, 409);
    }
    console.error(registered.error);
    return c.json({ error: "Could not create the account" }, 500);
  }

  await issueSession(c, {
    sub: registered.value.accountId,
    // No email claim at all, rather than an empty one: registration asks for a
    // username and a password, and an unverifiable address collected with
    // nowhere to send anything would be a field that only looks like data.
    name: username,
    picture: "",
  });

  return c.json<PasswordSessionDTO>({ isNew: true }, 201);
});

passwordAuth.post("/password/login", credentialsBody, async (c) => {
  if (!c.env.JWT_SECRET) {
    return c.json({ error: "Missing JWT_SECRET env variable" }, 500);
  }

  const { username, password } = c.req.valid("json");
  const found = await credentialsFor(c.env).findCredentials(username);

  if (!found.ok) {
    if (found.error !== PASSWORD_ERRORS.INVALID_CREDENTIALS) {
      console.error(found.error);
      return c.json({ error: "Could not sign in" }, 500);
    }
    // Spend the same time on a username that does not exist as on one that
    // does, and discard the answer.
    await verifyPassword(password, await unknownUserRecord());
    return c.json({ error: PASSWORD_ERRORS.INVALID_CREDENTIALS }, 401);
  }

  if (!(await verifyPassword(password, found.value.passwordHash))) {
    return c.json({ error: PASSWORD_ERRORS.INVALID_CREDENTIALS }, 401);
  }

  await issueSession(c, {
    sub: found.value.accountId,
    name: username,
    picture: "",
  });

  return c.json<PasswordSessionDTO>({ isNew: false });
});

export default passwordAuth;
