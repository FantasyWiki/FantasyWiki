import { timingSafeEqual } from "hono/utils/buffer";

/**
 * Password hashing, on nothing but WebCrypto.
 *
 * PBKDF2 rather than Argon2id, which is the better algorithm, because every
 * Argon2 build for this runtime is a WASM dependency — and a new dependency in
 * the supply chain is exactly what keeping password auth out of the deployed
 * Worker is meant to avoid. `crypto.subtle` is already there, in every build,
 * and costs nothing (docs/architecture/auth-modes.md).
 */

const ALGORITHM = "pbkdf2";
const HASH = "sha256";
/**
 * Raising this applies to new passwords only — {@link verifyPassword} reads the
 * count off each record. Two things then need doing together with it: re-hash a
 * record on the next successful login so stored passwords actually get the new
 * cost, and note that until they do, the dummy verify in `routes/passwordAuth.ts`
 * costs the new count while a real record costs the old one — which is a timing
 * difference between a username that exists and one that does not.
 */
const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

/**
 * A stored credential, self-describing so the cost can be raised later without
 * invalidating what is already stored: {@link verifyPassword} derives with the
 * parameters written into the record it was given, never with the constants
 * above. Raising ITERATIONS then applies to new passwords, and old ones keep
 * verifying until they are next written.
 */
const FIELD_SEPARATOR = "$";

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveBits(password, salt, ITERATIONS);
  return [
    ALGORITHM,
    HASH,
    String(ITERATIONS),
    encode(salt),
    encode(derived),
  ].join(FIELD_SEPARATOR);
}

/**
 * Whether `password` is the one `record` was made from.
 *
 * Constant-time, via Hono's `timingSafeEqual` — already how the scoring ingest
 * token is compared (`routes/internal.ts`). It takes strings and HMACs both
 * sides, so it is safe on records of differing lengths, which is what a record
 * written under older parameters is.
 *
 * A malformed record returns false rather than throwing: it is data, and the
 * caller is a login endpoint that has one answer for everything that is not a
 * match.
 */
export async function verifyPassword(
  password: string,
  record: string,
): Promise<boolean> {
  const parsed = parse(record);
  if (!parsed) return false;

  const derived = await deriveBits(password, parsed.salt, parsed.iterations);
  return timingSafeEqual(encode(derived), parsed.hash);
}

interface ParsedRecord {
  iterations: number;
  salt: Uint8Array;
  /** Still encoded: the comparison is done on the encoded form. */
  hash: string;
}

function parse(record: string): ParsedRecord | null {
  const [algorithm, hash, iterations, salt, key] =
    record.split(FIELD_SEPARATOR);
  if (algorithm !== ALGORITHM || hash !== HASH) return null;

  const rounds = Number(iterations);
  if (!Number.isSafeInteger(rounds) || rounds <= 0) return null;
  if (!salt || !key) return null;

  // `atob` throws on anything that is not base64, and this is stored data
  // rather than a value this module produced — so a record someone wrote by
  // hand has to fail the match, not the request. Without this the caller,
  // which has no try/catch, answers 500 instead of 401, and that one account
  // becomes distinguishable from every other: exactly what the dummy verify
  // above it exists to prevent.
  const decoded = decodeOrNull(salt);
  if (!decoded) return null;

  return { iterations: rounds, salt: decoded, hash: key };
}

function decodeOrNull(encoded: string): Uint8Array | null {
  try {
    return decode(encoded);
  } catch {
    return null;
  }
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as BufferSource,
      iterations,
    },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function decode(encoded: string): Uint8Array {
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}
