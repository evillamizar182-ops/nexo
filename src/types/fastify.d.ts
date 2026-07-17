import 'fastify';

// El decorador `authenticate` se registra en server.ts con server.decorate(...)
// y se usa como onRequest hook en las rutas protegidas (dashboard, /me).
// Esta augmentación lo hace visible para TypeScript.
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorizeAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// El payload del JWT incluye rol (para RBAC).
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; role: string };
    user: { id: string; email: string; role: string; iat?: number; exp?: number };
  }
}
