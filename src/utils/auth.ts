import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/**
 * Hash a password using scrypt.
 * Returns string in format: salt:hash
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString('hex')}`;
}

/**
 * Verify a password against a stored `salt:hash` string.
 *
 * Hardened: a malformed or truncated stored hash must never throw (which would
 * surface as a 500 and could be abused for DoS / user enumeration). Any parsing
 * problem or length mismatch simply results in "invalid credentials".
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    if (typeof storedHash !== 'string') return false;

    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;

    const expected = Buffer.from(hash, 'hex');
    // 64 = the digest length produced by hashPassword(); reject anything else
    // before calling timingSafeEqual (which throws on length mismatch).
    if (expected.length !== 64) return false;

    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return timingSafeEqual(buf, expected);
  } catch {
    return false;
  }
}
