import { z } from 'zod';

// ─── Injection Pattern Blocklist ──────────────────────────────────────────────
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+previous/i,
  /forget\s+instructions/i,
  /system\s+override/i,
  /\bDAN\b/,
  /jailbreak/i,
  /developer\s+mode/i,
  /\bsudo\b/i,
  /\bsimulate\b/i,
  /act\s+as/i,
  /pretend\s+to\s+be/i,
  /you\s+are\s+now/i,
  /new\s+role/i,
  /disregard/i,
];

/**
 * Strip C0/C1 control characters (keeps tab, newline, CR).
 */
function stripControlChars(str: string): string {
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

/**
 * Escape XML entities to prevent injection into XML-tagged prompts.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Checks if a string contains known prompt injection patterns.
 */
export function hasInjectionPattern(str: string): boolean {
  return INJECTION_PATTERNS.some(p => p.test(str));
}

/**
 * Sanitize a user-facing field: strip control chars, escape XML, truncate.
 */
export function sanitizeField(value: unknown, maxLen: number): string {
  const raw = String(value ?? '');
  return stripControlChars(escapeXml(raw)).substring(0, maxLen).trim();
}

/**
 * Sanitize user message input. Returns null if injection detected.
 */
export function sanitizeUserMessage(text: string, maxLen = 500): string | null {
  const sanitized = sanitizeField(text, maxLen);
  if (hasInjectionPattern(sanitized)) return null;
  return sanitized;
}

// ─── Zod Schemas for Tool Inputs ──────────────────────────────────────────────

export const BarberoSchema = z.union([
  z.string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'Nombre solo puede contener letras y espacios'),
  z.literal('cualquiera'),
]);

export const FechaSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe ser YYYY-MM-DD');

export const HoraSchema = z.string()
  .regex(/^\d{2}:\d{2}$/, 'Hora debe ser HH:mm');

export const ServicioSchema = z.string()
  .min(1)
  .max(100)
  .transform(s => s.trim());

export const NombreClienteSchema = z.string()
  .min(1)
  .max(100)
  .transform(v => v.replace(/[<>&"']/g, ''))
  .default('Cliente');

export const ProductoSchema = z.string()
  .min(1)
  .max(100)
  .transform(v => v.replace(/[%_]/g, c => `\\${c}`));
