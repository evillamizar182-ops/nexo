import { z } from 'zod';

// ─── Weak/default secret denylist ─────────────────────────────────────────────
// These are the placeholder values that shipped with the project. If any of them
// reaches production, the whole auth/HMAC layer is trivially bypassable, so we
// refuse to boot. In development we only warn (to keep local demos running).
const WEAK_SECRETS = [
  'super-secret-key-32-characters-long-nexo',
  'another-super-secret-32-char-key-nexo',
  'changeme',
  'secret',
  'fake',
];

const isWeakSecret = (v: string) =>
  WEAK_SECRETS.some(w => v.toLowerCase().includes(w.toLowerCase()));

// Coerce common truthy strings ("true", "1") to boolean for feature flags.
const boolFlag = (def: boolean) =>
  z
    .string()
    .optional()
    .transform(v => (v === undefined ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),

  // Database — acepta tanto postgresql://... como file:./dev.db (SQLite)
  DATABASE_URL: z.string().min(1),

  // Redis (Upstash)
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Auth
  JWT_SECRET: z.string().min(32),
  HMAC_KEY: z.string().min(32),
  // AES-256-GCM key for reversible phone encryption (Client.phoneEncrypted).
  // Must be exactly 64 hex chars (32 bytes). Distinct from HMAC_KEY on purpose.
  PHONE_ENC_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'Debe ser 64 caracteres hex (32 bytes)'),

  // AI
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  // Endpoint compatible con la Messages API de Anthropic. Vacío => api.anthropic.com
  // (Claude real). Se puede apuntar a un proveedor compatible (p. ej. Z.AI GLM)
  // para usar otro modelo sin tocar el tool loop; ajusta también ANTHROPIC_MODEL.
  ANTHROPIC_BASE_URL: z.string().url().optional(),

  // WhatsApp (Meta Cloud API)
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  // App Secret con el que se valida la firma HMAC del webhook. Es la ÚNICA
  // barrera contra mensajes falsificados. La longitud/robustez se exige abajo
  // de forma fail-closed en producción (aquí min(1) para no romper el demo local).
  WHATSAPP_APP_SECRET: z.string().min(1),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),

  // ─── Security / operational flags ──────────────────────────────────────────
  // Comma-separated list of origins allowed by CORS (dashboard URLs).
  CORS_ORIGINS: z.string().optional(),
  // MUST stay false in production. Only enables unsigned webhook POSTs for local
  // simulation (TEST_WEBHOOK_LOCAL.bat). Decoupled from NODE_ENV on purpose so a
  // stray NODE_ENV can never silently open the webhook.
  WEBHOOK_ALLOW_UNSIGNED: boolFlag(false),
  // Use in-memory mock services instead of real Anthropic/Meta calls.
  USE_MOCKS: boolFlag(false),
  ENABLE_AUDIO_HANDLER: boolFlag(false),

  // ─── Network / proxy ───────────────────────────────────────────────────────
  // trustProxy: NO confiar en X-Forwarded-For por defecto (evita spoofing de IP
  // que burlaría el rate limit). Ponlo a 'true' o a la subred del proxy real
  // (ej. '10.0.0.0/8') SOLO si hay un reverse-proxy de confianza delante.
  TRUST_PROXY: z.string().optional(),
  // Interfaz de escucha. Vacío => 127.0.0.1 en dev, 0.0.0.0 en producción.
  HOST: z.string().optional(),
  // Vida del JWT. Corta por seguridad (menos ventana si se filtra un token).
  JWT_EXPIRES_IN: z.string().default('1d'),

  // Admin control (comma-separated phone numbers for WhatsApp "!" commands)
  ADMIN_NUMBERS: z.string().optional(),
  ADMIN_PHONE: z.string().optional(),
  // Seed script credentials (never hardcode; supply at seed time)
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),

  // Google APIs (optional integrations)
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().optional(),

  // Resilience (Circuit Breaker)
  CB_FAILURE_THRESHOLD: z.string().transform(Number).default('3'),
  CB_RECOVERY_TIMEOUT: z.string().transform(Number).default('30000'),

  // Token opcional para que un scraper (Prometheus) acceda a /metrics vía
  // `Authorization: Bearer <token>`. Sin él, /metrics solo lo abre un admin.
  METRICS_TOKEN: z.string().min(16).optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;

// ─── Fail-closed on weak secrets in production ────────────────────────────────
const weakJwt = isWeakSecret(env.JWT_SECRET);
const weakHmac = isWeakSecret(env.HMAC_KEY);
// El App Secret del webhook es la única barrera anti-spoofing: se trata igual que
// JWT/HMAC. "fake"/placeholder o menos de 16 chars cuenta como débil.
const weakWaSecret = isWeakSecret(env.WHATSAPP_APP_SECRET) || env.WHATSAPP_APP_SECRET.length < 16;

if (env.NODE_ENV === 'production' && (weakJwt || weakHmac || weakWaSecret)) {
  console.error(
    '❌ SECURITY: JWT_SECRET/HMAC_KEY/WHATSAPP_APP_SECRET use a known weak/default ' +
      'or too-short value. Generate strong secrets with:\n' +
      '   node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n' +
      '   (WHATSAPP_APP_SECRET debe ser el App Secret real de tu app de Meta.)'
  );
  process.exit(1);
}

if (weakJwt || weakHmac || weakWaSecret) {
  console.warn('⚠️  [SECURITY] Weak JWT_SECRET/HMAC_KEY/WHATSAPP_APP_SECRET detected — replace before deploying to production.');
}

if (env.NODE_ENV === 'production' && env.WEBHOOK_ALLOW_UNSIGNED) {
  console.error('❌ SECURITY: WEBHOOK_ALLOW_UNSIGNED must not be true in production.');
  process.exit(1);
}

// Re-export the inferred type for strong typing across the app
export type Env = z.infer<typeof envSchema>;
