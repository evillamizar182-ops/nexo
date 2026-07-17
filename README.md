# NEXO IA v2.0 — Senior Enterprise Edition

Este es el backend de producción reconstruido en TypeScript para Nexo IA.

## Estructura del Proyecto

```
nexo-ia/
├── dashboard/          # Frontend React + Vite
├── prisma/             # Schema y migraciones de PostgreSQL
└── src/
    ├── ai/             # Prompts y Herramientas (Tools)
    ├── config/         # Validación de env con Zod
    ├── routes/         # Auth, Dashboard, Webhook
    ├── services/       # Lógica de negocio, Buffer, WhatsApp
    ├── utils/          # Crypto, Sanitizer, Redis, Circuit Breaker
    └── server.ts       # Punto de entrada Fastify
```

## Uso rápido (local, sin servicios externos)

La configuración local usa **SQLite** (autocontenida) — no necesitas Supabase ni
Docker. Con `USE_MOCKS=true` la IA responde en modo simulado.

**Arranque en un clic:** ejecuta `NEXO_TODO_EN_UNO.bat` (en la carpeta padre).
Levanta backend + dashboard y abre el panel en http://localhost:5173.

- **Backend:** http://localhost:3100  (puerto configurable con `PORT` en `.env`)
- **Dashboard:** http://localhost:5173  (proxy `/api` → backend)
- **Login:** las credenciales están en `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

### Puesta en marcha manual (primera vez)

```bash
cd Produccion
npm install
npx prisma db push        # crea el esquema en prisma/dev.db (SQLite)
npm run seed              # crea admin + datos demo (lee ADMIN_* del .env)
npm run dev               # backend en :3100

cd dashboard
npm install
npm run dev               # dashboard en :5173
```

### Producción (PostgreSQL / Supabase)

El proyecto viene **preparado para producción** con un schema Postgres dedicado
(`prisma/schema.production.prisma`) — no tienes que editar el schema local.

**En un clic:**
1. Copia `.env.production.example` → `.env` y rellena `DATABASE_URL` (Postgres),
   secretos fuertes, y claves reales de Anthropic/Meta (`USE_MOCKS=false`).
2. Ejecuta `INSTALL_PRODUCCION.bat` (instala, genera cliente PG, crea el esquema,
   siembra y compila).
3. Ejecuta `START_PRODUCCION.bat`.

**Manual (equivalente):**
```bash
cd Produccion
npm install && (cd dashboard && npm install)
npm run prisma:generate:prod     # cliente Prisma para PostgreSQL
npm run db:push:prod             # crea el esquema (o: npm run prisma:migrate:prod)
npm run seed                     # admin + datos base (lee ADMIN_* del .env)
npm run build                    # compila backend -> dist/server.js
npm start                        # backend en :3100
cd dashboard && npm run build && npm run preview   # dashboard en :5173
```

> **Local ↔ Producción**: el cliente Prisma se genera en una única ubicación, así
> que al cambiar de motor hay que regenerarlo. Los lanzadores ya lo hacen solos:
> `NEXO_TODO_EN_UNO.bat` regenera el de SQLite; `START_PRODUCCION.bat` el de Postgres.
> Manualmente: `npm run prisma:generate` (local) / `npm run prisma:generate:prod` (prod).

> **Seguridad**: consulta `SECURITY.md`. Antes de reusar Supabase, **rota la
> contraseña** que estuvo expuesta.

## Características Clave

- **Seguridad**: Validación HMAC de Meta, protección contra Prompt Injection, timing-safe crypto.
- **Resiliencia**: Circuit Breaker para Anthropic, reintentos automáticos para WhatsApp.
- **Eficiencia**: Agrupamiento (buffering) de mensajes de WhatsApp por ráfagas.
- **Finanzas**: Panel de métricas en tiempo real con proyecciones de ingresos.
- **Templates**: Gestión de plantillas oficiales de Meta (HSM) desde el dashboard.
- **Tools**: El bot puede consultar disponibilidad y agendar citas directamente en la DB.

## 🚀 v15.1 Enterprise Features

Esta versión integra las capacidades operativas avanzadas de la v14 en el núcleo de alto rendimiento de la v15:

*   **Omnicanalidad & Audio**: Soporte nativo para notas de voz (transcripción automática).
*   **Vision ERP**: Gestión de inventario mediante inteligencia artificial. Registra ventas simplemente enviando una foto con el texto "vendida".
*   **Control de Admin Pro**: Nuevo sistema de comandos `!` desde WhatsApp para control total del bot, cierres de caja y muteo de clientes.
*   **Arquitectura de Resiliencia**: Circuit Breakers granulares para cada API externa, asegurando que el sistema nunca se caiga por fallos externos.
*   **Finanzas Automatizadas**: Cálculo de comisiones por barbero y generación de reportes de cierre diario automáticos.
*   **Seguridad y Backups**: Rate limiting específico para login y sistema de backups locales automáticos en caliente.

Para más detalles, consulta la carpeta [/docs](./docs).

---

© 2026 Nexo Intelligence. Todos los derechos reservados.
