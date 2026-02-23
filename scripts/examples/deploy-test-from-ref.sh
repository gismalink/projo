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
TMP_DOCKER_CONFIG="$(mktemp -d)"
trap 'rm -rf "$TMP_DOCKER_CONFIG"' EXIT

# On macOS (Docker Desktop), docker auth can be delegated to Keychain, which is
# not available in non-interactive SSH sessions. Use a temp docker config without
# credsStore, but keep the compose plugin available by copying cli-plugins.
mkdir -p "$TMP_DOCKER_CONFIG/cli-plugins"
if [[ -d "$HOME/.docker/cli-plugins" ]]; then
  cp -R "$HOME/.docker/cli-plugins/." "$TMP_DOCKER_CONFIG/cli-plugins/"
fi
printf '{}' >"$TMP_DOCKER_CONFIG/config.json"

DOCKER_CONFIG="$TMP_DOCKER_CONFIG" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build projo-api-test projo-web-test
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate projo-api-test projo-web-test

echo "[deploy-test] wait api health"
for i in {1..180}; do
  if curl -fsS https://test.projo.gismalink.art/api/health >/dev/null; then
    echo "[deploy-test] api health ok"
    break
  fi

  if [[ "$i" -eq 180 ]]; then
    echo "[deploy-test] api health check failed"
    exit 1
  fi

  sleep 2
done

echo "[deploy-test] test deploy complete for $RESOLVED_SHA"
