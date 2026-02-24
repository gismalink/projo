#!/usr/bin/env bash
# Purpose: capture server-side metrics during a k6 load test run (GitOps-safe; no secrets).
# Usage:
#   ./scripts/loadtest/server-metrics-test.sh test
#   ./scripts/loadtest/server-metrics-test.sh test 1 300
#   ./scripts/loadtest/server-metrics-test.sh prod 1 300
# Args:
#   env: test|prod
#   interval_s: sampling interval seconds (default: 1)
#   duration_s: total duration seconds (default: 300)
set -euo pipefail

ENV_NAME="${1:-}"
INTERVAL_S="${2:-1}"
DURATION_S="${3:-300}"

if [[ "$ENV_NAME" != "test" && "$ENV_NAME" != "prod" ]]; then
  echo "usage: $0 <test|prod> [interval_s] [duration_s]" >&2
  exit 2
fi

if ! [[ "$INTERVAL_S" =~ ^[0-9]+$ ]] || ! [[ "$DURATION_S" =~ ^[0-9]+$ ]]; then
  echo "[error] interval_s and duration_s must be integers" >&2
  exit 2
fi

# Prefer Docker Desktop absolute path on macOS servers, fallback to PATH.
DOCKER="/Applications/Docker.app/Contents/Resources/bin/docker"
if [[ ! -x "$DOCKER" ]]; then
  DOCKER="docker"
fi

api="projo-api-${ENV_NAME}"
web="projo-web-${ENV_NAME}"
db="projo-db-${ENV_NAME}"

now_utc() {
  date -u +%Y%m%dT%H%M%SZ
}

ts="$(now_utc)"
OUT_DIR="/tmp/projo-loadtest-${ENV_NAME}-${ts}"
mkdir -p "$OUT_DIR"

echo "[metrics] env=$ENV_NAME interval=${INTERVAL_S}s duration=${DURATION_S}s"
echo "[metrics] out=$OUT_DIR"

# Best-effort: detect DB creds from container env.
get_db_env() {
  local key="$1"
  "$DOCKER" exec "$db" sh -lc "printenv $key" 2>/dev/null || true
}

DB_USER="$(get_db_env POSTGRES_USER)"
DB_NAME="$(get_db_env POSTGRES_DB)"

if [[ -z "$DB_USER" ]]; then
  DB_USER="projo_${ENV_NAME}"
fi
if [[ -z "$DB_NAME" ]]; then
  DB_NAME="projo_${ENV_NAME}"
fi

echo "[metrics] containers: api=$api web=$web db=$db" | tee "$OUT_DIR/meta.txt"
echo "[metrics] db: user=$DB_USER db=$DB_NAME" | tee -a "$OUT_DIR/meta.txt"

# Static snapshot.
{
  echo "== docker ps (filtered) =="
  "$DOCKER" ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | (head -n 1; egrep "^(NAMES|${api}|${web}|${db})\b" || true)
  echo
  echo "== docker inspect (restart, limits) =="
  for c in "$api" "$web" "$db"; do
    echo "-- $c"
    "$DOCKER" inspect --format '{{.Name}} restart={{.HostConfig.RestartPolicy.Name}} mem={{.HostConfig.Memory}} cpu={{.HostConfig.NanoCpus}}' "$c" 2>/dev/null || true
  done
} >"$OUT_DIR/snapshot.txt" 2>&1

# Live tails (best-effort).
# Note: using --since avoids dumping huge logs.
(
  "$DOCKER" logs --since 5m -f "$api" 2>/dev/null \
    | egrep -i 'error|exception|fatal|unhandled|ECONN|ENOTFOUND|timeout|too many|429|502|503' \
    || true
) >"$OUT_DIR/api-errors.log" 2>&1 &
LOG_PID=$!

cleanup() {
  if kill -0 "$LOG_PID" 2>/dev/null; then
    kill "$LOG_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Sampling loop.
end_at=$(( $(date +%s) + DURATION_S ))

while [[ $(date +%s) -lt $end_at ]]; do
  t="$(date -u +%FT%TZ)"

  {
    echo "# $t"
    echo "== docker stats (no-stream) =="
    "$DOCKER" stats --no-stream "$api" "$db" "$web" 2>/dev/null || "$DOCKER" stats --no-stream 2>/dev/null || true

    echo
    echo "== pg_stat_activity counts =="
    "$DOCKER" exec "$db" psql -U "$DB_USER" -d "$DB_NAME" -Atc "select count(*) as connections from pg_stat_activity;" 2>/dev/null || echo "psql: failed"

    "$DOCKER" exec "$db" psql -U "$DB_USER" -d "$DB_NAME" -Atc "select state || ':' || count(*) from pg_stat_activity group by 1 order by 2 desc;" 2>/dev/null || true

    echo
    echo "== longest running queries (top 5) =="
    "$DOCKER" exec "$db" psql -U "$DB_USER" -d "$DB_NAME" -Atc "select pid, extract(epoch from (now()-query_start))::int as dur_s, left(replace(query, E'\n',' '), 160) from pg_stat_activity where state<>'idle' order by (now()-query_start) desc limit 5;" 2>/dev/null || true

    echo
  } >>"$OUT_DIR/samples.log" 2>&1

  sleep "$INTERVAL_S"
done

echo "[metrics] done: $OUT_DIR"
