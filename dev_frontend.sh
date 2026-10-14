#!/usr/bin/env bash
# Local dev server for the portfolio frontend (static files, port 8080).
# Watches the Tailwind input and rebuilds CSS on change.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
    echo "==> installing npm deps"
    npm install
fi

echo "==> building CSS once"
npm run build:css

echo "==> starting tailwind watcher + static server"
echo "    site:        http://127.0.0.1:8080"
echo "    backend:     http://127.0.0.1:5050  (run scripts/dev_backend.sh in the backend repo)"
echo "    IMPORTANT:   set the urlstring in index.js and project.js to"
echo "                 http://127.0.0.1:5050 for local testing"
echo
trap 'kill 0' EXIT
npm run watch:css &
python3 -m http.server 8080
