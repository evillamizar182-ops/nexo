import { z } from 'zod';

// ─── Normalización para detección ─────────────────────────────────────────────
// La detección de inyección se hace SIEMPRE sobre una forma normalizada, nunca
// sobre el texto crudo. Esto neutraliza las evasiones más comunes:
//   • Tildes / mayúsculas   → "IGNORÁ" y "ignora" colapsan al mismo token.
//   • Caracteres de ancho cero y de control bidireccional (U+200B, U+202E…)
//     que se cuelan entre letras para romper los patrones.
//   • Espaciado irregular.
// Importante: SOLO se usa para decidir si hay patrón malicioso. El texto que se
// almacena y se reenvía al modelo/usuario sigue siendo el sanitizado legible.
function normalizeForDetection(str: string): string {
  return str
    .normalize('NFKD')                                   // separa diacríticos
    .replace(/[\u0300-\u036f]/g, '')             // elimina acentos
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '') // zero-width + bidi
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Blocklist de inyección (defensa en profundidad, bilingüe) ────────────────
// NO es el control principal — ese es el sandbox de tools con validación Zod y
// el clientId derivado del servidor. Esta capa reduce ruido y ataques triviales.
// Patrones escritos sobre la forma normalizada (minúsculas, sin tildes).
const INJECTION_PATTERNS: RegExp[] = [
  // Inglés
  /ignore\s+(all\s+|the\s+|any\s+)?(previous|prior|above)/,
  /forget\s+(all\s+|your\s+|the\s+)?(previous\s+)?(instruction|rule|prompt)/,
  /\bdisregard\b/,
  /system\s+(prompt|override|message|instruction)/,
  /developer\s+mode/,
  /\bjailbreak/,
  /\bsudo\b/,
  /prompt\s+injection/,
  /you\s+are\s+now\b/,
  /new\s+(instruction|role|rule|persona)/,
  /act\s+as\b/,
  /pretend\s+to\s+be/,
  /override\s+(your\s+)?(instruction|rule|system|prompt)/,
  /(reveal|repeat|print|show|expose)\s+(me\s+)?(your\s+)?(system\s+)?(prompt|instruction)/,
  /what\s+(is|are)\s+your\s+(system\s+)?(prompt|instruction)/,
  /\bdan[\s\-]?mode\b/,

  // Español — inyección / secuestro de rol (sobre texto sin tildes)
  /ignora\w*\s+(todas?\s+)?(las?\s+|tus\s+|mis\s+|estas\s+)?(instruccion|indicacion|regla|orden|directriz|consigna)/,
  /ignora\w*\s+(todo\s+)?(lo\s+)?anterior/,
  /olvida\w*\s+(de\s+)?(todas?\s+)?(las?\s+|tus\s+|lo\s+)?(instruccion|indicacion|regla|anterior|todo)/,
  /descarta\w*\s+(las?\s+|tus\s+)?(instruccion|indicacion|regla|anterior)/,
  /omit[ae]\w*\s+(las?\s+|tus\s+)?(instruccion|indicacion|regla)/,
  /salta\w*\s+(las?\s+|tus\s+)?(regla|instruccion|restriccion)/,
  /nuev[ao]s?\s+(instruccion|indicacion|regla|orden|persona)/,
  /(a partir de ahora|de ahora en adelante|desde ahora)\s+(eres|actua|seras)/,
  /ahora\s+(eres|actuas|seras)\b/,
  /actua\w*\s+como\b/,
  /comporta\w*\s+como\b/,
  /haz\s+(de\s+cuenta|como\s+si)/,
  /finge\w*\s+(ser|que|un|una)/,
  /simula\w*\s+(ser|que|un|una)/,
  /modo\s+(desarrollador|dios|dan|libre|sin\s+restriccion)/,
  /sin\s+(restriccion|filtro|censura|limite)\w*/,
  /(revela|muestra|dame|dime|imprime|repite|escribe|comparte|ensena|filtra)\w*\s+(me\s+)?(tu|tus|el|la|las|los)?\s*(prompt|system|sistema|instruccion|configuracion|reglas internas|mensaje de sistema)/,
  /(cual|cuales|que)\s+(es|son)\s+(tu|tus)\s+(prompt|instruccion|configuracion)/,
  /prompt\s+(del\s+)?sistema/,
  /mensaje\s+de\s+sistema/,
  /instruccion\w*\s+(internas?|del sistema|de sistema|originales?|iniciales?|secretas?)/,
  /eres\s+libre\b/,
  /ya\s+no\s+tienes\s+(regla|restriccion|limite|filtro)/,
];

// ─── Marcadores de fuga del system prompt (guardia de salida) ─────────────────
// Se aplican a la RESPUESTA del modelo antes de enviarla. Si el modelo —por una
// inyección exitosa u otra razón— empieza a recitar la estructura interna del
// prompt o los nombres de las tools, se bloquea y se responde algo seguro.
// El negocio nunca habla con clientes usando estos términos, así que el riesgo
// de falso positivo es mínimo.
const LEAK_MARKERS: RegExp[] = [
  /regla\w*\s+critic\w*\s+de\s+seguridad/,
  /identidad\s+y\s+rol/,
  /protocolo\w*\s+de\s+operacion/,
  /instruccion\w*\s+tecnicas/,
  /contexto\s+dinamico/,
  /cumplimiento\s+legal/,
  /system\s+prompt/,
  /prompt\s+del\s+sistema/,
  /\bcheck_availability\b/,
  /\breserve_appointment\b/,
  /\bcheck_inventory\b/,
  /\bget_services\b/,
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
 * Matching runs on a normalized form so accents, casing, zero-width chars and
 * irregular spacing can't be used to slip a payload past the blocklist.
 */
export function hasInjectionPattern(str: string): boolean {
  const norm = normalizeForDetection(str);
  return INJECTION_PATTERNS.some(p => p.test(norm));
}

/**
 * Detects whether an assistant reply is leaking the system prompt structure or
 * internal tool names. Used as a fail-safe on OUTBOUND text (defense in depth):
 * even if an injection succeeds, the internal prompt never reaches the user.
 */
export function containsPromptLeak(reply: string): boolean {
  // Corridas de la línea decorativa "═══" que separa las secciones del prompt.
  if (/═{3,}/.test(reply)) return true;
  const norm = normalizeForDetection(reply);
  return LEAK_MARKERS.some(p => p.test(norm));
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
