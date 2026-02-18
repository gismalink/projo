#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <git-ref> [repo-dir]"
  echo "Example: $0 origin/master ~/projo"
  exit 1
fi

GIT_REF="$1"
REPO_DIR="${2:-$HOME/projo}"
COMPOSE_FILE="infra/docker-compose.host.yml"
ENV_FILE="infra/.env.host"

cd "$REPO_DIR"

echo "[deploy-test] repo: $REPO_DIR"
echo "[deploy-test] fetch ref: $GIT_REF"
git fetch --all --tags --prune

RESOLVED_SHA="$(git rev-parse "$GIT_REF")"
echo "[deploy-test] resolved sha: $RESOLVED_SHA"

git checkout --detach "$RESOLVED_SHA"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[deploy-test] missing compose file: $COMPOSE_FILE"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[deploy-test] missing env file: $ENV_FILE"
  exit 1
fi

echo "[deploy-test] recreate test services"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate projo-api-test projo-web-test

echo "[deploy-test] wait api health"
for i in {1..30}; do
  if curl -fsS https://test.projo.gismalink.art/api/health >/dev/null; then
    echo "[deploy-test] api health ok"
    break
  fi

  if [[ "$i" -eq 30 ]]; then
    echo "[deploy-test] api health check failed"
    exit 1
  fi

  sleep 2
done

echo "[deploy-test] test deploy complete for $RESOLVED_SHA"
