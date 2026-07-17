import 'dotenv/config';

// Errores críticos: se registran por stdout (lo captura el gestor de procesos).
// NO se escriben stack traces a disco: filtran rutas/identificadores internos y
// fs.appendFileSync bloquea el event loop / permite llenar el disco.
process.on('uncaughtException', (err) => {
  console.error('💥 CRITICAL ERROR:', err);
  process.exit(1);
});

import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { AUTH_COOKIE } from './utils/authCookie';
import { env } from './config/env';
import { prisma } from './repositories/index';
import { checkRedisHealth } from './utils/redis';
import { webhookRoutes } from './routes/webhook';
import { authRoutes } from './routes/auth';
import { dashboardRoutes } from './routes/dashboard';

// trustProxy: por defecto FALSE. Si es true, Fastify usa X-Forwarded-For como IP
// del cliente — y ese header lo controla el atacante, permitiéndole rotar IPs y
// burlar el rate limit. Solo se activa si TRUST_PROXY declara un proxy de confianza.
function resolveTrustProxy(): boolean | string {
  const v = env.TRUST_PROXY?.trim();
  if (!v) return false;
  if (v.toLowerCase() === 'true') return true;
  if (v.toLowerCase() === 'false') return false;
  return v; // lista de IPs/subredes de confianza (ej. "10.0.0.0/8,127.0.0.1")
}

const server = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    transport: env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
  },
  trustProxy: resolveTrustProxy(),
  bodyLimit: 2 * 1024 * 1024, // 2MB
});

async function build() {
  // ─── Security Headers ────────────────────────────────────────────────────
  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });

  // ─── CORS ────────────────────────────────────────────────────────────────
  // Explicit allowlist from CORS_ORIGINS (comma-separated). Falls back to the
  // local dashboard dev ports in development. We never reflect an arbitrary
  // origin while credentials are enabled — that would let any site issue
  // credentialed requests on the user's behalf.
  const configuredOrigins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const allowedOrigins = configuredOrigins.length
    ? configuredOrigins
    : env.NODE_ENV === 'development'
      ? ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
      : [];

  await server.register(cors, {
    origin: (origin, cb) => {
      // Non-browser clients (curl, server-to-server) send no Origin header.
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Origin not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ─── Cookies (para el JWT httpOnly) ──────────────────────────────────────
  await server.register(cookie);

  // ─── JWT (registered once at root — shared by all routes) ────────────────
  // El token se lee de la cookie httpOnly `access_token` y, como respaldo para
  // clientes de API (curl/CLI), de la cabecera Authorization: Bearer.
  await server.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
    cookie: { cookieName: AUTH_COOKIE, signed: false },
  });

  const { isTokenRevoked } = await import('./utils/tokenStore');

  // authenticate: verifica firma + expiración Y que el token no esté revocado
  // (logout / revocación server-side, cerrando el hueco del JWT irrevocable).
  server.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
      const raw = request.cookies?.[AUTH_COOKIE]
        || (request.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
      if (raw && (await isTokenRevoked(raw))) {
        return reply.code(401).send({ error: 'TOKEN_REVOKED' });
      }
    } catch (err) {
      reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
  });

  // authorizeAdmin: exige rol ADMIN (RBAC). Se usa tras `authenticate`.
  server.decorate('authorizeAdmin', async (request: any, reply: any) => {
    if (request.user?.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
  });

  // ─── Rate Limiting ───────────────────────────────────────────────────────
  // GLOBAL: todas las rutas quedan protegidas por defecto (antes global:false
  // dejaba webhook, dashboard, health, etc. sin ningún límite). /login mantiene
  // su propio límite más estricto vía config de ruta.
  await server.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
  });

  // ─── Routes ──────────────────────────────────────────────────────────────
  await server.register(webhookRoutes);
  await server.register(authRoutes, { prefix: '/api/auth' });
  await server.register(dashboardRoutes, { prefix: '/api/dashboard' });

  // ─── Metrics & Automation ──────────────────────────────────────────────
  const { setupMetrics } = await import('./infrastructure/metrics');
  await setupMetrics(server);

  const { remarketingService } = await import('./features/remarketing/remarketingService');
  remarketingService.init();

  // ─── Health Endpoints ────────────────────────────────────────────────────
  server.get('/health', async () => ({
    status: 'HEALTHY',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  }));

  // Usa el decorator `authenticate`: verifica firma, expiración Y revocación
  // (un token deslogueado ya no puede leer el estado detallado del sistema).
  server.get('/health/detailed', { onRequest: [(server as any).authenticate, (server as any).authorizeAdmin] }, async (request, reply) => {
    let dbStatus = 'DISCONNECTED';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'CONNECTED';
    } catch {
      // DB is down
    }

    const redisOk = await checkRedisHealth();

    return {
      status: dbStatus === 'CONNECTED' && redisOk ? 'HEALTHY' : 'DEGRADED',
      version: '2.0.0',
      uptime: process.uptime(),
      services: {
        database: dbStatus,
        redis: redisOk ? 'CONNECTED' : 'DISCONNECTED',
      },
      memory: process.memoryUsage(),
    };
  });

  // Root
  server.get('/', async () => ({
    status: 'NEXO IA ONLINE',
    version: '2.0.0',
  }));

  // ─── Error Handler ──────────────────────────────────────────────────────
  server.setErrorHandler((error: any, request, reply) => {
    // Log estructurado por el logger (stdout). Nunca a un archivo con stacks crudos.
    server.log.error(error);

    // Respeta 4xx explícitos (rate limit 429, validación 400, etc.).
    const status = error?.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    reply.status(status).send({
      error: status === 500 ? 'INTERNAL_SERVER_ERROR' : (error?.name || 'ERROR'),
      message: status === 500
        ? (env.NODE_ENV === 'development' ? error?.message : 'Algo salió mal en el servidor')
        : error?.message,
    });
  });

  return server;
}

// ─── Startup ───────────────────────────────────────────────────────────────
(async () => {
  try {
    const app = await build();
    
    // VERIFICAR CONEXIÓN DB
    console.log('[DB] 🔌 Conectando a la base de datos...');
    await prisma.$connect();
    console.log('[DB] ✅ Conexión exitosa');

    // Higiene: limpiar tokens revocados ya expirados.
    try {
      const { purgeExpiredRevoked } = await import('./utils/tokenStore');
      await purgeExpiredRevoked();
    } catch { /* no crítico */ }

    // Host: 127.0.0.1 en dev (no exponer a la LAN), 0.0.0.0 en prod (tras firewall/proxy).
    const host = env.HOST ?? (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
    await app.listen({ port: env.PORT, host });
    server.log.info({ port: env.PORT, host }, '🚀 Nexo IA v2.0.0 started');
  } catch (err) {
    server.log.fatal(err, 'Fatal startup error');
    process.exit(1);
  }
})();

// ─── Graceful Shutdown ─────────────────────────────────────────────────────
async function shutdown(signal: string) {
  server.log.info({ signal }, 'Graceful shutdown initiated');
  try {
    await server.close();
    await prisma.$disconnect();
    server.log.info('All connections drained. Exiting.');
    process.exit(0);
  } catch (err) {
    server.log.error(err, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// NOTE: unhandledRejection must NOT kill the process. A single request that
// triggers an un-awaited rejection would otherwise take the whole server down
// (remote DoS). We log it and keep serving. uncaughtException is handled once,
// at the top of the file, where continuing is genuinely unsafe.
process.on('unhandledRejection', (reason) => {
  server.log.error({ reason }, 'Unhandled rejection (kept alive)');
});
