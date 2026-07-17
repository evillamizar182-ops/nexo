import client from 'prom-client';
import { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';

/**
 * INFRAESTRUCTURA: Prometheus Metrics
 * Expone telemetría en tiempo real del servidor.
 * 
 * ¿Por qué?: Permite el monitoreo industrial con herramientas como Grafana. 
 * Podemos ver picos de tráfico, latencia de la IA y uso de memoria 
 * para escalar el servidor proactivamente.
 */

// Registro global de métricas
const register = new client.Registry();

// Métricas por defecto (CPU, Memoria, etc)
client.collectDefaultMetrics({ register });

// Métrica personalizada: Conteo de mensajes procesados
export const messageCounter = new client.Counter({
  name: 'nexo_messages_total',
  help: 'Total de mensajes procesados por la IA',
  labelNames: ['provider', 'status']
});
register.registerMetric(messageCounter);

// Métrica personalizada: Duración de respuesta de IA
export const aiResponseHistogram = new client.Histogram({
  name: 'nexo_ai_response_duration_seconds',
  help: 'Latencia de respuesta de Anthropic Claude',
  buckets: [1, 2, 5, 10, 20, 30]
});
register.registerMetric(aiResponseHistogram);

/**
 * Timing-safe comparison of the presented bearer against METRICS_TOKEN.
 */
function metricsTokenOk(authHeader: string | undefined): boolean {
  const expected = env.METRICS_TOKEN;
  if (!expected) return false;
  const presented = (authHeader || '').replace(/^Bearer\s+/i, '');
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Conecta el endpoint /metrics al servidor Fastify.
 *
 * SEGURIDAD: /metrics filtra telemetría de proceso/host (memoria, CPU, internals
 * de Node) y contadores de negocio. Ya NO es público. Se acepta:
 *   1) Un scraper (Prometheus) con `Authorization: Bearer <METRICS_TOKEN>`, o
 *   2) Un admin autenticado (JWT httpOnly + rol ADMIN), como respaldo manual.
 * Si no se cumple ninguno, responde 401 sin exponer nada.
 */
export async function setupMetrics(fastify: FastifyInstance) {
  fastify.get('/metrics', {
    onRequest: async (request: any, reply: any) => {
      // Vía 1: token de scraper de solo lectura.
      if (metricsTokenOk(request.headers['authorization'])) return;

      // Vía 2: JWT válido, no revocado, con rol ADMIN.
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({ error: 'UNAUTHORIZED' });
      }
      if (request.user?.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'FORBIDDEN' });
      }
    },
  }, async (_request, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });

  console.log('[METRICS] 📊 Endpoint /metrics habilitado (protegido)');
}
