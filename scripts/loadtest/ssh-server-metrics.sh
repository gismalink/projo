#!/usr/bin/env bash
# Purpose: run server-metrics-test.sh over SSH from local machine.
# Usage:
#   bash ./scripts/loadtest/ssh-server-metrics.sh test
#   SSH_HOST=mac-mini bash ./scripts/loadtest/ssh-server-metrics.sh test 1 300
set -euo pipefail

ENV_NAME="${1:-}"
INTERVAL_S="${2:-1}"
DURATION_S="${3:-300}"
SSH_HOST="${SSH_HOST:-mac-mini}"
REMOTE_DIR="${REMOTE_DIR:-~/srv/projo}"

if [[ "$ENV_NAME" != "test" && "$ENV_NAME" != "prod" ]]; then
  echo "usage: $0 <test|prod> [interval_s] [duration_s]" >&2
  exit 2
fi

echo "[ssh-metrics] host=$SSH_HOST env=$ENV_NAME interval=${INTERVAL_S}s duration=${DURATION_S}s"
ssh "$SSH_HOST" "cd $REMOTE_DIR && bash ./scripts/loadtest/server-metrics-test.sh '$ENV_NAME' '$INTERVAL_S' '$DURATION_S'"
