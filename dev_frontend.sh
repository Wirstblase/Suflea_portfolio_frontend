#!/usr/bin/env bash
# Local dev server for the portfolio frontend (static files + backend proxy,
# port 8080). Serves the frontend and proxies /get_* requests to the local
# backend on 5050 (scripts/dev_backend.sh in the backend repo)
set -euo pipefail
cd "$(dirname "$0")"

echo "==> pointing frontend at same origin ('' = relative URLs, proxied to :5050)"
ORIGINAL_CONFIG="$(cat config.js)"
echo "window.APP_CONFIG = { apiBaseUrl: '' };" > config.js

if ! curl -s -o /dev/null --max-time 2 "http://127.0.0.1:5050/get_project_types?whatever=whatever"; then
    echo "WARN: backend not reachable on http://127.0.0.1:5050 make sure it's up" >&2
fi

echo "==> starting proxy server"
echo "    site:    http://localhost:8080"
echo "    backend: http://127.0.0.1:5050  (local dev backend, proxied)"
echo
trap 'printf "%s\n" "$ORIGINAL_CONFIG" > config.js; kill 0' EXIT
python3 dev_proxy.py "$(pwd)" http://127.0.0.1:5050 8080
