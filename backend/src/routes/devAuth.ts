import { Hono } from "hono";
import { LoginService } from "../services/login";
import { PlayerService } from "../services/player";
import { AppVariables } from "../appEnv";
import { resolveFrontendUrl } from "./auth";
import { issueSession } from "./issueSession";

type Bindings = {
  JWT_SECRET: string;
  FRONTEND_URL: string;
  /**
   * Set per environment in `wrangler.jsonc`. Only `local` and `local-genie`
   * carry `"local"`; `production`, `preview` and `test` do not, which is what
   * confines this route to a machine someone is running Wrangler on.
   */
  ENVIRONMENT: string;
};

/**
 * Signing in without Google, so the app can be run by someone who has no share
 * of the project's OAuth client — a reviewer, a new collaborator, or the
 * container in `compose.yaml` (docs/development/docker-local-dev.md).
 *
 * It is the Google flow with the identity provider removed, and nothing else:
 * the same `LoginService` call, the same claims, the same secret, the same
 * cookie, the same redirect. A demo player is an ordinary player, so no feature
 * downstream has to know this route exists.
 */
const devAuth = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

/**
 * The account this route signs in as. Google subjects are numeric strings, so
 * a value shaped like this can never collide with a real one — the demo player
 * and a Google player cannot become the same row.
 */
const DEV_ACCOUNT_ID = "dev-local-player";
const DEV_EMAIL = "demo@localhost";
const DEV_NAME = "Demo Player";

devAuth.get("/dev", async (c) => {
  // 404, not 403: outside local development this route does not exist at all,
  // and saying "forbidden" would advertise that it exists somewhere. The
  // frontend gates its button separately on a Vite variable, so neither side
  // has to trust the other.
  if (c.env.ENVIRONMENT !== "local") {
    return c.notFound();
  }

  if (!c.env.JWT_SECRET) {
    return c.json({ error: "Missing JWT_SECRET env variable" }, 500);
  }

  const frontendUrl = resolveFrontendUrl(c.env);

  const loginService = new LoginService({
    playerService: new PlayerService(c.var.repositories),
  });
  const playerResult = await loginService.loginWithGoogleAccount(
    DEV_ACCOUNT_ID,
    DEV_EMAIL,
  );

  if (!playerResult.ok) {
    console.error(playerResult.error);
    return c.redirect(`${frontendUrl}/home?error=player_creation_failed`);
  }

  await issueSession(c, {
    sub: DEV_ACCOUNT_ID,
    email: DEV_EMAIL,
    name: DEV_NAME,
    picture: "",
  });

  const callbackUrl = playerResult.value.isNew
    ? `${frontendUrl}/auth/callback?new=1`
    : `${frontendUrl}/auth/callback`;
  return c.redirect(callbackUrl);
});

export default devAuth;
