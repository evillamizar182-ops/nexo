#!/bin/sh
set -e

# Sincroniza el esquema con la base (solo si se pide explícitamente).
# Este proyecto no usa migraciones => se usa `prisma db push`. Idempotente.
# Actívalo la primera vez / tras cambios de esquema:  RUN_DB_PUSH=true
if [ "$RUN_DB_PUSH" = "true" ]; then
  echo "[entrypoint] Sincronizando esquema con la base (prisma db push)..."
  ./node_modules/.bin/prisma db push \
    --schema=prisma/schema.production.prisma \
    --skip-generate
fi

echo "[entrypoint] Iniciando Nexo IA backend..."
# exec => el server hereda PID de tini y recibe SIGTERM para el graceful shutdown.
exec node dist/server.js
