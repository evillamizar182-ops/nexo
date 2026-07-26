import Anthropic from '@anthropic-ai/sdk';
import { db } from '../repositories/index';
import { env } from '../config/env';
import { hashPII, encryptPII } from '../utils/crypto';
import { redis } from '../utils/redis';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { sanitizeUserMessage, containsPromptLeak } from '../utils/sanitizer';
import { getSystemPrompt } from '../ai/prompts';
import { TOOL_DEFINITIONS } from '../ai/tools/definitions';
import { executeTool } from '../ai/tools/executor';

const MAX_TOOL_ITERATIONS = 5;
const MAX_HISTORY_MESSAGES = 20;
const DEDUP_TTL_SECONDS = 300; // 5 min idempotency window

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
});

const anthropicBreaker = new CircuitBreaker('anthropic', {
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
});

export class ConversationService {
  /**
   * Main message processing pipeline.
   * 1. Deduplicate via Redis
   * 2. Sanitize + injection check
   * 3. Upsert client/conversation
   * 4. Build context + call Anthropic with tool loop
   * 5. Persist and return response
   */
  async processMessage(clientPhone: string, message: string, waMessageId?: string): Promise<string> {
    const phoneHash = hashPII(clientPhone);

    // 1. IDEMPOTENCY CHECK — skip duplicates
    if (waMessageId) {
      const dedupKey = `dedup:${waMessageId}`;
      const exists = await redis.get(dedupKey);
      if (exists) return ''; // Already processed
      await redis.set(dedupKey, '1', { ex: DEDUP_TTL_SECONDS });
    }

    // 2. SANITIZE INPUT
    const sanitized = sanitizeUserMessage(message);
    if (!sanitized) {
      return 'Lo siento, no puedo procesar esa solicitud. ¿En qué más puedo ayudarte?';
    }

    // 3. UPSERT CLIENT
    let client = await db.client.findUnique({
      where: { phoneHash },
    });

    if (!client) {
      client = await db.client.create({
        data: { phoneHash, name: null, phoneEncrypted: encryptPII(clientPhone) },
      });
    } else if (!client.phoneEncrypted) {
      // Backfill: clientes creados antes de tener cifrado reversible. Al verlos
      // de nuevo (mismo webhook trae el teléfono real), lo rellenamos — así el
      // panel puede responderles manualmente sin esperar una migración manual.
      client = await db.client.update({
        where: { id: client.id },
        data: { phoneEncrypted: encryptPII(clientPhone) },
      });
    }

    // 4. GET OR CREATE CONVERSATION
    let conversation = await db.conversation.findFirst({
      where: { clientId: client.id, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      conversation = await db.conversation.create({
        data: { clientId: client.id, provider: 'whatsapp' },
      });
    }

    // 5. LOG USER MESSAGE
    await db.messageLog.create({
      data: { conversationId: conversation.id, role: 'user', content: sanitized },
    });

    // 6. BUILD CONTEXT
    const business = await db.businessConfig.findFirst();
    if (!business) {
      return 'El negocio no está configurado. Contacta al administrador.';
    }

    const systemPrompt = getSystemPrompt(business);

    // Ventana DESLIZANTE: tomamos los MÁS RECIENTES (desc) y los devolvemos a
    // orden cronológico. Con `asc + take` se cargaban siempre los 20 PRIMEROS
    // mensajes, dejando al modelo sin contexto reciente y —peor— permitiendo
    // que una inyección colocada al inicio quedara anclada de por vida.
    const history = (await db.messageLog.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_MESSAGES,
    })).reverse();

    const messages: Anthropic.MessageParam[] = history.map(m => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }));

    // 7. ANTHROPIC TOOL USE LOOP (with circuit breaker)
    let response: Anthropic.Message;
    let iterations = 0;

    const toolContext = {
      clientPhone,
      clientId: client.id,
      clientName: client.name ?? 'Cliente',
    };

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      // MOCK AI MODE: explicit opt-in via USE_MOCKS (or the obvious placeholder
      // key). Never key this off a fragment of a real API key in source.
      if (env.USE_MOCKS || env.ANTHROPIC_API_KEY === 'sk-ant-fake') {
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const content = (lastUserMessage?.content as string) || '';
        
        console.log('[MOCK-AI] 🤖 Simulando razonamiento de IA...');

        // If user wants an appointment, simulate TOOL USE
        if (content.toLowerCase().includes('agendar') || content.toLowerCase().includes('cita')) {
           response = {
            id: 'mock-tool-id',
            type: 'message',
            role: 'assistant',
            model: 'mock-model',
            content: [
              { type: 'text', text: 'Entendido, voy a agendar tu cita ahora mismo.' },
              { 
                type: 'tool_use', 
                id: 'toolu_mock_1', 
                name: 'reserve_appointment', 
                input: { 
                  barbero: 'Alex', 
                  fecha: '2026-05-20', 
                  hora: '10:00', 
                  servicio: 'Corte de Cabello', 
                  nombre_cliente: client.name || 'Cliente Demo' 
                } 
              }
            ],
            stop_reason: 'tool_use',
            usage: { input_tokens: 0, output_tokens: 0 }
          } as any;
        } else {
          // Standard text response
          let mockText = '¡Hola! Soy Nexo IA. ¿Cómo puedo ayudarte?';
          if (content.toLowerCase().includes('precio')) mockText = 'El corte cuesta $25.000.';

          response = {
            id: 'mock-id',
            type: 'message',
            role: 'assistant',
            model: 'mock-model',
            content: [{ type: 'text', text: mockText }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 0, output_tokens: 0 }
          } as any;
        }
      } else {
        response = await anthropicBreaker.execute(() =>
          anthropic.messages.create({
            model: env.ANTHROPIC_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            messages,
            tools: TOOL_DEFINITIONS,
          })
        );
      }

      // If model wants to use tools
      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );

        // Append assistant message (contains tool_use blocks)
        messages.push({ role: 'assistant', content: response.content });

        // Execute tools sequentially
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUseBlocks) {
          try {
            const result = await executeTool(toolUse.name, toolUse.input, toolContext);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            });
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error interno';
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({ error: message }),
              is_error: true,
            });
          }
        }

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Model produced final text response
      break;
    }

    // 8. FAIL-CLOSED: si el loop se agotó y el modelo AÚN quería usar tools,
    // no hay respuesta final legítima. No exponemos texto parcial (que podría
    // venir de un intento de manipulación); respondemos algo seguro y salimos.
    let finalResponse: string;
    if (response!.stop_reason === 'tool_use') {
      finalResponse = 'Estoy teniendo problemas para completar eso ahora mismo. ¿Puedes intentarlo de nuevo en un momento?';
    } else {
      // EXTRACT TEXT RESPONSE
      const textBlock = response!.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text'
      );
      const replyText = textBlock?.text ?? 'Disculpa, hubo un problema procesando tu solicitud.';

      // GUARDIA DE SALIDA: si la respuesta intenta filtrar el system prompt o
      // los nombres internos de las tools (p. ej. por una inyección lograda),
      // se descarta y se responde de forma segura. El prompt interno nunca sale.
      if (containsPromptLeak(replyText)) {
        finalResponse = 'Solo puedo ayudarte con servicios del negocio: información, disponibilidad, reservas e inventario.';
      } else {
        // Truncate to 3 sentences
        finalResponse = this.truncateResponse(replyText);
      }
    }

    // 9. PERSIST ASSISTANT RESPONSE
    await db.messageLog.create({
      data: { conversationId: conversation.id, role: 'assistant', content: finalResponse },
    });

    return finalResponse;
  }

  /**
   * Truncate response to max 3 sentences.
   */
  private truncateResponse(text: string): string {
    const sentences = text.split(/(?<=[.!?;])\s+/);
    if (sentences.length <= 3) return text;
    return sentences.slice(0, 3).join(' ') + ' ¿Te gustaría que profundice en algo más?';
  }
}

export const conversationService = new ConversationService();
