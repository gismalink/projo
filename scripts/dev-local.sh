#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[dev-local] ensure postgres (docker compose)"
docker compose up -d

echo "[dev-local] install deps (skip if already installed)"
if [[ ! -d node_modules ]]; then
  npm install
fi

echo "[dev-local] prisma generate + migrate"
npm run prisma:generate -w @projo/api
npm run prisma:migrate -w @projo/api

echo "[dev-local] start api+web"
exec npm run dev:all
