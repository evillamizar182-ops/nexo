import { AdminCommand } from './commandParser';
import { commissionService } from '../commissions/commissionService';
import { silentModeService } from '../silentMode/silentModeService';
import { cbManager } from '../../infrastructure/circuitBreaker';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';

/**
 * HANDLERS: AdminCommands
 * Implementación de la lógica de negocio para cada comando administrativo.
 * 
 * ¿Por qué?: Mantiene los comandos desacoplados del parser, facilitando la 
 * adición de nuevas funcionalidades sin romper la estructura de seguridad.
 */
export async function handleAdminCommand(cmd: AdminCommand): Promise<string> {
  const timestamp = new Date().toISOString();
  console.log(`[ADMIN_COMMAND] [${timestamp}] Admin: ${cmd.sender} ejecutó: !${cmd.name}`);

  try {
    switch (cmd.name) {
      case 'stats': {
        const hoy = DateTime.now().setZone('America/Bogota').toFormat('yyyy-MM-dd');
        const report = await commissionService.generateDailyReport(hoy);
        return commissionService.exportReportAsText(report);
      }

      case 'cierre': {
        const hoy = DateTime.now().setZone('America/Bogota').toFormat('yyyy-MM-dd');
        const report = await commissionService.generateDailyReport(hoy);
        // Aquí se podría marcar en DB como cerrado si existiera la tabla de cierres
        return `✅ Cierre completado para ${hoy}.\n\n` + commissionService.exportReportAsText(report);
      }

      case 'pausa': {
        await silentModeService.pauseBot(cmd.sender);
        return '⏸️ Bot pausado globalmente. Solo los admins recibirán respuesta de la IA.';
      }

      case 'resume': {
        await silentModeService.resumeBot(cmd.sender);
        return '▶️ Bot reactivado. Los clientes ya pueden interactuar con la IA.';
      }

      case 'mute': {
        const target = cmd.args[0];
        if (!target) return '❌ Uso: !mute [número]';
        await silentModeService.muteClient(target);
        return `🔇 Cliente ${target} silenciado. La IA no le responderá más.`;
      }

      case 'unmute': {
        const target = cmd.args[0];
        if (!target) return '❌ Uso: !unmute [número]';
        await silentModeService.unmuteClient(target);
        return `✅ Cliente ${target} reactivado.`;
      }

      case 'status': {
        const statuses = cbManager.getAllStatuses();
        const lines = statuses.map(s => 
          `${s.state === 'CLOSED' ? '🟢' : '🔴'} *${s.service}*: ${s.state} (Fallos: ${s.failureCount})`
        );
        return `🛡️ *Estado de Circuit Breakers:*\n\n${lines.join('\n')}`;
      }

      case 'backup': {
        const { backupService } = await import('../backup/backupService');
        const res = await backupService.executeHotBackup();
        if (res.success) {
          return `✅ Backup exitoso: *${res.filename}*\n📦 Tamaño: ${res.size}\n⏱️ Duración: ${res.duration}`;
        } else {
          return `❌ Fallo en backup: ${res.error}`;
        }
      }

      default:
        return '❓ Comando no reconocido. Escribe !ayuda para ver la lista.';
    }
  } catch (err: any) {
    console.error(`[ADMIN_COMMAND] Error en !${cmd.name}:`, err.message);
    return `❌ Error al ejecutar !${cmd.name}: ${err.message}`;
  }
}

