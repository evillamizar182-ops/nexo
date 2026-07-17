import { FastifyInstance } from 'fastify';
import { db } from '../repositories/index';
import { DateTime } from 'luxon';
import { whatsappProvider } from '../services/whatsapp.provider';
import { silentModeService } from '../features/silentMode/silentModeService';
import { decryptPII } from '../utils/crypto';
import { askAssistantSandbox, SandboxMessage } from '../features/assistantSandbox/assistantSandboxService';

// Clamp a user-supplied `limit` to a sane range so a single request can't ask
// for an unbounded number of rows (resource exhaustion / mass data export).
const MAX_PAGE_SIZE = 200;
function safeLimit(raw: unknown, fallback = 50): number {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, MAX_PAGE_SIZE);
}

export async function dashboardRoutes(fastify: FastifyInstance) {

  // Middleware global para todas las rutas del dashboard:
  // 1) autenticación (firma + no revocado), 2) autorización (rol ADMIN).
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', fastify.authorizeAdmin);

  // GET: Resumen general (Stats)
  fastify.get('/stats', async () => {
    const now = DateTime.now().setZone('America/Bogota');
    const startOfMonth = now.startOf('month').toJSDate();

    const [appointmentsCount, clientsCount, revenue] = await Promise.all([
      db.appointment.count({
        where: { startTime: { gte: startOfMonth } }
      }),
      db.client.count(),
      db.appointment.aggregate({
        where: { 
          startTime: { gte: startOfMonth },
          status: { in: ['confirmed', 'confirmada', 'completed', 'completada'] }
        },
        _sum: { price: true }
      })
    ]);

    return {
      appointmentsThisMonth: appointmentsCount,
      totalClients: clientsCount,
      revenueThisMonth: revenue._sum.price || 0,
      currency: 'COP'
    };
  });

  // GET: Listado de Citas
  fastify.get('/appointments', async (request) => {
    const query = request.query as any;
    const limit = safeLimit(query.limit);

    return db.appointment.findMany({
      orderBy: { startTime: 'desc' },
      take: limit,
      include: {
        client: {
          select: { name: true, phoneHash: true }
        },
        staff: {
          select: { name: true }
        }
      }
    });
  });

  // GET: Finance summary
  fastify.get('/finance', async () => {
    const now = DateTime.now().setZone('America/Bogota');
    const startOfMonth = now.startOf('month').toJSDate();

    const finance = await db.appointment.aggregate({
      where: { startTime: { gte: startOfMonth } },
      _sum: { price: true },
      _count: true,
    });

    // Appointment no tiene columna de duración: se calcula desde start/end.
    const rows = await db.appointment.findMany({
      where: { startTime: { gte: startOfMonth } },
      select: { startTime: true, endTime: true },
    });
    const avgDurationMinutes = rows.length
      ? Math.round(
          rows.reduce((sum, r) => sum + (r.endTime.getTime() - r.startTime.getTime()) / 60000, 0) / rows.length
        )
      : 0;

    return {
      revenueThisMonth: Number(finance._sum.price || 0),
      totalAppointments: finance._count,
      avgDurationMinutes,
      currency: 'COP',
    };
  });


  // GET: Clientes
  fastify.get('/clients', async (request) => {
    const query = request.query as any;
    const limit = safeLimit(query.limit);

    return db.client.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: {
          select: { appointments: true }
        }
      }
    });
  });

  // GET: Configuración del Negocio
  fastify.get('/config', async () => {
    const data = await db.businessConfig.findFirst();
    if (data) {
      return {
        ...data,
        config: typeof data.config === 'string' ? JSON.parse(data.config) : data.config
      };
    }
    return null;
  });

  // PUT: Actualizar Configuración
  fastify.put('/config', async (request, reply) => {
    const config = request.body as any;
    
    const existing = await db.businessConfig.findFirst();
    let updatedConfigString = '{}';

    if (config.config) {
      updatedConfigString = typeof config.config === 'string' ? config.config : JSON.stringify(config.config);
    } else if (existing) {
      updatedConfigString = existing.config;
    }

    // Tope de tamaño: este blob se re-parsea (JSON.parse) en CADA mensaje al
    // construir el system prompt. Un blob enorme degradaría todo el pipeline de
    // la IA (DoS de CPU). 64KB es holgado para una config real de negocio.
    const MAX_CONFIG_BYTES = 64 * 1024;
    if (Buffer.byteLength(updatedConfigString, 'utf8') > MAX_CONFIG_BYTES) {
      return reply.code(413).send({
        error: 'CONFIG_TOO_LARGE',
        message: 'La configuración excede el tamaño máximo permitido (64KB).',
      });
    }

    if (existing) {
      await db.businessConfig.update({
        where: { id: existing.id },
        data: { 
          name: config.name || existing.name,
          config: updatedConfigString
        }
      });
    } else {
      await db.businessConfig.create({
        data: {
          id: 'singleton',
          name: config.name || 'Mi Negocio',
          config: updatedConfigString
        }
      });
    }

    // --- SINCRONIZACIÓN CON TABLAS RELACIONALES (para las tools de agenda del Bot) ---
    // TRANSACCIONAL: si algo falla a mitad, se revierte TODO. Antes, un fallo
    // parcial tras el updateMany(isActive:false) dejaba barberos/servicios
    // desactivados permanentemente (auto-DoS del negocio).
    try {
      const parsedConfig = typeof config.config === 'string' ? JSON.parse(config.config) : config.config;

      if (parsedConfig) {
        await db.$transaction(async (tx) => {
          // 1. Sincronizar Barberos (StaffMember)
          if (Array.isArray(parsedConfig.barberos)) {
            await tx.staffMember.updateMany({ data: { isActive: false } });

            for (const barbero of parsedConfig.barberos) {
              if (barbero.nombre) {
                const barberoId = barbero.nombre.toLowerCase().trim();
                const comisionRaw = Number(barbero.comision);
                const commissionValue = Number.isFinite(comisionRaw)
                  ? Math.min(100, Math.max(0, comisionRaw))
                  : 50;
                await tx.staffMember.upsert({
                  where: { id: barberoId },
                  update: { name: barbero.nombre, isActive: barbero.activo !== false, role: 'BARBERO', commissionValue },
                  create: { id: barberoId, name: barbero.nombre, isActive: barbero.activo !== false, role: 'BARBERO', commissionValue },
                });
              }
            }
          }

          // 2. Sincronizar Servicios (Service)
          if (parsedConfig.servicios) {
            await tx.service.updateMany({ data: { isActive: false } });

            for (const [, sAny] of Object.entries(parsedConfig.servicios)) {
              const s = sAny as { nombre: string; precio: number; duracion_min: number };
              if (s.nombre) {
                const existingService = await tx.service.findFirst({ where: { name: s.nombre } });
                if (existingService) {
                  await tx.service.update({
                    where: { id: existingService.id },
                    data: { price: Number(s.precio), durationMin: Number(s.duracion_min), isActive: true },
                  });
                } else {
                  await tx.service.create({
                    data: { name: s.nombre, price: Number(s.precio), durationMin: Number(s.duracion_min), isActive: true },
                  });
                }
              }
            }
          }
        });
      }
    } catch (syncError) {
      fastify.log.error(syncError, 'Error al sincronizar barberos y servicios (rollback aplicado)');
      return reply.code(500).send({ error: 'CONFIG_SYNC_FAILED', message: 'No se pudo sincronizar la configuración; no se aplicaron cambios parciales.' });
    }

    // Auditoría: quién cambió la config (RBAC ya garantiza que es un ADMIN).
    fastify.log.info({ userId: (request.user as any)?.id, email: (request.user as any)?.email }, 'AUDIT: businessConfig actualizado');

    return { status: 'updated' };
  });

  // GET: Inventario
  fastify.get('/inventory', async (request) => {
    const query = request.query as any;
    const limit = safeLimit(query.limit);

    return db.product.findMany({
      orderBy: { name: 'asc' },
      take: limit,
    });
  });

  // POST: Crear/Actualizar Producto
  fastify.post('/inventory', async (request, reply) => {
    const data = request.body as any;

    const name = typeof data?.name === 'string' ? data.name.trim().slice(0, 200) : '';
    const price = Number(data?.price);
    const stock = data?.stock === undefined ? 0 : Number(data.stock);

    if (!name || !Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0) {
      return reply.code(400).send({ error: 'INVALID_PRODUCT', message: 'name, price y stock válidos son obligatorios' });
    }

    return db.product.upsert({
      where: { id: typeof data?.id === 'string' && data.id ? data.id : 'new' },
      update: {
        name,
        price,
        stock,
        isActive: data.isActive !== false,
      },
      create: {
        name,
        price,
        stock,
      },
    });
  });

  // GET: Lista de chats activos
  fastify.get('/chats', async () => {
    const activeConversations = await db.conversation.findMany({
      where: { status: 'OPEN' },
      include: {
        client: true,
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const mutedHashes = await silentModeService.getMutedHashes(
      activeConversations.map(c => c.client.phoneHash)
    );

    return activeConversations.map(conv => ({
      phone: conv.client.phoneHash, // Assuming this is used as phone identifier for now
      name: conv.client.name || 'Cliente',
      lastMessage: conv.logs[0]?.content || '',
      status: conv.status,
      isMuted: mutedHashes.has(conv.client.phoneHash),
    }));
  });

  // ─── Control del Bot (real — reemplaza los toggles que antes solo cambiaban
  // estado local en el navegador y no afectaban al bot de verdad) ───────────

  // GET: ¿el bot está pausado globalmente?
  fastify.get('/bot/status', async () => {
    const paused = await silentModeService.isBotPaused();
    return { paused };
  });

  // POST: pausar el bot globalmente (no responde a ningún cliente, excepto el admin)
  fastify.post('/bot/pause', async (request) => {
    const email = (request.user as any)?.email || 'dashboard';
    await silentModeService.pauseBot(email);
    return { paused: true };
  });

  // POST: reanudar el bot globalmente
  fastify.post('/bot/resume', async (request) => {
    const email = (request.user as any)?.email || 'dashboard';
    await silentModeService.resumeBot(email);
    return { paused: false };
  });

  // POST: silenciar a un cliente específico (el bot deja de responderle)
  fastify.post('/chats/:phone/mute', async (request, reply) => {
    const { phone } = request.params as any;
    const client = await db.client.findUnique({ where: { phoneHash: phone } });
    if (!client) return reply.code(404).send({ error: 'Client not found' });
    await silentModeService.muteClientByHash(phone);
    return { muted: true };
  });

  // POST: reactivar las respuestas automáticas para un cliente
  fastify.post('/chats/:phone/unmute', async (request, reply) => {
    const { phone } = request.params as any;
    const client = await db.client.findUnique({ where: { phoneHash: phone } });
    if (!client) return reply.code(404).send({ error: 'Client not found' });
    await silentModeService.unmuteClientByHash(phone);
    return { muted: false };
  });

  // GET: Mensajes de un chat
  fastify.get('/chats/:phone', async (request) => {
    const params = request.params as any;
    const phone = params.phone;

    const client = await db.client.findUnique({
      where: { phoneHash: phone }
    });

    if (!client) return [];

    const conversation = await db.conversation.findFirst({
      where: { clientId: client.id, status: 'OPEN' },
      orderBy: { createdAt: 'desc' }
    });

    if (!conversation) return [];

    const messages = await db.messageLog.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' }
    });

    return messages.map(m => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt
    }));
  });

  // POST: Enviar mensaje manual
  fastify.post('/chats/:phone/send', async (request, reply) => {
    const params = request.params as any;
    const phone = params.phone;
    const body = request.body as any;
    const message = body.message;

    if (!message) return reply.code(400).send({ error: 'Message required' });

    const client = await db.client.findUnique({
      where: { phoneHash: phone }
    });

    if (!client) return reply.code(404).send({ error: 'Client not found' });

    // El teléfono real vive cifrado (phoneHash es un HMAC de una vía, no sirve
    // para llamar a la API de WhatsApp). Clientes de antes de esta migración
    // pueden no tenerlo todavía — se rellena solo la próxima vez que escriban.
    const realPhone = client.phoneEncrypted ? decryptPII(client.phoneEncrypted) : null;
    if (!realPhone) {
      return reply.code(422).send({
        error: 'PHONE_UNAVAILABLE',
        message: 'No se puede enviar: número no disponible para este cliente todavía (se completa automáticamente cuando vuelva a escribir).',
      });
    }

    const conversation = await db.conversation.findFirst({
      where: { clientId: client.id, status: 'OPEN' },
      orderBy: { createdAt: 'desc' }
    });

    if (conversation) {
      await db.messageLog.create({
        data: { conversationId: conversation.id, role: 'assistant', content: message }
      });

      // Get last message timestamp from conversation logs to check 24h window
      const lastUserMessage = await db.messageLog.findFirst({
        where: { conversationId: conversation.id, role: 'user' },
        orderBy: { createdAt: 'desc' }
      });

      try {
        await whatsappProvider.sendMessage(
          realPhone,
          message,
          lastUserMessage?.createdAt || null
        );
      } catch (err) {
        fastify.log.error(err, 'Failed to send manual WhatsApp message');
        return reply.code(500).send({ error: 'Failed to send message' });
      }
    }

    return { success: true };
  });

  // POST: Preguntar al asistente (panel) — mismo cerebro que el bot real
  // (system prompt + datos reales del negocio), sin persistir nada y sin
  // poder crear citas de verdad.
  fastify.post('/assistant/ask', async (request, reply) => {
    const body = request.body as { message?: unknown; history?: unknown };

    if (typeof body?.message !== 'string' || !body.message.trim()) {
      return reply.code(400).send({ error: 'MESSAGE_REQUIRED' });
    }

    const history: SandboxMessage[] = Array.isArray(body.history)
      ? body.history
          .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
          .slice(-20)
          .map((m: any) => ({ role: m.role, content: m.content }))
      : [];

    try {
      const reply_ = await askAssistantSandbox(body.message, history);
      return { reply: reply_ };
    } catch (err) {
      fastify.log.error(err, 'Error en assistant sandbox');
      return reply.code(502).send({ error: 'ASSISTANT_UNAVAILABLE', message: 'El asistente no está disponible en este momento.' });
    }
  });
}

