import { redis } from '../utils/redis';
import { conversationService } from './conversation.service';
import { whatsappProvider } from './whatsapp.provider';

const BUFFER_WINDOW_MS = 5000; // 5 segundos de espera para agrupar mensajes

export class BufferService {
  /**
   * Encola un mensaje para ser procesado después de una ventana de tiempo.
   * Si llegan más mensajes del mismo número en esa ventana, se agrupan.
   */
  async enqueueMessage(phone: string, text: string, waMessageId: string): Promise<void> {
    const key = `buffer:${phone}`;
    
    // 1. Agregar mensaje al set de la ráfaga actual
    await redis.rpush(key, text);
    await redis.expire(key, 60); // Seguridad por si algo falla

    // 2. Intentar obtener el lock para procesar esta ráfaga
    const lockKey = `lock:${phone}`;
    const acquired = await redis.set(lockKey, '1', { nx: true, px: BUFFER_WINDOW_MS });

    if (acquired) {
      // Somos el primer mensaje de la ráfaga, esperamos a que lleguen los demás
      setTimeout(async () => {
        try {
          // 3. Obtener todos los mensajes agrupados
          const messages = await redis.lrange(key, 0, -1);
          await redis.del(key);
          await redis.del(lockKey);

          if (!messages || messages.length === 0) return;

          const combinedText = messages.join(' ');
          
          // 4. Procesar con la IA
          const responseText = await conversationService.processMessage(phone, combinedText, waMessageId);

          if (responseText) {
            await whatsappProvider.sendMessage(phone, responseText, new Date());
          }
        } catch (err) {
          console.error(`[BUFFER_ERROR] ${phone}:`, err);
        }
      }, BUFFER_WINDOW_MS);
    }
  }
}

export const bufferService = new BufferService();
