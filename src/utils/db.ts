import { env } from '../config/env';

/**
 * Detecta el motor de base de datos a partir de DATABASE_URL.
 * Local usa SQLite (file:...), producción usa PostgreSQL (postgres://...).
 */
export const isPostgres = /^postgres(ql)?:\/\//i.test(env.DATABASE_URL);

/**
 * Filtro de búsqueda case-insensitive compatible con ambos motores.
 *
 * - PostgreSQL: requiere `mode: 'insensitive'` para ignorar mayúsculas.
 * - SQLite: `LIKE` ya es case-insensitive para ASCII y NO acepta `mode`
 *   (lanzaría error), así que se omite.
 *
 * Uso:  where: { name: { contains: valor, ...insensitive } }
 *
 * Se tipa como `any` a propósito: el tipo del cliente Prisma generado difiere
 * según el provider, y este objeto debe encajar en ambos sin ruido de tipos.
 */
export const insensitive: any = isPostgres ? { mode: 'insensitive' } : {};
