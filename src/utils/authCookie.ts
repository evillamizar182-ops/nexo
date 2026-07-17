import { env } from '../config/env';

// Cookie httpOnly que transporta el JWT. Al ser httpOnly, JavaScript no puede
// leerla => un XSS no puede robar el token (que antes vivía en localStorage).
export const AUTH_COOKIE = 'access_token';

export function authCookieOptions(maxAgeSec?: number) {
  return {
    httpOnly: true,                         // inaccesible a document.cookie / JS
    sameSite: 'lax' as const,               // no se envía en POST cross-site => mitiga CSRF
    secure: env.NODE_ENV === 'production',  // solo HTTPS en producción
    path: '/',
    ...(maxAgeSec ? { maxAge: maxAgeSec } : {}),
  };
}
