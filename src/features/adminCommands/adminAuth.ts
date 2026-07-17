import { env } from '../../config/env';

/**
 * Autorización compartida para acciones privilegiadas disparadas por WhatsApp
 * (comandos "!" y el ERP por visión "vendida"). Centraliza la MISMA regla que ya
 * aplicaba el commandParser para que ningún flujo se salte el control.
 */
const adminNumbers = (env.ADMIN_NUMBERS || env.ADMIN_PHONE || '')
  .split(',')
  .map(n => n.trim())
  .filter(Boolean);

/**
 * True solo si el remitente es un número admin Y el payload venía firmado por
 * Meta. Con WEBHOOK_ALLOW_UNSIGNED el campo `from` es falsificable, así que
 * NINGÚN número se considera admin (defensa en profundidad, fail-closed).
 */
export function isTrustedAdminSender(phone: string): boolean {
  if (env.WEBHOOK_ALLOW_UNSIGNED) return false;
  return adminNumbers.includes(phone);
}
