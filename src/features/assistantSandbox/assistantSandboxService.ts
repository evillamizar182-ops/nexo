import Anthropic from '@anthropic-ai/sdk';
import { db } from '../../repositories/index';
import { env } from '../../config/env';
import { CircuitBreaker } from '../../utils/circuit-breaker';
import { sanitizeUserMessage } from '../../utils/sanitizer';
import { getSystemPrompt } from '../../ai/prompts';
import { TOOL_DEFINITIONS } from '../../ai/tools/definitions';
import { executeTool } from '../../ai/tools/executor';

/**
 * Asistente del panel de administración: usa el mismo cerebro (prompt + datos
 * reales del negocio) que el bot de WhatsApp, pero sin persistir nada y sin
 * reserve_appointment — así el dueño puede preguntar lo que sea sin crear
 * citas reales por accidente.
 */

const MAX_TOOL_ITERATIONS = 5;
const MAX_HISTORY_MESSAGES = 20;

const SANDBOX_TOOLS = TOOL_DEFINITIONS.filter(t => t.name !== 'reserve_appointment');

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
});

const anthropicBreaker = new CircuitBreaker('anthropic-sandbox', {
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
});

export interface SandboxMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askAssistantSandbox(message: string, history: SandboxMessage[] = []): Promise<string> {
  const sanitized = sanitizeUserMessage(message);
  if (!sanitized) {
    return 'No puedo procesar ese mensaje. Intenta reformular tu pregunta.';
  }

  const business = await db.businessConfig.findFirst();
  if (!business) {
    return 'Aún no configuraste tu negocio en "Mi Barbería". Hazlo primero para que pueda responder con datos reales.';
  }

  const systemPrompt = `${getSystemPrompt(business)}
═══════════════════════════════════════
MODO PREVIEW (PANEL DE ADMINISTRACIÓN)
═══════════════════════════════════════
Le estás respondiendo al DUEÑO del negocio en un panel de previsualización, no a un cliente por WhatsApp.
No tienes la herramienta reserve_appointment disponible — NUNCA digas que ya agendaste algo. Si preguntan por agendar, usa check_availability para mostrar horarios reales y aclara que aquí no se crean citas de verdad.`;

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-MAX_HISTORY_MESSAGES).map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: sanitized },
  ];

  // No hay cliente real detrás de este chat — solo importa para reserve_appointment,
  // que está excluido de SANDBOX_TOOLS, así que estos valores nunca se usan de verdad.
  const toolContext = { clientPhone: 'admin-sandbox', clientId: 'admin-sandbox', clientName: 'Admin' };

  let response: Anthropic.Message;
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    if (env.USE_MOCKS || env.ANTHROPIC_API_KEY === 'sk-ant-fake') {
      response = {
        id: 'mock-sandbox',
        type: 'message',
        role: 'assistant',
        model: 'mock-model',
        content: [{
          type: 'text',
          text: 'Estoy en modo simulado (USE_MOCKS activo en el servidor). Configura ANTHROPIC_API_KEY real y USE_MOCKS=false para que pueda responder de verdad sobre tu negocio.',
        }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 0, output_tokens: 0 },
      } as unknown as Anthropic.Message;
    } else {
      response = await anthropicBreaker.execute(() =>
        anthropic.messages.create({
          model: env.ANTHROPIC_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages,
          tools: SANDBOX_TOOLS,
        })
      );
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );
      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        try {
          const result = await executeTool(toolUse.name, toolUse.input, toolContext);
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
        } catch (err: unknown) {
          const errMessage = err instanceof Error ? err.message : 'Error interno';
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: errMessage }),
            is_error: true,
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    break;
  }

  // Fail-closed: si se agotaron las iteraciones con el modelo aún pidiendo tools,
  // no devolvemos texto parcial.
  if (response!.stop_reason === 'tool_use') {
    return 'No pude completar esa consulta ahora mismo. Intenta reformularla o vuelve a intentarlo.';
  }

  const textBlock = response!.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  return textBlock?.text ?? 'Disculpa, hubo un problema procesando tu pregunta.';
}
