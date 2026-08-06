import {
  INVITATION_CODE_ALPHABET,
  INVITATION_CODE_LENGTH,
} from "../../../model/league";
import { LEAGUE_ERRORS } from "../repositories/leagueRepository";
import { Result, failure } from "../repositories/result";

/**
 * The largest multiple of the alphabet size that fits in a byte. Bytes at or
 * above it are thrown away rather than folded with `%`, which would hand the
 * first 16 characters of the alphabet a slightly better chance than the rest.
 * The bias is tiny and nobody is guessing these codes — but a biased draw in a
 * credential generator is the kind of thing that is free to get right here and
 * expensive to notice later.
 */
const REJECTION_CEILING =
  Math.floor(256 / INVITATION_CODE_ALPHABET.length) *
  INVITATION_CODE_ALPHABET.length;

/**
 * A fresh invitation code. Uniqueness is not this function's job — it draws,
 * and `withUniqueInvitationCode` deals with the (rare) collision.
 */
export function generateInvitationCode(): string {
  let code = "";
  while (code.length < INVITATION_CODE_LENGTH) {
    // A generous batch, so the common case is one trip to the CSPRNG even
    // after a few rejections.
    const bytes = new Uint8Array(INVITATION_CODE_LENGTH * 2);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= REJECTION_CEILING) continue;
      code += INVITATION_CODE_ALPHABET[byte % INVITATION_CODE_ALPHABET.length];
      if (code.length === INVITATION_CODE_LENGTH) break;
    }
  }
  return code;
}

/** How many codes to try before treating collisions as a fault, not bad luck. */
export const INVITATION_CODE_ATTEMPTS = 5;

/**
 * Run a write that needs a free invitation code, redrawing if the unique index
 * rejects the one it was given.
 *
 * A helper rather than a loop inlined at the call site so the caller — league
 * creation, when it arrives (#4) — states only its INSERT and inherits the
 * retry policy. It also makes the policy testable on its own, with a fake
 * `write`, before any caller exists.
 *
 * Bounded on purpose: an unbounded regenerate loop turns a broken RNG or a
 * mis-declared index into a hung request instead of an error.
 */
export async function withUniqueInvitationCode<T>(
  write: (code: string) => Promise<Result<T>>,
  attempts: number = INVITATION_CODE_ATTEMPTS,
): Promise<Result<T>> {
  for (let i = 0; i < attempts; i++) {
    const result = await write(generateInvitationCode());
    if (result.ok || result.error !== LEAGUE_ERRORS.INVITATION_CODE_TAKEN) {
      // Success, or a real persistence failure that retrying would only repeat.
      return result;
    }
  }
  return failure(LEAGUE_ERRORS.INVITATION_CODE_UNAVAILABLE);
}
