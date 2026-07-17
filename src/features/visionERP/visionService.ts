import { db } from '../../repositories/index';
import { cbManager } from '../../infrastructure/circuitBreaker';
import { productMatcher } from './productMatcher';
import { env } from '../../config/env';
import { whatsappProvider } from '../../services/whatsapp.provider';
import Anthropic from '@anthropic-ai/sdk';

/**
 * FLUJO VISION ERP (ASCII):
 * 
 * [Imagen + "vendida"] ──▶ [Circuit Breaker] ──▶ [Anthropic Vision API]
 *                                                       │
 *                                               [Descripción JSON]
 *                                                       │
 * [Respuesta al Admin] ◀── [Lógica de Stock] ◀── [Product Matcher]
 *          │                      │
 *   (Notificar si 0)       (Match > 80%? -> Descontar)
 */

const VISION_PROMPT = `
Analiza esta imagen e identifica el producto. Describe: nombre del producto,
color, tamaño aproximado, marca si es visible. Responde en JSON con los campos:
"name", "brand", "color", "size", "description_summary".
`;

export class VisionService {
  private readonly anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  /**
   * Procesa la imagen de un producto para identificarlo y gestionar stock.
   */
  async processProductImage(imageBuffer: Buffer, caption: string, phone: string): Promise<string> {
    const isSale = caption.toLowerCase().includes('vendida');
    
    if (!isSale) {
      return "💡 Recibí tu imagen. Para registrar una venta, escribe 'vendida' en el comentario de la foto.";
    }

    const breaker = cbManager.getBreaker('ANTHROPIC_VISION');

    try {
      // 1. Identificación por IA (Protegida por Circuit Breaker)
      const aiResponse = await breaker.execute(async () => {
        if (env.USE_MOCKS) {
          const { MockAnthropicService } = await import('../../mocks/MockAnthropicService');
          const mock = new MockAnthropicService();
          return await mock.createMessage({ messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBuffer.toString('base64') } }] }] } as any);
        }

        return await this.anthropic.messages.create({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBuffer.toString('base64') } },
              { type: 'text', text: VISION_PROMPT }
            ]
          }]
        });
      });

      const aiText = aiResponse.content.find((c: any) => c.type === 'text')?.text || '';
      console.log(`[VISION_ERP] IA dice: ${aiText}`);

      // 2. Matching con Catálogo
      const catalog = await db.product.findMany({ where: { isActive: true } });
      const match = productMatcher.matchProductByDescription(aiText, catalog);

      // 3. Lógica de Negocio según Confianza
      if (match.confidence > 0.8 && match.product) {
        return await this.registerAutoSale(match.product);
      } 
      
      if (match.confidence >= 0.5 && match.product) {
        return `🤔 ¿Es este el producto? *${match.product.name}* (Confianza: ${Math.round(match.confidence * 100)}%).\n\nResponde "SÍ" para confirmar o usa !vender [SKU]`;
      }

      const options = match.alternatives.map(p => `• !vender-confirmar ${p.id.substring(0,4)} (${p.name})`).join('\n');
      return `❌ No pude identificar el producto con certeza. ¿Podría ser alguno de estos?\n\n${options}\n\nO intenta enviar una foto más clara.`;

    } catch (error: any) {
      console.error('[VISION_ERP] Error:', error.message);
      return "⚠️ Lo siento, mi sistema de visión no está disponible ahora (Circuit Breaker OPEN). Intenta registrar la venta manualmente con !vender";
    }
  }

  private async registerAutoSale(product: any): Promise<string> {
    const newStock = product.stock - 1;
    
    await db.product.update({
      where: { id: product.id },
      data: { stock: newStock }
    });

    let msg = `✅ Venta registrada automáticamente: *${product.name}*.\n📦 Stock restante: ${newStock}`;

    if (newStock <= 0) {
      msg += `\n🚨 *ALERTA:* ¡Producto agotado! Notificando al administrador...`;
      await this.notifyAdmin(product.name);
    } else if (newStock <= 2) {
      msg += `\n⚠️ *AVISO:* Stock bajo.`;
    }

    return msg;
  }

  private async notifyAdmin(productName: string): Promise<void> {
    if (env.ADMIN_PHONE) {
      await whatsappProvider.sendMessage(env.ADMIN_PHONE, `🚨 *ALERTA DE INVENTARIO*\n\nEl producto *${productName}* se ha agotado tras una venta por foto.`, null);
    }
  }
}

export const visionService = new VisionService();
