import { createHmac, timingSafeEqual, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env';

/**
 * HMAC-SHA256 hash of PII data (e.g. phone numbers).
 * Used to store identifiers without revealing raw PII.
 */
export function hashPII(data: string): string {
  if (!data) throw new Error('DATA_REQUIRED_FOR_HASHING');

  return createHmac('sha256', env.HMAC_KEY)
    .update(data)
    .digest('hex');
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
export function comparePII(data: string, hash: string): boolean {
  const newHash = hashPII(data);
  try {
    return timingSafeEqual(
      Buffer.from(newHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  } catch {
    return false;
  }
}

// ─── Reversible PII encryption (AES-256-GCM) ──────────────────────────────────
// hashPII() is one-way — perfect for lookups/dedup, useless when the server
// genuinely needs the real number back (e.g. sending a manual WhatsApp reply
// from the dashboard). This gives that narrow, auditable exception: only
// server-side code with PHONE_ENC_KEY can decrypt, and it's a distinct secret
// from HMAC_KEY so leaking one doesn't compromise the other.
const ENC_ALGO = 'aes-256-gcm';

function getEncKey(): Buffer {
  const key = Buffer.from(env.PHONE_ENC_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('PHONE_ENC_KEY must be a 64-char hex string (32 bytes) for AES-256');
  }
  return key;
}

/**
 * Encrypts PII (e.g. a phone number) for reversible server-side storage.
 * Output format: iv:authTag:ciphertext (all hex), self-contained per record.
 */
export function encryptPII(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENC_ALGO, getEncKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts a value produced by encryptPII(). Returns null on any failure
 * (malformed data, wrong key, tampered ciphertext) instead of throwing —
 * callers should treat null as "phone unavailable", not crash the request.
 */
export function decryptPII(encrypted: string): string | null {
  try {
    const [ivHex, tagHex, dataHex] = encrypted.split(':');
    if (!ivHex || !tagHex || !dataHex) return null;
    const decipher = createDecipheriv(ENC_ALGO, getEncKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Validates Meta webhook X-Hub-Signature-256 header.
 * MANDATORY — unconditional, first operation on every POST /webhook.
 */
export function validateWebhookHmac(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expected = createHmac('sha256', env.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  const received = signatureHeader.slice('sha256='.length);

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(received, 'hex')
    );
  } catch {
    return false;
  }
}
