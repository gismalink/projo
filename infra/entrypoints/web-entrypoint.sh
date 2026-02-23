#!/usr/bin/env sh
set -e

cd /app/apps/web

# Vite preview serves the built dist/ output.
exec node /app/node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port 4173
