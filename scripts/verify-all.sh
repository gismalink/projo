#!/usr/bin/env bash
set -euo pipefail

echo "[verify] lint"
npm run lint

echo "[verify] test"
npm run test

echo "[verify] build"
npm run build

echo "[verify] done"
