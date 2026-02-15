#!/usr/bin/env bash
set -euo pipefail

echo "[verify] lint"
npm run lint

echo "[verify] test"
npm run test

echo "[verify] build"
npm run build

if [[ "${SMOKE_API:-0}" == "1" ]]; then
	echo "[verify] smoke api"
	node ./scripts/smoke-api.mjs
else
	echo "[verify] smoke api skipped (set SMOKE_API=1 to enable)"
fi

echo "[verify] done"
