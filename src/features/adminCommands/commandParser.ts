import { env } from '../../config/env';

/**
 * PARSER: AdminCommandParser
 * Identifica y extrae la intención de los comandos que inician con "!".
 * 
 * ¿Por qué?: Centraliza el parseo de argumentos y la validación de seguridad 
 * (RBAC - Role Based Access Control) antes de que cualquier lógica pesada se ejecute.
 */
export interface AdminCommand {
  name: string;
  args: string[];
  fullArgs: string;
  sender: string;
}

export class CommandParser {
  private readonly adminNumbers: string[];

  constructor() {
    // Los números admin vienen en el .env como "573001234567,573009876543"
    this.adminNumbers = (env.ADMIN_NUMBERS || env.ADMIN_PHONE || '').split(',').map(n => n.trim());
  }

  /**
   * Determina si un mensaje es un comando válido y si el remitente tiene permisos.
   */
  parse(text: string, sender: string): AdminCommand | null {
    if (!text.startsWith('!')) return null;

    // Defensa en profundidad: si el webhook acepta payloads SIN firma HMAC, el
    // campo `sender` (from) es falsificable, así que NO se procesan comandos
    // privilegiados. Solo se confía en el `from` cuando Meta firmó el payload.
    if (env.WEBHOOK_ALLOW_UNSIGNED) {
      console.warn('[SECURITY] Comando admin ignorado: webhook sin firma (sender no fiable).');
      return null;
    }

    // Validación de Seguridad: Silenciosa si no es admin
    if (!this.adminNumbers.includes(sender)) {
      console.warn(`[SECURITY] Intento de comando rechazado de número no autorizado: ${sender}`);
      return null;
    }

    const parts = text.slice(1).trim().split(/\s+/);
    const name = parts[0].toLowerCase();
    const args = parts.slice(1);

    return {
      name,
      args,
      fullArgs: args.join(' '),
      sender
    };
  }
}

export const commandParser = new CommandParser();
