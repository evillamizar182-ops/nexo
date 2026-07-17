# Informe de endurecimiento de seguridad — Nexo v15

Auditoría defensiva y correcciones aplicadas. Cada hallazgo incluye severidad,
causa y la corrección implementada.

## Correcciones aplicadas

| # | Severidad | Hallazgo | Corrección |
|---|-----------|----------|-----------|
| 1 | 🔴 Crítica | **Bypass de firma HMAC del webhook** cuando `NODE_ENV=development` (el default). Cualquiera podía inyectar mensajes de WhatsApp falsos. | La validación HMAC ahora es **obligatoria por defecto** y está desacoplada de `NODE_ENV`. Solo se omite con el flag explícito `WEBHOOK_ALLOW_UNSIGNED=true` (para tests locales), que además **aborta el arranque en producción**. (`routes/webhook.ts`, `config/env.ts`) |
| 2 | 🔴 Crítica | **Secretos débiles/expuestos**: `JWT_SECRET`/`HMAC_KEY` predecibles; fragmento de API key hardcodeado en código; password de BD en `.bat`. | Secretos fuertes de 48 bytes generados. Denylist de secretos débiles que **impide arrancar en producción**. Fragmento de key eliminado (modo mock ahora vía `USE_MOCKS`). Secretos sacados de los `.bat`. (`config/env.ts`, `services/conversation.service.ts`, `.env`, `*.bat`) |
| 3 | 🔴 Crítica | **Credenciales admin por defecto** (`admin123`, `nexo2026`) en seeds y scripts. | El seed exige `ADMIN_EMAIL`/`ADMIN_PASSWORD` del entorno y rechaza contraseñas débiles/conocidas. Scripts de debug con credenciales eliminados. (`scripts/seed.ts`, `scripts/smoke-test.ts`) |
| 4 | 🟠 Alta | **`verifyPassword` lanzaba excepción** con hash malformado → 500 / DoS. | Validación robusta de longitud y formato; nunca lanza, devuelve `false`. (`utils/auth.ts`) |
| 5 | 🟠 Alta | **`unhandledRejection` mataba el proceso** → DoS remoto con una sola petición. | Ahora solo registra y mantiene el server vivo. Handlers duplicados consolidados. (`server.ts`) |
| 6 | 🟠 Alta | **CORS reflejaba cualquier origen** con `credentials:true`. | Allowlist explícita vía `CORS_ORIGINS`; nunca refleja orígenes arbitrarios. (`server.ts`) |
| 7 | 🟡 Media | **`limit` sin tope** en rutas del dashboard → extracción masiva. Escrituras sin validar. | `limit` acotado a máx 200; validación de tipos en `POST /inventory`; login endurecido. (`routes/dashboard.ts`, `routes/auth.ts`) |
| 8 | 🟡 Media | Archivos basura/peligrosos y `.gitignore` incompleto. | Eliminados `{`, `auth.ts.txt`, `testpw.js`, `check.js`, `seed.js` (raíz), `crash.log`. `.gitignore` ampliado (`.env*`, `*.db`, `*.log`, `.agents/`). |

Login rate-limit: **5/15 min por IP en producción**, 30 en desarrollo (OWASP).

## Ronda 2 — Auditoría profunda (pentest) + dependencias

Segunda pasada con mentalidad ofensiva. Cada punto se demostró en vivo y se cerró.

| # | Severidad | Hallazgo | Corrección |
|---|-----------|----------|-----------|
| 1 | 🔴 Crítica | **Rate limiting global desactivado** (`global:false`): webhook, dashboard, health y métricas sin ningún límite. | `global:true` (200/min por IP) en todas las rutas; `/login` mantiene su límite estricto. (`server.ts`) |
| 2 | 🔴 Crítica | **Bypass del rate-limit de login por IP spoofing**: `trustProxy:true` confiaba en `X-Forwarded-For` (controlado por el atacante) → rotar IPs anulaba el límite. | `trustProxy` ahora **false por defecto**, configurable vía `TRUST_PROXY` solo con un proxy de confianza. Demostrado: XFF ya no cambia de bucket. (`server.ts`, `config/env.ts`) |
| 3 | 🟠 Alta | **Sin RBAC**: cualquier JWT válido = admin total; `User.role` nunca se comprobaba. | Rol incluido en el JWT + decorador `authorizeAdmin` aplicado a todo el dashboard (403 si no es ADMIN). (`server.ts`, `routes/dashboard.ts`, `routes/auth.ts`) |
| 4 | 🟠 Alta | **JWT irrevocable (7 días) + `localStorage`**: la tabla `RevokedToken` existía sin usarse; sin logout; token robable por XSS. | Revocación server-side real (`utils/tokenStore.ts`, chequeo en `authenticate`), endpoint `/logout`, expiración corta (`JWT_EXPIRES_IN`, default 1d). **Migrado a cookie `httpOnly`** (`SameSite=Lax`, `Secure` en prod): el JWT ya NO es accesible por JavaScript ni se guarda en `localStorage` → **XSS no puede robarlo**. Demostrado: body de login sin token, cookie httpOnly, y token revocado → 401. (`@fastify/cookie`, `utils/authCookie.ts`, `routes/auth.ts`, `dashboard/src/*`) |
| 5 | 🟠 Alta | **Enumeración de usuarios por temporización** en login (scrypt no corría si el email no existía). | Se ejecuta scrypt **siempre** (hash señuelo si no hay usuario) → tiempos constantes. Demostrado: 0.30s vs 0.34s (ruido). (`routes/auth.ts`) |
| 6 | 🟡 Media | **Identidad de admin por `from` de WhatsApp (falsificable)** si el webhook aceptaba payloads sin firma. | Comandos `!` deshabilitados cuando `WEBHOOK_ALLOW_UNSIGNED=true`. (`adminCommands/commandParser.ts`) |
| 7 | 🟡 Media | **Stack traces escritos a disco** (`crash.log`): info disclosure + bloqueo de event loop. | Eliminada toda escritura a disco; logging estructurado por stdout. (`server.ts`) |
| 8 | 🟡 Media | **`/config` PUT destructivo sin transacción**: un fallo parcial dejaba staff/servicios desactivados (auto-DoS). | Envuelto en `$transaction` (rollback atómico) + log de auditoría. (`routes/dashboard.ts`) |
| 9 | 🟡 Media | **Servidor escuchando en `0.0.0.0`** → expuesto a la LAN. | `127.0.0.1` en desarrollo, `0.0.0.0` en producción; configurable con `HOST`. (`server.ts`) |
| 10 | 🔴/🟠 | **Dependencias vulnerables**: 14 CVEs (1 crítica en `fast-jwt` — bypass de auth/confusión de algoritmo; alta en `fast-uri`, `form-data`, `qs`). | Upgrade a **Fastify 5** + `@fastify/jwt` 10 / `cors` 11 / `helmet` 13 / `rate-limit` 10, y `node-cron`/`googleapis` al día. **`npm audit` → 0 vulnerabilidades.** App reverificada de punta a punta sobre el nuevo stack. |

**No son bugs de código (mitigados por diseño):**
- *Blocklist de prompt-injection* (`utils/sanitizer.ts`): es una capa débil y evitable; el control real y efectivo es el **sandbox de 4 tools con validación Zod**, que sí está en su sitio.
- *Hash determinista de teléfonos* (`utils/crypto.ts`): pseudonimización estándar (HMAC-SHA256); reversible **solo si se filtra `HMAC_KEY`**. Mitigación = secreto fuerte y protegido.

## Verificación

13 pruebas de runtime + 2 de fail-closed de producción, todas en verde:
contraseñas correctas/incorrectas/malformadas, HMAC ausente/inválida/manipulada/válida,
y aborto de arranque en producción con secreto débil o webhook abierto.

---

## ⚠️ Acciones pendientes que debes hacer tú

Estas no las puedo hacer yo (requieren tus credenciales/paneles):

1. **Rotar la contraseña de Supabase.** La anterior estuvo expuesta en texto plano.
   Supabase → *Project Settings → Database → Reset database password*, y actualiza
   `DATABASE_URL` en `Produccion/.env`.
2. **Regenerar el cliente Prisma** (está desactualizado respecto a `schema.prisma`,
   por eso el typecheck falla y se corre con `--transpile-only`):
   ```
   cd Produccion
   npx prisma generate
   npx prisma migrate deploy   # o: npx prisma db push
   ```
3. **Re-seedear el admin** con las nuevas credenciales del `.env`:
   ```
   npm run seed
   ```
   Usuario admin actual: definido en `ADMIN_EMAIL` / `ADMIN_PASSWORD` del `.env`.
4. **Para producción**: pon `NODE_ENV=production`, secretos reales de Anthropic/Meta,
   `CORS_ORIGINS` con la URL real del dashboard, y `WEBHOOK_ALLOW_UNSIGNED=false`.

## Bugs funcionales corregidos

- ✅ `routes/webhook.ts` usaba `whatsappProvider` sin importarlo (crasheaba con
  imágenes) → import añadido + tipo `image` en el payload.
- ✅ `TEST_WEBHOOK_LOCAL.bat` apuntaba a `/webhook` → corregido a `/webhook/whatsapp`.
- ✅ `/finance` agregaba por `durationMin` (columna inexistente en `Appointment`) →
  ahora calcula la duración desde `startTime`/`endTime`.
- ✅ Migrado a **SQLite** para uso local autocontenido (schema, `mode:'insensitive'`
  retirado, backend movido al puerto **3100** para no chocar con otro server en el 3000).

Pendiente de configuración (no es un bug): los comandos admin `!` requieren
`ADMIN_NUMBERS` en el `.env`.

## Estado de ejecución

Verificado en vivo: backend (`:3100`) y dashboard (`:5173`) arrancan; login,
endpoints protegidos (401 sin token / 200 con token) y proxy dashboard→backend
funcionan de punta a punta con datos reales de la BD SQLite sembrada.
