import { env } from "cloudflare:test";
import { Hono } from "hono";
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import reports from "../../routes/reports";
import { PlayerService } from "../../services/player";

// The route builds a real GitHubAppClient, so the only way to keep it off the
// network is to replace global fetch — this pool ignores vi.mock and does not
// expose fetchMock. A genuine RSA key is generated so the App JWT is really
// signed: that path uses WebCrypto and is exactly the part most likely to break.
const realFetch = globalThis.fetch;
let issueRequests: Request[] = [];
let tokenRequests: Request[] = [];

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const pkcs8 = (await crypto.subtle.exportKey(
    "pkcs8",
    pair.privateKey,
  )) as ArrayBuffer;
  const base64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));

  Object.assign(env, {
    GH_APP_ID: "123456",
    GH_APP_INSTALLATION_ID: "7654321",
    GH_APP_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`,
  });
});

afterEach(() => {
  globalThis.fetch = realFetch;
  issueRequests = [];
  tokenRequests = [];
  vi.restoreAllMocks();
});

/**
 * Answers both calls the App flow makes: exchange the signed JWT for an
 * installation token, then create the issue with it.
 */
function interceptGitHub(issueStatus: number, issueBody: unknown) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input as RequestInfo, init);

    if (request.url.includes("/access_tokens")) {
      tokenRequests.push(request);
      return Response.json({
        token: "ghs_installation_token",
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      });
    }

    issueRequests.push(request);
    return new Response(JSON.stringify(issueBody), {
      status: issueStatus,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

/** Mounts the route behind a stand-in for the JWT middleware. */
function appFor(googleAccountId: string) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("jwtPayload", { sub: googleAccountId });
    await next();
  });
  app.route("/api/reports", reports);
  return app;
}

function post(app: Hono, body: unknown) {
  return app.request(
    "/api/reports",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
  );
}

const VALID_REPORT = {
  category: "broken",
  title: "Market never loads",
  body: "It spins forever after I buy a contract.",
  contactConsent: false,
};

describe("POST /api/reports", () => {
  let app: Hono;

  beforeEach(async () => {
    // A fresh account per test: the rate limiter keys on the player, and it is
    // real (not stubbed) in this pool, so reusing an id leaks quota across tests.
    const accountId = `account-report-${crypto.randomUUID()}`;
    const player = await new PlayerService(env.db).createPlayer(
      `reporter-${crypto.randomUUID()}`,
      "reporter@example.com",
      accountId,
    );
    expect(player.ok).toBe(true);
    app = appFor(accountId);
  });

  it("returns 201 with the created issue, filed as the app", async () => {
    interceptGitHub(201, {
      number: 7,
      html_url: "https://github.com/FantasyWiki/FantasyWiki/issues/7",
    });

    const response = await post(app, VALID_REPORT);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      issueNumber: 7,
      issueUrl: "https://github.com/FantasyWiki/FantasyWiki/issues/7",
    });

    // The App JWT was exchanged for an installation token, and the issue was
    // created with that token — this is what makes the author FantasyWiki[bot].
    expect(tokenRequests).toHaveLength(1);
    expect(tokenRequests[0].url).toBe(
      "https://api.github.com/app/installations/7654321/access_tokens",
    );
    expect(tokenRequests[0].headers.get("Authorization")).toMatch(
      /^Bearer eyJ/,
    );

    expect(issueRequests).toHaveLength(1);
    expect(issueRequests[0].url).toBe(
      "https://api.github.com/repos/FantasyWiki/FantasyWiki/issues",
    );
    expect(issueRequests[0].headers.get("Authorization")).toBe(
      "Bearer ghs_installation_token",
    );

    // The labels have to actually reach GitHub: they are what keeps user
    // reports filterable out of the maintainers' own board.
    const sent = (await issueRequests[0].json()) as { labels: string[] };
    expect(sent.labels).toEqual(["user-report", "bug"]);
  });

  it("returns 400 on a validation failure without calling GitHub", async () => {
    interceptGitHub(201, {});

    const response = await post(app, { ...VALID_REPORT, body: "  " });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "REPORT_BODY_REQUIRED" });
    expect(issueRequests).toHaveLength(0);
    expect(tokenRequests).toHaveLength(0);
  });

  // 502 is what tells the frontend to offer the pre-filled GitHub link, so the
  // reporter never loses what they typed. Getting this status wrong silently
  // removes that escape hatch.
  it("returns 502 when GitHub rejects the request", async () => {
    interceptGitHub(401, { message: "Bad credentials" });

    const response = await post(app, VALID_REPORT);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "REPORT_SUBMISSION_FAILED",
    });
  });

  it("returns 429 once the burst limit is exhausted", async () => {
    interceptGitHub(201, {
      number: 1,
      html_url: "https://github.com/FantasyWiki/FantasyWiki/issues/1",
    });

    // The binding allows 3 per 60s per player.
    for (let i = 0; i < 3; i++) {
      expect((await post(app, VALID_REPORT)).status).toBe(201);
    }

    const response = await post(app, VALID_REPORT);

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "REPORT_RATE_LIMITED" });
  });
});
