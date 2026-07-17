import { RateLimitOptions } from '@fastify/rate-limit';

/**
 * SEGURIDAD: Límite de Intentos de Login (Brute-Force Protection)
 * 
 * ¿Por qué 5 intentos en 15 minutos?:
 * Es el estándar de oro en ciberseguridad (OWASP/SANS) por tres razones:
 * 1. Brute-Force: Bloquea bots que intentan miles de contraseñas por minuto.
 * 2. Experiencia de Usuario: Permite que un humano real se equivoque hasta 4 veces 
 *    (typos, olvidos) antes de ser bloqueado temporalmente.
 * 3. Ventana de Enfriamiento: 15 minutos es suficiente para disuadir ataques automatizados 
 *    sin requerir una intervención manual del soporte técnico.
 */

export const loginRateLimiter: RateLimitOptions = {
  max: 5,
  timeWindow: '15 minutes',
  
  // Identificamos por IP para evitar ataques distribuidos desde un solo punto
  keyGenerator: (request) => request.ip,
  
  // Log de auditoría cuando se supera el límite
  errorResponseBuilder: (request, context) => {
    const timestamp = new Date().toISOString();
    const ip = request.ip;
    
    // Log crítico para auditoría de seguridad
    console.warn(`[SECURITY_ALERT] [${timestamp}] Límite de login excedido para IP: ${ip}. Intentos: 5/15min.`);
    
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Demasiados intentos fallidos. Por seguridad, su IP ha sido bloqueada temporalmente. Intente de nuevo en ${context.after}.`,
      ip: ip,
      timestamp: timestamp
    };
  }
};
