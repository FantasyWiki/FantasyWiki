/**
 * What `GET /api/session` returns: who the player is, plus the parts of the app
 * this deployment can actually offer them.
 */
export interface SessionDTO {
  sub: string;
  /**
   * Absent for a username/password account, which is registered with neither an
   * email nor anywhere to send one (docs/architecture/auth-modes.md). Optional
   * rather than an empty string so the two places that display it can ask, and
   * leave the line out rather than render a blank one.
   */
  email?: string;
  name: string;
  picture: string;
  features: SessionFeaturesDTO;
}

/**
 * Optional features, resolved from the Worker's bindings rather than from a
 * config file, so a deployment cannot claim a capability it has no credentials
 * for.
 *
 * This rides on the session rather than on a route of its own because
 * `/api/session` is the one `/api/*` path MSW passes through to the real
 * backend (`frontend/src/mocks/handlers.ts`). In `devMock` — the mode someone
 * running the app for the first time uses — a dedicated `/api/features` route
 * would be answered by a handler that cannot know what the Worker is bound to.
 */
export interface SessionFeaturesDTO {
  /**
   * The Article Genie (ADR 0006) needs the Workers AI binding, which has no
   * local simulator and so is left out of the `local` environment: a fresh
   * clone has no Cloudflare credentials and the Worker would refuse to start.
   * False means the frontend hides the Genie's entry point entirely rather than
   * offering a button that can only report the genie asleep.
   */
  articleGenie: boolean;
}
