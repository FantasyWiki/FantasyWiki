/**
 * Username/password sign-in, which only the MongoDB build serves — the deployed
 * Worker does not contain the routes at all
 * (docs/architecture/auth-modes.md).
 *
 * These live in the shared package like every other DTO because they are types
 * and nothing else: they are erased at build time, so describing them here
 * costs the deployed bundle nothing, and the frontend is a single build that
 * needs them for the form it hides behind `VITE_PASSWORD_AUTH`.
 */
export interface PasswordCredentialsRequest {
  username: string;
  password: string;
}

/**
 * What both register and login answer with. The session itself arrives as the
 * `session_token` cookie, exactly as it does from the Google flow; this only
 * says where to go next.
 */
export interface PasswordSessionDTO {
  /** True when the account was just created, so the SPA starts onboarding. */
  isNew: boolean;
}

/**
 * What a username has to look like.
 *
 * Stated once, here, because both sides need the same numbers: the backend to
 * refuse, and the form to say what is expected *before* anyone is refused. A
 * second copy in the frontend is how hint text comes to promise something the
 * validator does not honour.
 *
 * A password has **no floor and no composition rules**: any string is accepted,
 * empty included. Minimums and "must contain a digit" push people towards
 * `Password1!` and buy less entropy than length does.
 *
 * It has a **ceiling**, and that one is not a usability rule — it is the only
 * thing standing between this endpoint and unbounded work. The whole submitted
 * string is fed to PBKDF2, so cost grows with length and an unbounded password
 * is unbounded CPU per unauthenticated request. The body limit bounds it too,
 * but coarsely and one layer up, where raising it for an unrelated reason would
 * silently widen this.
 */
export const PASSWORD_RULES = {
  /** Public — a username names a player in every league table. */
  USERNAME_PATTERN: /^[A-Za-z0-9_-]{3,30}$/,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  /** Far above any real password or passphrase, far below a denial of service. */
  PASSWORD_MAX: 200,
} as const;

/**
 * Why a request was refused with 400, as a constant the frontend matches on
 * exactly (docs/architecture/backend-error-constants.md). The wording a user
 * reads is the frontend's, translated; these are the codes it branches on.
 *
 * Deliberately *specific*, unlike the 401 that a wrong password and an unknown
 * username share. Vagueness there is the point — it is what stops a login form
 * being a way to find out who has an account. Vagueness here would only stop
 * someone finding out that the name they typed is not a legal one.
 */
export const PASSWORD_REQUEST_ERRORS = {
  USERNAME_INVALID: "USERNAME_INVALID",
  PASSWORD_TOO_LONG: "PASSWORD_TOO_LONG",
} as const;

export type PasswordRequestError =
  (typeof PASSWORD_REQUEST_ERRORS)[keyof typeof PASSWORD_REQUEST_ERRORS];
