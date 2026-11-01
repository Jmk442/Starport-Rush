#!/usr/bin/env bash
# Rebuilds the Starport Rush web game (Expo web export of /app/mobile) into this
# frontend's public/ folder, which the deployed site serves. Run after game changes:
#   bash /app/frontend/scripts/build-game.sh
# EXPO_PUBLIC_BACKEND_URL is left empty so the game calls the same-origin /api backend.
set -euo pipefail
OUT=$(mktemp -d)
cd /app/mobile
EXPO_PUBLIC_BACKEND_URL="" npx expo export --platform web --output-dir "$OUT"
cd /app/frontend/public
rm -rf _expo assets
cp -r "$OUT/_expo" "$OUT/assets" "$OUT/favicon.ico" .
cp "$OUT/index.html" index.html
# Policy lives with the backend (also served at /api/privacy); publish it at /privacy.html too.
cp /app/backend/static/privacy.html privacy.html
echo "Game web export copied into /app/frontend/public"
