#!/usr/bin/env bash
set -euo pipefail

echo "[verify] lint"
npm run lint

echo "[verify] typecheck"
npm run typecheck

echo "[verify] test"
npm run test

echo "[verify] build"
npm run build

if [[ "${SMOKE_API:-0}" == "1" ]]; then
	echo "[verify] smoke api"
	npm run test:e2e:api
else
	echo "[verify] smoke api skipped (set SMOKE_API=1 to enable)"
fi

echo "[verify] done"
