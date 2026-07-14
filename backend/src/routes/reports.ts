import { Hono } from "hono";
import { CreateProblemReportRequest } from "../../../dto/problemReportDTO";
import { GitHubAppClient } from "../services/githubClient";
import { REPORT_ERRORS, ProblemReportService } from "../services/problemReport";
import { playerErrorStatus, resolveCurrentPlayer } from "./helpers";

/**
 * Cloudflare's rate limiting binding. The platform only supports a 10s or 60s
 * period, so this guards against bursts (double submits, a script) rather than
 * imposing a daily quota — a daily cap would need storage, and the repository
 * is publicly writable anyway, so the form adds convenience, not a new abuse
 * surface. What this really protects is the shared PAT, which is what GitHub's
 * secondary limits would punish.
 */
interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

type Bindings = {
  db: D1Database;
  /**
   * GitHub App credentials. The App is what makes issues appear as
   * `FantasyWiki[bot]` instead of under a maintainer's own account, and it
   * removes the expiring-PAT rotation entirely. The private key is a secret;
   * the ids are plain vars. Names avoid the `GITHUB_` prefix, which GitHub
   * reserves and refuses to let you use for an Actions secret.
   */
  GH_APP_ID: string;
  GH_APP_INSTALLATION_ID: string;
  GH_APP_PRIVATE_KEY: string;
  GITHUB_REPO: string;
  ENVIRONMENT: string;
  REPORT_RATE_LIMITER: RateLimiter;
};

const reports = new Hono<{ Bindings: Bindings }>();

const VALIDATION_ERRORS: string[] = [
  REPORT_ERRORS.INVALID_CATEGORY,
  REPORT_ERRORS.TITLE_REQUIRED,
  REPORT_ERRORS.TITLE_TOO_LONG,
  REPORT_ERRORS.BODY_REQUIRED,
];

reports.post("/", async (c) => {
  // Identity comes from the session, never from the body (api-naming-rules).
  const playerResult = await resolveCurrentPlayer(c);
  if (!playerResult.ok) {
    return c.json(
      { error: playerResult.error },
      playerErrorStatus(playerResult.error),
    );
  }
  const player = playerResult.value;

  const { success } = await c.env.REPORT_RATE_LIMITER.limit({
    key: player.id,
  });
  if (!success) {
    return c.json({ error: "REPORT_RATE_LIMITED" }, 429);
  }

  let request: CreateProblemReportRequest;
  try {
    request = await c.req.json<CreateProblemReportRequest>();
  } catch {
    return c.json({ error: REPORT_ERRORS.MALFORMED_BODY }, 400);
  }

  const service = new ProblemReportService(
    new GitHubAppClient({
      appId: c.env.GH_APP_ID,
      installationId: c.env.GH_APP_INSTALLATION_ID,
      privateKeyPem: c.env.GH_APP_PRIVATE_KEY,
      repo: c.env.GITHUB_REPO,
    }),
  );
  const result = await service.submit(request, {
    playerId: player.id,
    environment: c.env.ENVIRONMENT,
  });

  if (!result.ok) {
    // A validation failure is the client's fault; a GitHub outage is not, and
    // the frontend answers 502 by offering the pre-filled GitHub issue link so
    // the reporter never loses what they typed.
    const status = VALIDATION_ERRORS.includes(result.error) ? 400 : 502;
    return c.json({ error: result.error }, status);
  }

  return c.json(result.value, 201);
});

export default reports;
