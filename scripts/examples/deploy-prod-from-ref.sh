#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <git-ref> [repo-dir]" >&2
  echo "Example: $0 origin/master ~/projo" >&2
  exit 1
fi

GIT_REF="$1"
REPO_DIR="${2:-$HOME/projo}"
COMPOSE_FILE="infra/docker-compose.host.yml"
ENV_FILE="infra/.env.host"

cd "$REPO_DIR"

echo "[deploy-prod] repo: $REPO_DIR"
echo "[deploy-prod] fetch ref: $GIT_REF"
git fetch --all --tags --prune

RESOLVED_SHA="$(git rev-parse "$GIT_REF")"
echo "[deploy-prod] resolved sha: $RESOLVED_SHA"

git checkout --detach "$RESOLVED_SHA"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[deploy-prod] missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[deploy-prod] missing env file: $ENV_FILE" >&2
  exit 1
fi

echo "[deploy-prod] recreate prod services"
TMP_DOCKER_CONFIG="$(mktemp -d)"
trap 'rm -rf "$TMP_DOCKER_CONFIG"' EXIT
printf '{}' >"$TMP_DOCKER_CONFIG/config.json"
DOCKER_CONFIG="$TMP_DOCKER_CONFIG" DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build projo-api-prod projo-web-prod
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate projo-api-prod projo-web-prod

echo "[deploy-prod] wait api health"
for i in {1..180}; do
  if curl -fsS https://projo.gismalink.art/api/health >/dev/null; then
    echo "[deploy-prod] api health ok"
    break
  fi

  if [[ "$i" -eq 180 ]]; then
    echo "[deploy-prod] api health check failed" >&2
    exit 1
  fi

  sleep 2
done

echo "[deploy-prod] prod deploy complete for $RESOLVED_SHA"
