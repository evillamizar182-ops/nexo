# ══════════════════════════════════════════════════════════════════
#  Nexo IA — Backend (Fastify + Prisma/PostgreSQL)
#  Imagen de producción, multi-stage. Los secretos NO van en la imagen:
#  se inyectan en runtime (docker run --env-file .env  /  compose env_file).
# ══════════════════════════════════════════════════════════════════

# ─── Stage 1: builder ──────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Instala TODAS las deps (incluye prisma CLI + typescript para compilar).
COPY package.json package-lock.json ./
RUN npm ci

# Copia el código y genera el cliente Prisma contra el schema de PRODUCCIÓN.
# DATABASE_URL dummy SOLO para `generate` (no conecta a la BD; el build no tiene
# acceso a la real). La conexión real se inyecta en runtime vía env_file.
COPY . .
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/db" \
      npx prisma generate --schema=prisma/schema.production.prisma \
 && npm run build

# ─── Stage 2: runner ───────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# tini = PID 1 correcto (reap de hijos + reenvío de SIGTERM => graceful shutdown).
# postgresql-client = pg_dump, que usa el comando admin !backup.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini postgresql-client \
 && rm -rf /var/lib/apt/lists/*

# Copia artefactos ya construidos desde el builder (incluye node_modules con el
# cliente Prisma ya generado y la CLI de prisma para el db push en runtime).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json package-lock.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Usuario sin privilegios + carpeta de backups escribible.
# sed => normaliza finales de línea CRLF (Windows) a LF, o `sh` no lo ejecuta.
RUN sed -i 's/\r$//' docker-entrypoint.sh \
 && chmod +x docker-entrypoint.sh \
 && useradd --system --uid 1001 --create-home nexo \
 && mkdir -p /app/backups \
 && chown -R nexo:nexo /app
USER nexo

# El puerto real lo fija la env PORT (por defecto 3100 en tu .env.production).
EXPOSE 3100

# Healthcheck contra /health (endpoint público, sin auth). Sin curl => usa node.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3100)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "./docker-entrypoint.sh"]
