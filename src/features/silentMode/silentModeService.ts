import { db } from '../../repositories/index';
import { hashPII } from '../../utils/crypto';

const BOT_STATE_ID = 'singleton';

/**
 * SERVICIO: SilentMode
 * Gestiona el estado de silencio de clientes y la pausa global del bot.
 *
 * ¿Por qué?: Permite intervenciones manuales del dueño del negocio sin que la IA
 * interfiera, evitando situaciones de "competencia" entre humano y bot.
 *
 * Implementado con modelos Prisma normales (BotState, MutedClient) — antes usaba
 * SQL crudo contra una tabla con columnas TEXT[] (arrays de PostgreSQL), lo cual
 * es incompatible con SQLite y rompía en local. Esta versión funciona igual en
 * ambos motores.
 */
export class SilentModeService {
  /** Silencia un número específico (recibido como teléfono real, ej. desde WhatsApp admin). */
  async muteClient(phoneNumber: string): Promise<void> {
    console.log(`[SILENT_MODE] Silenciando cliente: ${phoneNumber.substring(0, 5)}****`);
    await this.muteClientByHash(hashPII(phoneNumber));
  }

  /** Reactiva un número específico (recibido como teléfono real). */
  async unmuteClient(phoneNumber: string): Promise<void> {
    console.log(`[SILENT_MODE] Reactivando cliente: ${phoneNumber.substring(0, 5)}****`);
    await this.unmuteClientByHash(hashPII(phoneNumber));
  }

  /** Consulta si un cliente (teléfono real) está silenciado. */
  async isClientMuted(phoneNumber: string): Promise<boolean> {
    return this.isClientMutedByHash(hashPII(phoneNumber));
  }

  /**
   * Variantes "byHash" — para el dashboard, que solo conoce el phoneHash
   * (el mismo identificador que Client.phoneHash), sin necesitar descifrar
   * el teléfono real.
   */
  async muteClientByHash(phoneHash: string): Promise<void> {
    await db.mutedClient.upsert({
      where: { phoneHash },
      update: {},
      create: { phoneHash },
    });
  }

  async unmuteClientByHash(phoneHash: string): Promise<void> {
    await db.mutedClient.deleteMany({ where: { phoneHash } });
  }

  async isClientMutedByHash(phoneHash: string): Promise<boolean> {
    const found = await db.mutedClient.findUnique({ where: { phoneHash } });
    return !!found;
  }

  /** Dado un conjunto de phoneHash, devuelve cuáles están silenciados (evita N+1). */
  async getMutedHashes(phoneHashes: string[]): Promise<Set<string>> {
    if (!phoneHashes.length) return new Set();
    const rows = await db.mutedClient.findMany({
      where: { phoneHash: { in: phoneHashes } },
      select: { phoneHash: true },
    });
    return new Set(rows.map(r => r.phoneHash));
  }

  /** Pausa el bot globalmente. */
  async pauseBot(adminNumber: string): Promise<void> {
    console.log(`[SILENT_MODE] ⏸️ Bot pausado por admin: ${adminNumber}`);
    await db.botState.upsert({
      where: { id: BOT_STATE_ID },
      update: { paused: true },
      create: { id: BOT_STATE_ID, paused: true },
    });
  }

  /** Reactiva el bot globalmente. */
  async resumeBot(adminNumber: string): Promise<void> {
    console.log(`[SILENT_MODE] ▶️ Bot reactivado por admin: ${adminNumber}`);
    await db.botState.upsert({
      where: { id: BOT_STATE_ID },
      update: { paused: false },
      create: { id: BOT_STATE_ID, paused: false },
    });
  }

  /** Consulta si el bot está pausado globalmente. */
  async isBotPaused(): Promise<boolean> {
    const state = await db.botState.findUnique({ where: { id: BOT_STATE_ID } });
    return state?.paused ?? false;
  }
}

export const silentModeService = new SilentModeService();
