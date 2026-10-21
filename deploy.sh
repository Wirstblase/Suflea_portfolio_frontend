#!/usr/bin/env bash
# Deploy the portfolio frontend to the Raspberry Pi webserver
# (/var/www/landingpage, served by nginx). Mirrors all static site files,
# excludes local dev-only files. Requires the 'raspberrypi' ssh alias and
# passwordless sudo for s00flea on the Pi.
set -euo pipefail
cd "$(dirname "$0")"

PI_HOST="${PI_HOST:-raspberrypi}"
REMOTE_DIR="/var/www/landingpage"

echo "==> writing prod apiBaseUrl (local config.js is restored after deploy)"
ORIGINAL_CONFIG="$(cat config.js)"
printf 'window.APP_CONFIG = { apiBaseUrl: "https://portfoliobackend.mariussuflea.com" };\n' > config.js
trap 'printf "%s\n" "$ORIGINAL_CONFIG" > config.js' EXIT

echo "==> syncing to ${PI_HOST}:${REMOTE_DIR}"
rsync -av --delete \
    --no-owner --no-group \
    --exclude '.git' \
    --exclude '.gitignore' \
    --exclude '.idea' \
    --exclude 'node_modules' \
    --exclude '.DS_Store' \
    --exclude 'deploy.sh' \
    --exclude 'dev_frontend.sh' \
    --exclude 'dev_proxy.py' \
    --rsync-path='sudo rsync' \
    ./ "${PI_HOST}:${REMOTE_DIR}/"

echo "==> verifying"
ssh "$PI_HOST" "curl -s -H 'Host: mariussuflea.com' http://localhost/ | md5sum"
md5 -q index.html
echo "done"
