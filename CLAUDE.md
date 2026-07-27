# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Nexo IA es un asistente de WhatsApp (Meta Cloud API) con IA de Claude para una barbería/salón, más un dashboard de gestión. Backend Fastify + Prisma + Anthropic; frontend Vite/React. Documentación de referencia en `README.md`, `docs/ARCHITECTURE.md`, `docs/ADMIN_COMMANDS.md` y `SECURITY.md`.

## Estructura: dos apps en un repo

- **Backend** en `src/` (raíz del repo). Todos los comandos de backend se ejecutan desde la raíz.
- **Dashboard** en `dashboard/` (proyecto Vite independiente, con su propio `package.json`). Sus comandos se ejecutan desde `dashboard/`.
- El dashboard habla con el backend vía **proxy de Vite**: `/api` → `http://localhost:3100` (ver `dashboard/vite.config.ts`, aplica tanto en `dev` como en `preview`). El cliente axios (`dashboard/src/api.ts`) usa `baseURL=/api` con `withCredentials`.
- **El backend escucha en el puerto `PORT` (usar `3100` en dev para que el proxy del dashboard funcione).** El `.env.example` trae `3000` por defecto, pero el proxy apunta a `3100`.

## Comandos

**Backend (desde la raíz):**
```bash
npm install
npx prisma db push          # crea el esquema SQLite en prisma/dev.db (dev)
npm run seed                # crea admin + datos demo (lee ADMIN_EMAIL/ADMIN_PASSWORD del .env)
npm run dev                 # backend en :PORT (ts-node-dev, recarga)
npm run build               # tsc -> dist/server.js
npm start                   # node dist/server.js (usa el build)
npm run test:smoke          # única suite: src/scripts/smoke-test.ts (humo end-to-end)
npx tsc --noEmit            # typecheck sin emitir
```

**Dashboard (desde `dashboard/`):**
```bash
npm install
npm run dev                 # :5173
npm run build               # tsc && vite build
npm run lint                # eslint
npx tsc --noEmit            # typecheck
```

**No hay framework de tests unitarios.** La verificación es `npm run test:smoke` (humo end-to-end) + prueba manual en el dashboard. "Correr un solo test" no aplica (no hay runner); se ejecuta el script de humo completo.

### Local (SQLite) ↔ Producción (PostgreSQL)

Hay **dos schemas Prisma que deben mantenerse como espejo exacto** salvo el `provider`:
- `prisma/schema.prisma` — `sqlite` (dev)
- `prisma/schema.production.prisma` — `postgresql` (prod, p. ej. Supabase)

El **cliente Prisma se genera en una sola ubicación**, así que al cambiar de motor hay que regenerarlo:
```bash
npm run prisma:generate         # cliente SQLite (dev)
npm run prisma:generate:prod    # cliente PostgreSQL (prod)
npm run db:push:prod            # crea el esquema en Postgres (o prisma:migrate:prod)
```
Con `USE_MOCKS=true` (o `ANTHROPIC_API_KEY=sk-ant-fake`) la IA responde simulada, sin llamar a Anthropic (ver `src/mocks/`).

El cliente `Anthropic` (`services/conversation.service.ts` y `features/assistantSandbox`) soporta `ANTHROPIC_BASE_URL` opcional (`config/env.ts`) para apuntar a un proveedor compatible con la Messages API distinto de Claude (p. ej. Z.AI GLM) sin tocar el tool loop — útil como puente mientras no hay crédito de Anthropic. `ANTHROPIC_MODEL` debe cambiar junto con el proveedor.

### Carga del entorno

El backend hace `import 'dotenv/config'` (`src/server.ts`), que carga **`.env`** — no `.env.production`. Para desplegar en producción, el archivo de secretos de producción debe terminar llamándose `.env` (o exportar las vars en el entorno del host). `start-prod.js` también parsea `.env` a mano antes de lanzar. Para apuntar dotenv a otro archivo en un comando puntual: `DOTENV_CONFIG_PATH=.env.production`.

## Arquitectura

### Pipeline de mensaje entrante (el núcleo)

El flujo real de un mensaje de WhatsApp cruza varios archivos; entenderlo es la clave del sistema:

1. **`routes/webhook.ts`** — `POST /webhook/whatsapp`. Valida la firma HMAC de Meta (`utils/crypto.ts:validateWebhookHmac` con `WHATSAPP_APP_SECRET`; es la única barrera anti-spoofing). Dedup de imágenes en memoria y **rate limit por número de teléfono** (el rate limit global de Fastify es por IP, y para el webhook todo llega desde IPs de Meta → sería un cubo único inútil).
2. Antes de la IA corren interceptores/adapters: **admin commands** (`features/adminCommands`, comandos `!` de administradores autorizados por `ADMIN_NUMBERS`/`ADMIN_PHONE`), **silent mode** (`features/silentMode`, pausa global o muteo por cliente), **audio handler** (`features/audioHandler`, transcribe notas de voz; gate `ENABLE_AUDIO_HANDLER`) y **vision ERP** (`features/visionERP`, registra ventas por foto).
3. **`services/buffer.service.ts`** — agrupa ráfagas: encola en Redis (`rpush`) y usa un lock con TTL (`BUFFER_WINDOW_MS`, ~5 s) para juntar varios mensajes seguidos del mismo número en una sola llamada a la IA.
4. **`services/conversation.service.ts:processMessage`** — corazón de la conversación: dedup por `waMessageId` en Redis → sanitiza + chequeo anti prompt-injection (`utils/sanitizer.ts`) → upsert de `Client` → construye contexto (**ventana deslizante de los `MAX_HISTORY_MESSAGES=20` más recientes**, `orderBy desc` + `reverse`) → llama a Anthropic con `TOOL_DEFINITIONS` en un **tool loop** de hasta `MAX_TOOL_ITERATIONS=5`. Protegido por Circuit Breaker (`anthropic`).
5. **`ai/tools/`** — `definitions.ts` (esquema de tools), `validator.ts` (valida args), `executor.ts` (`executeTool` ejecuta contra Prisma: disponibilidad, agendar cita, inventario, etc.). Prompt de sistema en `ai/prompts.ts` (se construye desde `BusinessConfig`, sanitizando cada campo). Las horas de cita se anclan a `BUSINESS_TZ` (`America/Bogota`, hardcoded en `executor.ts`, vía `localDate()` con luxon) — **no** con `new Date()` a secas, que dependería de la TZ del SO del host (en prod normalmente UTC, corriendo las citas varias horas).
6. La respuesta vuelve por **`services/whatsapp.provider.ts:sendMessage`**, que respeta la ventana de 24 h de Meta, reintenta y clasifica errores. Para OTP/plantillas de autenticación (sin ventana 24 h) usa `sendAuthCode`.

### Defensa del agente IA (prompt injection / fuga de prompt)

- **`utils/sanitizer.ts`**: la detección corre siempre sobre una forma **normalizada** (`normalizeForDetection`: quita tildes, minúsculas, elimina zero-width y bidi U+200B–U+202E) para neutralizar ofuscaciones. Blocklist **bilingüe ES/EN** con pares verbo+sustantivo (pocos falsos positivos).
- **Guardia de salida** (`containsPromptLeak`): antes de responder, descarta salidas del modelo que reciten la estructura del system prompt, la línea decorativa `═══` o nombres internos de tools (`check_availability`, etc.) y responde algo seguro.
- **Tool loop fail-closed**: si se agotan las iteraciones con `stop_reason === 'tool_use'`, NO se expone texto parcial (aplica en `conversation.service.ts` y en `features/assistantSandbox`).

### Seguridad de PII y webhook (`utils/crypto.ts`)

El teléfono del cliente **nunca se guarda en claro**: `phoneHash` (HMAC con `HMAC_KEY`, clave de búsqueda determinista, vía `hashPII`) y `phoneEncrypted` (AES-256-GCM reversible con `PHONE_ENC_KEY`, vía `encryptPII`/`decryptPII`). `HMAC_KEY` y `PHONE_ENC_KEY` son distintas a propósito; `PHONE_ENC_KEY` debe ser 64 hex (32 bytes) y **no debe cambiarse** una vez hay datos cifrados. La descarga de media de audio (`features/audioHandler/audioService.ts`) valida `mediaId` y una **allowlist de hosts de Meta** antes de adjuntar el token (anti-SSRF), con tope de tamaño + timeout.

### Auth del dashboard

JWT en cookie **httpOnly** (`AUTH_COOKIE` = `access_token`, el token no llega a JS; respaldo por header `Authorization: Bearer` para clientes de API). El JWT se registra una vez en la raíz (`server.ts`). Decoradores: **`authenticate`** (firma + expiración + revocación server-side vía tabla `RevokedToken` + `utils/tokenStore.ts`) y **`authorizeAdmin`** (RBAC, exige rol `ADMIN`). Rutas bajo `/api/auth` y `/api/dashboard`.

- El interceptor de `dashboard/src/api.ts` **redirige a `/login` ante 401/403**. Por eso, los endpoints públicos/no autenticados deben responder 400/429/200, nunca 401/403.
- El dashboard **no tiene router**: el cambio de vista es por estado (`store/useStore.ts`, `activeTab`); no autenticado renderiza `<Login/>`.

### Validación de entorno fail-closed (`config/env.ts`)

Todo `process.env` se valida con Zod al arrancar; si algo es inválido, el proceso **sale con error**. En **producción** se niega a bootear con secretos débiles/placeholder (`JWT_SECRET`/`HMAC_KEY`/`WHATSAPP_APP_SECRET` — este último mín. 16 chars) o con `WEBHOOK_ALLOW_UNSIGNED=true`. Importa `env` desde aquí, **no leas `process.env` directo**.

### Resiliencia y límites

Circuit Breakers granulares por API externa (`utils/circuit-breaker.ts` + `infrastructure/circuitBreaker.ts`), métricas Prometheus en `/metrics` (`infrastructure/metrics.ts`, protegido por admin o `METRICS_TOKEN`). Rate limiting en capas: **global por IP** (`server.ts`, `global: true`), más estricto en `/login`, y por teléfono en el webhook. Redis es **Upstash vía REST** (`utils/redis.ts`), usado para buffer, dedup, locks y OTP. `bodyLimit` global de 2 MB; `PUT /config` rechaza blobs >64 KB (ese JSON se re-parsea en cada mensaje al construir el prompt). El proceso mantiene vivo el server ante `unhandledRejection` (evita DoS) pero sale ante `uncaughtException`.

## Notas de desarrollo (observadas)

- El `.env` local suele venir con **credenciales placeholder** (`fake`) para Upstash y WhatsApp/Meta. Con eso: WhatsApp se **simula** en dev (`whatsapp.provider.ts` loguea `[WHATSAPP_DEV]`, no envía) y los flujos que dependen de Redis fallan hasta apuntar a un Redis real/emulado.
- En Windows, `ts-node-dev --respawn` **no siempre recarga** al editar; reinicia el backend a mano si un cambio no se refleja.
- La contraseña de usuario se hashea con **scrypt** en formato `salt:hash` (`utils/auth.ts`), independiente del cifrado de PII.
- **Notas de entorno (esta máquina Windows):** herramientas de red pueden fallar por chequeo de revocación de certificado TLS. Para Node, anteponer `NODE_OPTIONS="--use-system-ca"`. El **motor de migraciones de Prisma** (`prisma db push`/`migrate` contra Postgres) puede dar `P1001` por eso aunque `@prisma/client` (query engine) sí conecte; alternativa que funciona: generar el DDL sin conectar (`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.production.prisma --script`) y aplicarlo con el cliente `pg`. Supabase: el host directo `db.<ref>.supabase.co` es solo IPv6; usar el **Session pooler** IPv4 (`aws-0-<region>.pooler.supabase.com:5432`, usuario `postgres.<ref>`).
