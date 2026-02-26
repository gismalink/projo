#!/usr/bin/env bash
set -euo pipefail

ENV_NAME="${1:-prod}"

case "$ENV_NAME" in
  test)
    API_URL="https://test.projo.gismalink.art/api/health"
    WEB_URL="https://test.projo.gismalink.art"
    API_CONTAINER="projo-api-test"
    WEB_CONTAINER="projo-web-test"
    ;;
  prod)
    API_URL="https://projo.gismalink.art/api/health"
    WEB_URL="https://projo.gismalink.art"
    API_CONTAINER="projo-api-prod"
    WEB_CONTAINER="projo-web-prod"
    ;;
  *)
    echo "Usage: $0 [test|prod]" >&2
    exit 1
    ;;
esac

probe_count=5
tmp_latencies="$(mktemp)"
trap 'rm -f "$tmp_latencies"' EXIT

ok_count=0
for i in $(seq 1 "$probe_count"); do
  read -r status latency <<<"$(curl -sS -o /dev/null -w '%{http_code} %{time_total}' "$API_URL")"
  printf '%s\n' "$latency" >>"$tmp_latencies"
  if [[ "$status" == "200" ]]; then
    ok_count=$((ok_count + 1))
  fi
  printf '[obs] probe %s: status=%s latency=%ss\n' "$i" "$status" "$latency"
  sleep 1
done

p95_latency="$(sort -n "$tmp_latencies" | tail -n 1)"

echo "[obs] api_health_ok=$ok_count/$probe_count"
echo "[obs] api_health_p95=${p95_latency}s"

echo "[obs] web_head_status="
curl -I -sS "$WEB_URL" | head -n 1

echo "[obs] containers="
docker ps --format '{{.Names}}\t{{.Status}}' | grep -E "^(${API_CONTAINER}|${WEB_CONTAINER})\b" || true

echo "[obs] api_log_tail="
docker logs --tail=200 "$API_CONTAINER" | tail -n 120 || true

echo "[obs] web_log_tail="
docker logs --tail=200 "$WEB_CONTAINER" | tail -n 120 || true

health_failed=$((probe_count - ok_count))

if [[ "$health_failed" -gt 0 ]]; then
  echo "[obs] ALERT: health check failures detected ($health_failed/$probe_count)" >&2
  exit 10
fi

# Baseline threshold (operational, non-load): p95 should stay <= 1.50s.
awk -v p95="$p95_latency" 'BEGIN { if ((p95 + 0) > 1.50) { exit 1 } }' || {
  echo "[obs] ALERT: p95 latency above baseline (${p95_latency}s > 1.50s)" >&2
  exit 11
}

echo "[obs] status=pass"
