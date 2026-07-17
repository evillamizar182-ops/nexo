import { silentModeService } from './silentModeService';
import { env } from '../../config/env';

/**
 * MIDDLEWARE: SilentModeGuard
 * Intercepta los mensajes entrantes para decidir si deben ser procesados por la IA.
 * 
 * ¿Por qué?: Implementa la lógica de "silencio" y "pausa" de forma centralizada, 
 * asegurando que la IA no responda cuando el dueño del negocio lo ha prohibido 
 * o cuando el bot está en mantenimiento (pausa).
 */
export async function shouldProcessMessage(phoneNumber: string): Promise<boolean> {
  // 1. Bypass para el administrador
  // El admin siempre debe poder interactuar con el bot, incluso si está pausado.
  if (phoneNumber === env.ADMIN_PHONE) {
    return true;
  }

  // 2. Verificar pausa global
  const isPaused = await silentModeService.isBotPaused();
  if (isPaused) {
    console.log(`[SILENT_MODE] ⏸️ Mensaje ignorado de ${phoneNumber.substring(0, 5)}**** (Bot pausado globalmente)`);
    return false;
  }

  // 3. Verificar si el cliente está muteado
  const isMuted = await silentModeService.isClientMuted(phoneNumber);
  if (isMuted) {
    console.log(`[SILENT_MODE] 🔇 Mensaje ignorado de ${phoneNumber.substring(0, 5)}**** (Cliente silenciado)`);
    return false;
  }

  return true;
}
