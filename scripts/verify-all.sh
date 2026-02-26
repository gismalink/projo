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
	echo "[verify] smoke api (core gate)"
	npm run test:e2e:api:gate:core

	if [[ "${SMOKE_API_EXTENDED:-0}" == "1" ]]; then
		echo "[verify] smoke api (extended gate)"
		npm run test:e2e:api:gate:extended
	else
		echo "[verify] smoke api extended skipped (set SMOKE_API_EXTENDED=1 to enable)"
	fi
else
	echo "[verify] smoke api skipped (set SMOKE_API=1 to enable)"
fi

echo "[verify] done"
