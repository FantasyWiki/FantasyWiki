import { describe, expect, it } from "vitest";
import { sign } from "hono/jwt";
import app from "../../index";

type TestBindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
};

function makeEnv(overrides: Partial<TestBindings> = {}): TestBindings {
  return {
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    JWT_SECRET: "super-secret-for-tests",
    FRONTEND_URL: "localhost:5173",
    ...overrides,
  };
}

describe("backend app", () => {
  it("returns runtime frontend resolution on GET /", async () => {
    const response = await app.fetch(
      new Request("http://localhost/"),
      makeEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resolved_url: "http://localhost:5173",
      FRONTEND_URL: "localhost:5173",
    });
  });

  it("requires JWT cookie for protected routes", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/session"),
      makeEnv(),
    );

    expect(response.status).toBe(401);
  });

  it("returns session payload when session_token cookie is valid", async () => {
    const env = makeEnv();
    const token = await sign(
      {
        sub: "user-1",
        email: "user@example.com",
        name: "User One",
        picture: "https://example.com/u.png",
      },
      env.JWT_SECRET,
      "HS256",
    );

    const response = await app.fetch(
      new Request("http://localhost/api/session", {
        headers: { Cookie: `session_token=${token}` },
      }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sub: "user-1",
      email: "user@example.com",
      name: "User One",
      picture: "https://example.com/u.png",
    });
  });

  it("returns 500 on /auth/google when GOOGLE_CLIENT_ID is missing", async () => {
    const response = await app.fetch(
      new Request("http://localhost/auth/google"),
      makeEnv({ GOOGLE_CLIENT_ID: "" }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Missing OAuth GOOGLE_CLIENT_ID",
    });
  });
});
