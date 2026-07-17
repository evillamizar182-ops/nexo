import { createHash } from 'node:crypto';
import { prisma } from '../repositories/index';

// Guardamos SHA-256 del token, nunca el bearer usable en claro.
function tokenKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Revoca un token (logout / compromiso). Idempotente. */
export async function revokeToken(token: string, expiresAt: Date): Promise<void> {
  const key = tokenKey(token);
  await prisma.revokedToken.upsert({
    where: { token: key },
    update: { expiresAt },
    create: { token: key, expiresAt },
  });
}

/** True si el token fue revocado. Se consulta en cada request autenticada. */
export async function isTokenRevoked(token: string): Promise<boolean> {
  const key = tokenKey(token);
  const found = await prisma.revokedToken.findUnique({ where: { token: key } });
  return !!found;
}

/** Limpia tokens revocados ya expirados (mantiene la tabla pequeña). */
export async function purgeExpiredRevoked(): Promise<number> {
  const { count } = await prisma.revokedToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
