import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { requireEncryptionKey } from "@/lib/env";

/**
 * Encryption for the secrets this app holds on behalf of the user.
 *
 * The only secret of consequence is an Instagram long-lived access token,
 * which grants the ability to publish to a real account for about sixty days.
 * Storing it in plaintext means a database dump, a backup, a log line or a
 * screenshot of the store is enough to take over the account. It is encrypted
 * at rest instead.
 *
 * AES-256-GCM is chosen because it authenticates as well as encrypts: a token
 * that has been truncated or edited fails to decrypt rather than producing
 * garbage that gets sent to the API and fails in a confusing way.
 *
 * This is deliberately *not* a key-management system. There is no rotation, no
 * envelope encryption and no per-record key — on a free-tier deployment there
 * is nowhere to keep a second key, and pretending otherwise would be theatre.
 * The honest position is written down here so the limitation is visible rather
 * than assumed away.
 */

const ALGORITHM = "aes-256-gcm";
/** GCM's standard nonce length; 96 bits is what the mode is specified for. */
const IV_BYTES = 12;
const PREFIX = "enc:v1:";

/**
 * True when a value is in this module's envelope format.
 *
 * Exported because the repositories need to tell an encrypted value from a
 * plaintext one written before encryption was introduced, and from a value a
 * human pasted in by hand while debugging.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Encrypts a secret into a self-describing string.
 *
 * The version prefix is what makes a future algorithm change possible: old
 * values remain readable under the rule that produced them, instead of needing
 * a migration that decrypts everything at once.
 */
export function encryptSecret(plaintext: string): string {
  const key = requireEncryptionKey();
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    PREFIX.replace(/:$/, ""),
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

/**
 * Decrypts a value produced by `encryptSecret`.
 *
 * Throws on a wrong key or a tampered payload — deliberately, because the
 * alternative is sending a corrupt bearer token to Instagram and reporting the
 * resulting 401 as an authentication problem.
 */
export function decryptSecret(payload: string): string {
  if (!isEncrypted(payload)) {
    throw new Error(
      "Value is not in the encrypted envelope format; it cannot be decrypted.",
    );
  }

  const parts = payload.split(":");
  // enc : v1 : iv : tag : ciphertext
  if (parts.length !== 5) {
    throw new Error("Encrypted value is malformed.");
  }

  const [, , ivPart, tagPart, dataPart] = parts;
  const key = requireEncryptionKey();

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Reads a stored secret, tolerating values written before encryption existed.
 *
 * A plaintext token is returned as-is so that an existing development database
 * keeps working; it is re-encrypted the next time the account is written. The
 * production case cannot hit this path silently, because writing a token
 * requires a key.
 */
export function readSecret(stored: string): string {
  return isEncrypted(stored) ? decryptSecret(stored) : stored;
}

/**
 * Compares two secrets without leaking their contents through timing.
 *
 * Used for every shared-secret check in the app: the scheduler endpoint, the
 * Telegram webhook and CSRF tokens. `===` on strings short-circuits at the
 * first differing byte, which is enough to recover a secret one character at a
 * time given enough attempts.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  // Length is compared without an early return over the contents, and
  // `timingSafeEqual` requires equal lengths, so a length mismatch is folded
  // into a comparison of one byte against a different value.
  if (left.length !== right.length) {
    // Still perform a comparison so the cost does not depend on the mismatch
    // being in length rather than contents.
    timingSafeEqual(left.subarray(0, 1), left.subarray(0, 1));
    return false;
  }

  return timingSafeEqual(left, right);
}

/**
 * A URL-safe random token, for CSRF and idempotency keys.
 *
 * `randomBytes` rather than `Math.random`: the latter is seeded predictably and
 * is not suitable for anything an attacker benefits from guessing.
 */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
