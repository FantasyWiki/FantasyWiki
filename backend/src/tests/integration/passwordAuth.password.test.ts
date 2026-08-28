import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { verify } from "hono/jwt";
import { app } from "../../indexPassword";
import { PASSWORD_ERRORS } from "../../auth/password/credentialRepository";
import {
  PASSWORD_REQUEST_ERRORS,
  PASSWORD_RULES,
} from "../../../../dto/passwordAuthDTO";
import { store } from "../support/target";
import { unique } from "../support/subjects";

/**
 * Username/password sign-in, driven through the wired app.
 *
 * `*.password.test.ts`, so only the Mongo run collects it: the D1 build does
 * not contain these routes (docs/architecture/auth-modes.md). It imports
 * `indexPassword`, the entry that mounts them — importing `index` here would be
 * testing the wrong Worker.
 */

const JWT_SECRET = "test-jwt-secret";
const FRONTEND_URL = "localhost:5173";
const ORIGIN = `http://${FRONTEND_URL}`;

const PASSWORD = "a-long-enough-password";

async function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return await app.request(
    path,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
        ...headers,
      },
      body: JSON.stringify(body),
    },
    { ...env, JWT_SECRET, FRONTEND_URL },
  );
}

function sessionCookie(response: Response): string {
  const header = response.headers.get("set-cookie") ?? "";
  return header.split(";")[0].replace("session_token=", "");
}

describe("username/password sign-in", () => {
  beforeEach(async () => {
    await store().reset();
  });

  it("registers, and signs a session the JWT middleware accepts", async () => {
    const username = unique("registrant");

    const response = await post("/auth/password/register", {
      username,
      password: PASSWORD,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ isNew: true });

    // The same secret and algorithm the Google flow signs with — one session
    // type, not two, which is why nothing downstream special-cases it.
    const claims = await verify(sessionCookie(response), JWT_SECRET, "HS256");
    expect(claims.name).toBe(username);
    expect(claims.sub).toMatch(/^pwd_/);
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("carries that session into the guarded API", async () => {
    const username = unique("registrant");
    const registered = await post("/auth/password/register", {
      username,
      password: PASSWORD,
    });

    const session = await app.request(
      "/api/session",
      { headers: { Cookie: `session_token=${sessionCookie(registered)}` } },
      { ...env, JWT_SECRET, FRONTEND_URL },
    );

    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({ name: username });
  });

  it("signs in again with the same password", async () => {
    const username = unique("registrant");
    await post("/auth/password/register", { username, password: PASSWORD });

    const response = await post("/auth/password/login", {
      username,
      password: PASSWORD,
    });

    expect(response.status).toBe(200);
    // Not a new account, so the SPA goes home rather than into onboarding.
    expect(await response.json()).toEqual({ isNew: false });
    expect(sessionCookie(response)).not.toBe("");
  });

  it("resolves the same player on registration and on later sign-in", async () => {
    const username = unique("registrant");
    const registered = await post("/auth/password/register", {
      username,
      password: PASSWORD,
    });
    const loggedIn = await post("/auth/password/login", {
      username,
      password: PASSWORD,
    });

    const first = await verify(sessionCookie(registered), JWT_SECRET, "HS256");
    const second = await verify(sessionCookie(loggedIn), JWT_SECRET, "HS256");

    expect(second.sub).toBe(first.sub);
  });

  it("refuses a username that is already taken", async () => {
    const username = unique("registrant");
    await post("/auth/password/register", { username, password: PASSWORD });

    const again = await post("/auth/password/register", {
      username,
      password: "another-long-password",
    });

    expect(again.status).toBe(409);
    expect(again.headers.get("set-cookie")).toBeNull();
  });

  /**
   * The two failures a login can have, answered identically. A caller that
   * could tell them apart would have a way to find out who has an account.
   */
  it("answers a wrong password and an unknown user the same way", async () => {
    const username = unique("registrant");
    await post("/auth/password/register", { username, password: PASSWORD });

    const wrongPassword = await post("/auth/password/login", {
      username,
      password: "not-the-password",
    });
    const unknownUser = await post("/auth/password/login", {
      username: unique("nobody"),
      password: PASSWORD,
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.headers.get("set-cookie")).toBeNull();
    expect(unknownUser.headers.get("set-cookie")).toBeNull();

    const expected = { error: PASSWORD_ERRORS.INVALID_CREDENTIALS };
    expect(await wrongPassword.json()).toEqual(expected);
    expect(await unknownUser.json()).toEqual(expected);
  });

  /**
   * Which rule was broken, not merely that one was. Unlike the 401, a malformed
   * password says nothing about who has an account, so there is nothing to
   * protect by being vague — and someone choosing a password needs to be told
   * it was too short.
   */
  it.each([
    [
      "a username with spaces",
      { username: "not a handle", password: PASSWORD },
      PASSWORD_REQUEST_ERRORS.USERNAME_INVALID,
    ],
    [
      "a username too short",
      { username: "ab", password: PASSWORD },
      PASSWORD_REQUEST_ERRORS.USERNAME_INVALID,
    ],
    [
      "a username too long",
      { username: "x".repeat(31), password: PASSWORD },
      PASSWORD_REQUEST_ERRORS.USERNAME_INVALID,
    ],
    ["nothing at all", {}, PASSWORD_REQUEST_ERRORS.USERNAME_INVALID],
    [
      "a password past the ceiling",
      {
        username: "handle",
        password: "x".repeat(PASSWORD_RULES.PASSWORD_MAX + 1),
      },
      PASSWORD_REQUEST_ERRORS.PASSWORD_TOO_LONG,
    ],
  ])("refuses %s, and says which", async (_case, body, expected) => {
    const response = await post("/auth/password/register", body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expected });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  /**
   * No floor and no composition rules: the only thing a password can fail is
   * the ceiling, and that is bounded work rather than a rule about passwords.
   */
  it.each([
    ["a short one", "x"],
    ["an empty one", ""],
    ["one that is only spaces", "     "],
    ["one exactly at the ceiling", "x".repeat(PASSWORD_RULES.PASSWORD_MAX)],
  ])("accepts %s", async (_case, password) => {
    const username = unique("registrant");

    const registered = await post("/auth/password/register", {
      username,
      password,
    });
    expect(registered.status).toBe(201);

    // And it is still the password: the account signs in with it and not
    // with another.
    const back = await post("/auth/password/login", { username, password });
    expect(back.status).toBe(200);

    // Altered rather than lengthened: at the ceiling, appending would break the
    // length rule and answer 400, which is not the thing under test here.
    const wrong = await post("/auth/password/login", {
      username,
      password: `y${password.slice(1)}`,
    });
    expect(wrong.status).toBe(401);
  });

  /**
   * The line between the two kinds of refusal: a 400 names the rule a request
   * broke, a 401 never names the half that was wrong.
   */
  it("names no rule when the credentials are merely wrong", async () => {
    const username = unique("registrant");
    await post("/auth/password/register", { username, password: PASSWORD });

    const response = await post("/auth/password/login", {
      username,
      password: "not-the-password",
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: PASSWORD_ERRORS.INVALID_CREDENTIALS,
    });
  });
  /**
   * The app's CORS layer reflects whatever origin asks, so a cross-site POST to
   * login is not a nuisance but an attack: it would sign the victim into an
   * account the attacker controls.
   */
  it("refuses a request from another origin", async () => {
    const response = await post(
      "/auth/password/login",
      { username: unique("registrant"), password: PASSWORD },
      { Origin: "https://attacker.example" },
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("refuses a body past the size limit", async () => {
    const response = await post("/auth/password/register", {
      username: unique("registrant"),
      password: PASSWORD,
      padding: "x".repeat(8 * 1024),
    });

    expect(response.status).toBe(413);
  });
});
