import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../repositories/index';
import { verifyPassword } from '../utils/auth';
import { revokeToken } from '../utils/tokenStore';
import { AUTH_COOKIE, authCookieOptions } from '../utils/authCookie';
import { env } from '../config/env';

// Brute-force protection: estricto en producción (5/15min, guía OWASP),
// más permisivo en desarrollo para no bloquearte mientras pruebas en local.
const LOGIN_MAX_ATTEMPTS = env.NODE_ENV === 'production' ? 5 : 30;

// Hash "señuelo" con formato válido (salt:hash de 64 bytes). Permite ejecutar
// scrypt aunque el email NO exista, igualando los tiempos de respuesta y
// eliminando el oráculo de enumeración de usuarios por temporización.
const DUMMY_HASH = '0'.repeat(32) + ':' + '0'.repeat(128);

function extractToken(request: any): string {
  return request.cookies?.[AUTH_COOKIE]
    || (request.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
}

export const authRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {

  server.post('/login', {
    config: { rateLimit: { max: LOGIN_MAX_ATTEMPTS, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const body = request.body as { email?: unknown; password?: unknown };
    // Tope de longitud: evita que una entrada gigante (hasta el bodyLimit de 2MB)
    // haga trabajar de más a scrypt/consulta. 254 = máx RFC de email.
    const email = typeof body?.email === 'string' ? body.email.slice(0, 254) : '';
    const password = typeof body?.password === 'string' ? body.password.slice(0, 1024) : '';
    if (!email || !password) return reply.code(400).send({ message: 'Email y contrasena requeridos' });

    const user = await prisma.user.findUnique({ where: { email } });
    // Tiempo constante: scrypt corre SIEMPRE (con el hash real o el señuelo).
    const passwordOk = await verifyPassword(password, user?.password ?? DUMMY_HASH);
    if (!user || !passwordOk) return reply.code(401).send({ message: 'Credenciales invalidas' });

    const token = server.jwt.sign({ id: user.id, email: user.email, role: user.role });

    // Cookie httpOnly: el navegador la guarda y la envía sola; JS no la ve.
    const decoded = server.jwt.decode<{ exp?: number }>(token);
    const maxAge = decoded?.exp ? Math.max(0, decoded.exp - Math.floor(Date.now() / 1000)) : undefined;
    reply.setCookie(AUTH_COOKIE, token, authCookieOptions(maxAge));

    // No se devuelve el token en el cuerpo para el navegador; solo el usuario.
    // (Los clientes de API pueden seguir usando Authorization: Bearer con /login.)
    return reply.send({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });

  server.get('/me', {
    onRequest: [(server as any).authenticate],
  }, async (request, reply) => {
    const payload = request.user as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) return reply.code(404).send({ message: 'Usuario no encontrado' });
    return reply.send(user);
  });

  // Logout: revoca el token server-side y borra la cookie httpOnly.
  server.post('/logout', {
    onRequest: [(server as any).authenticate],
  }, async (request, reply) => {
    const raw = extractToken(request);
    const payload = request.user as { exp?: number };
    const expiresAt = payload.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (raw) await revokeToken(raw, expiresAt);
    reply.clearCookie(AUTH_COOKIE, authCookieOptions());
    return reply.send({ status: 'logged_out' });
  });
};
