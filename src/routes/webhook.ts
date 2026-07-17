import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env';
import { validateWebhookHmac } from '../utils/crypto';
import { bufferService } from '../services/buffer.service';
import { whatsappProvider } from '../services/whatsapp.provider';
import { isTrustedAdminSender } from '../features/adminCommands/adminAuth';

// ─── Dedup en memoria para imágenes del ERP ──────────────────────────────────
// Independiente de Redis (que puede estar caído): evita que un reintento de
// webhook procese la misma venta por foto dos veces. TTL corto; se auto-limpia.
const IMAGE_DEDUP_TTL_MS = 5 * 60 * 1000;
const seenImageIds = new Map<string, number>();

function isDuplicateImage(id: string): boolean {
  const now = Date.now();
  // Limpieza oportunista de entradas viejas.
  if (seenImageIds.size > 1000) {
    for (const [k, t] of seenImageIds) {
      if (now - t > IMAGE_DEDUP_TTL_MS) seenImageIds.delete(k);
    }
  }
  const prev = seenImageIds.get(id);
  if (prev && now - prev < IMAGE_DEDUP_TTL_MS) return true;
  seenImageIds.set(id, now);
  return false;
}

// ─── Rate limit por número (anti-abuso / DoS económico) ──────────────────────
// El rate limit global de Fastify es por IP; para el webhook TODO llega desde
// las IPs de Meta => es un único cubo compartido, inútil para frenar a un
// usuario concreto. Aquí limitamos por teléfono cuántos mensajes disparan a la
// IA (cada llamada a Anthropic cuesta): un abusador ya no puede vaciar el
// presupuesto de API ni ahogar a los demás clientes. Ventana deslizante en RAM.
const MSG_RATE_MAX = 20;              // mensajes procesados por IA / ventana
const MSG_RATE_WINDOW_MS = 60_000;    // 1 minuto
const msgRateMap = new Map<string, number[]>();

function isPhoneRateLimited(phone: string): boolean {
  const now = Date.now();
  const windowStart = now - MSG_RATE_WINDOW_MS;
  const arr = (msgRateMap.get(phone) || []).filter(t => t > windowStart);
  if (arr.length >= MSG_RATE_MAX) {
    msgRateMap.set(phone, arr);
    return true;
  }
  arr.push(now);
  msgRateMap.set(phone, arr);
  return false;
}

/**
 * Meta WhatsApp Cloud API webhook routes.
 * GET: verification challenge
 * POST: incoming messages with mandatory HMAC validation
 */
export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {

  // ─── GET: Meta Verification Challenge ──────────────────────────────────────
  fastify.get('/webhook/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
      return reply.code(200).send(challenge);
    }

    return reply.code(403).send({ error: 'VERIFICATION_FAILED' });
  });

  // ─── Raw body parser for HMAC validation ───────────────────────────────────
  // We need the raw Buffer before JSON parsing to compute HMAC
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req: FastifyRequest, body: Buffer, done: (err: Error | null, result?: unknown) => void) => {
      try {
        done(null, body);
      } catch (err) {
        done(err as Error);
      }
    }
  );

  // ─── POST: Incoming Messages ───────────────────────────────────────────────
  fastify.post('/webhook/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = request.body as Buffer;

    // 1. HMAC VALIDATION — mandatory by default.
    // Only skipped when WEBHOOK_ALLOW_UNSIGNED is explicitly set (local simulation).
    // This is intentionally NOT tied to NODE_ENV: a stray NODE_ENV must never be
    // able to silently open the webhook to spoofed messages.
    const signature = request.headers['x-hub-signature-256'] as string | undefined;
    if (!env.WEBHOOK_ALLOW_UNSIGNED && !validateWebhookHmac(rawBody, signature)) {
      request.log.warn({ ip: request.ip }, 'HMAC validation failed — rejecting webhook');
      return reply.code(401).send({ error: 'INVALID_SIGNATURE' });
    }

    // 2. Parse JSON after HMAC is verified
    let body: MetaWebhookPayload;
    try {
      body = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      return reply.code(400).send({ error: 'INVALID_JSON' });
    }

    // 3. ACK immediately (Meta requires fast 200)
    reply.code(200).send({ status: 'received' });

    // 4. Process async — don't block the response
    setImmediate(() => {
      processWebhookBody(body, request.log).catch(err => {
        request.log.error(err, 'Webhook processing error');
      });
    });
  });
}

// ─── Meta Webhook Payload Types ──────────────────────────────────────────────

interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{
          from: string;
          id: string;
          type: string;
          text?: { body: string };
          image?: { id?: string; caption?: string };
          timestamp?: string;
        }>;
      };
    }>;
  }>;
}

/**
 * Process the webhook body — extract messages, dedup, route to AI.
 */
async function processWebhookBody(body: MetaWebhookPayload, log: any): Promise<void> {
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const messages = value?.messages;

  if (!messages?.length) return;

  for (let msg of messages) {
    const phone = msg.from;
    const waMessageId = msg.id;

    try {
      // 1. ADAPTER: Convertir audio a texto si es necesario
      try {
        const { adaptAudioMessage } = await import('../features/audioHandler/audioMiddleware');
        msg = await adaptAudioMessage(msg);
      } catch (err) {
        log.error(err, 'Audio adapter failed');
      }

      // 2. VISION ERP: Procesar imágenes
      if (msg.type === 'image') {
        // AUTORIZACIÓN: el ERP por visión ("vendida" → descuenta stock) es una
        // acción privilegiada del DUEÑO. Antes, CUALQUIER cliente podía mandar
        // una foto y manipular el inventario. Solo se procesa si el remitente es
        // un admin de confianza (payload firmado por Meta + número en ADMIN_NUMBERS).
        if (!isTrustedAdminSender(phone)) {
          log.warn({ phone: phone.substring(0, 4) + '****' }, 'Imagen de remitente no-admin ignorada (Vision ERP restringido)');
          continue;
        }

        // DEDUP: Meta reintenta webhooks. Sin esto, un reintento (o reenvío) de
        // la misma foto descuenta stock varias veces. Dedup en memoria por id.
        if (waMessageId && isDuplicateImage(waMessageId)) {
          log.info({ id: waMessageId }, 'Imagen duplicada ignorada');
          continue;
        }

        const caption = msg.image?.caption || '';
        const mediaId = msg.image?.id;

        if (mediaId) {
          const { MockWhatsAppMediaService } = await import('../mocks/MockWhatsAppMediaService');
          const mediaService = new MockWhatsAppMediaService();
          const buffer = await mediaService.downloadMedia(mediaId);
          
          const { visionService } = await import('../features/visionERP/visionService');
          const response = await visionService.processProductImage(buffer, caption, phone);
          
          await whatsappProvider.sendMessage(phone, response, null);
          continue; 
        }
      }

      // 3. Solo procesar texto para la IA (después de conversiones)
      if (msg.type !== 'text' || !msg.text?.body) {
        log.info({ type: msg.type, id: msg.id }, 'Non-processable message received — skipping');
        continue;
      }

      const text = msg.text.body;

      // 4. COMANDOS DE ADMINISTRADOR (!stats, !pausa, etc.)
      const { interceptAdminCommand } = await import('../features/adminCommands/commandMiddleware');
      if (await interceptAdminCommand(phone, text)) {
        continue; 
      }

      // 2. Conexión del middleware de Silent Mode
      const { shouldProcessMessage } = await import('../features/silentMode/silentModeMiddleware');
      if (!(await shouldProcessMessage(phone))) {
        continue;
      }

      // RATE LIMIT POR NÚMERO: frena flooding / gasto de API de un solo cliente.
      if (isPhoneRateLimited(phone)) {
        log.warn({ phone: phone.substring(0, 4) + '****' }, 'Rate limit por número excedido — mensaje descartado');
        continue;
      }

      await bufferService.enqueueMessage(phone, text, waMessageId);

      // 5. METRICS & SYNC
      const { messageCounter } = await import('../infrastructure/metrics');
      messageCounter.inc({ provider: 'whatsapp', status: 'received' });

      const { contactsService } = await import('../features/contactsSync/contactsService');
      // No bloqueamos el flujo principal para guardar contactos
      setImmediate(() => contactsService.saveContact(phone).catch(() => {}));

    } catch (err) {
      log.error({ err, phone: phone.substring(0, 4) + '****' }, 'Failed to enqueue message in buffer');
    }
  }
}
