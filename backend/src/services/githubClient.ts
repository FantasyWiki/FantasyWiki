import { Result, failure, success } from "../repositories/result";

export const GITHUB_ERRORS = {
  REQUEST_FAILED: "GITHUB_REQUEST_FAILED",
  AUTH_FAILED: "GITHUB_AUTH_FAILED",
} as const;

export interface CreateIssueInput {
  title: string;
  body: string;
  labels: string[];
}

export interface CreatedIssue {
  issueNumber: number;
  issueUrl: string;
}

/**
 * The seam the report service depends on. It exists so tests can substitute a
 * stub: the Workers test pool silently ignores `vi.mock`, so the only reliable
 * way to keep a test off the network is to inject the collaborator.
 */
export interface GitHubClient {
  createIssue(input: CreateIssueInput): Promise<Result<CreatedIssue>>;
}

export interface GitHubAppCredentials {
  appId: string;
  installationId: string;
  /** PKCS#8 PEM. GitHub hands out PKCS#1 — see docs/architecture/problem-reports.md. */
  privateKeyPem: string;
  /** "owner/repo", e.g. "FantasyWiki/FantasyWiki". */
  repo: string;
}

interface GitHubIssueResponse {
  number: number;
  html_url: string;
}

interface InstallationTokenResponse {
  token: string;
  expires_at: string;
}

const GITHUB_API = "https://api.github.com";

// GitHub rejects requests without a User-Agent.
const BASE_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "FantasyWiki",
};

/**
 * Files issues as the GitHub App, so they are authored by `FantasyWiki[bot]`
 * rather than by whichever maintainer's token was used. Installation tokens are
 * minted on demand and live an hour, so there is no expiring PAT to rotate.
 */
export class GitHubAppClient implements GitHubClient {
  /**
   * Cached per isolate. Worth doing because a token exchange is a whole extra
   * round trip to GitHub on every report, and the token is valid for an hour.
   */
  private cachedToken?: { token: string; expiresAt: number };

  constructor(private readonly credentials: GitHubAppCredentials) {}

  async createIssue(input: CreateIssueInput): Promise<Result<CreatedIssue>> {
    const token = await this.installationToken();
    if (!token.ok) {
      return token;
    }

    let response: Response;
    try {
      response = await fetch(
        `${GITHUB_API}/repos/${this.credentials.repo}/issues`,
        {
          method: "POST",
          headers: {
            ...BASE_HEADERS,
            Authorization: `Bearer ${token.value}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        },
      );
    } catch {
      return failure(GITHUB_ERRORS.REQUEST_FAILED);
    }

    if (!response.ok) {
      return failure(GITHUB_ERRORS.REQUEST_FAILED);
    }

    const issue = (await response.json()) as GitHubIssueResponse;
    return success({ issueNumber: issue.number, issueUrl: issue.html_url });
  }

  private async installationToken(): Promise<Result<string>> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return success(this.cachedToken.token);
    }

    let appJwt: string;
    try {
      appJwt = await signAppJwt(
        this.credentials.appId,
        this.credentials.privateKeyPem,
      );
    } catch {
      // A malformed or PKCS#1 private key lands here.
      return failure(GITHUB_ERRORS.AUTH_FAILED);
    }

    let response: Response;
    try {
      response = await fetch(
        `${GITHUB_API}/app/installations/${this.credentials.installationId}/access_tokens`,
        {
          method: "POST",
          headers: { ...BASE_HEADERS, Authorization: `Bearer ${appJwt}` },
        },
      );
    } catch {
      return failure(GITHUB_ERRORS.AUTH_FAILED);
    }

    if (!response.ok) {
      return failure(GITHUB_ERRORS.AUTH_FAILED);
    }

    const body = (await response.json()) as InstallationTokenResponse;
    this.cachedToken = {
      token: body.token,
      expiresAt: Date.parse(body.expires_at),
    };
    return success(body.token);
  }
}

// ── App JWT signing ──────────────────────────────────────────────────────────
// Workers ship WebCrypto, so no library is needed. GitHub requires RS256 and
// rejects an `exp` more than 10 minutes out.

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeJson(value: object): string {
  return base64url(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToPkcs8(pem: string): ArrayBuffer {
  // Wrangler secrets are single-line, so a PEM arrives with escaped newlines.
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END)[^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function signAppJwt(
  appId: string,
  privateKeyPem: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    // Backdated by a minute to absorb clock skew between us and GitHub.
    iat: now - 60,
    exp: now + 540,
    iss: appId,
  };

  const signingInput = `${encodeJson({ alg: "RS256", typ: "JWT" })}.${encodeJson(payload)}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}
