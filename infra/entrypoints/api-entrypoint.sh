#!/usr/bin/env sh
set -e

# Expect DATABASE_URL to be provided via env_file.
# Run migrations on container start (safe for deploy) then start compiled NestJS app.

cd /app

# Prisma CLI is used for migrate deploy.
# shellcheck disable=SC2091
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

exec node apps/api/dist/main.js
