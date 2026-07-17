import { commandParser } from './commandParser';
import { handleAdminCommand } from './commandHandlers';
import { whatsappProvider } from '../../services/whatsapp.provider';

// Mapa para Rate Limiting (Admin: [Timestamps])
const rateLimitMap = new Map<string, number[]>();
const MAX_COMMANDS_PER_HOUR = 30;

/**
 * MIDDLEWARE: AdminCommandMiddleware
 * Intercepta mensajes que inician con "!" y los procesa si vienen de un admin.
 * 
 * ¿Por qué?: Separa la lógica de comandos administrativos del flujo normal de la IA, 
 * evitando que la IA intente responder a comandos que ella misma no debería procesar.
 */
export async function interceptAdminCommand(phone: string, text: string): Promise<boolean> {
  const cmd = commandParser.parse(text, phone);
  
  if (!cmd) return false; // No es un comando o no es admin

  // 1. Rate Limiting Check
  const now = Date.now();
  const windowStart = now - 3600000; // 1 hora atrás
  
  let attempts = rateLimitMap.get(phone) || [];
  attempts = attempts.filter(t => t > windowStart);
  
  if (attempts.length >= MAX_COMMANDS_PER_HOUR) {
    console.warn(`[RATE_LIMIT] Admin ${phone} excedió límite de comandos (!${cmd.name})`);
    await whatsappProvider.sendMessage(phone, '⚠️ Límite de 30 comandos por hora excedido. Por favor espera.', null);
    return true; // Interceptado pero bloqueado
  }

  attempts.push(now);
  rateLimitMap.set(phone, attempts);

  // 2. Ejecutar Comando
  const response = await handleAdminCommand(cmd);
  
  // 3. Enviar Respuesta al Admin
  await whatsappProvider.sendMessage(phone, response, null);
  
  return true; // Mensaje interceptado y procesado
}
