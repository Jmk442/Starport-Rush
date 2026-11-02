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
# Expo puts package assets (the Ionicons icon font) under assets/node_modules/, but .gitignore
# drops every node_modules/ folder, so the deployed site never got the font and served HTML
# instead. Move them to assets/vendor/ and repoint the bundle.
if [ -d assets/node_modules ]; then
  mv assets/node_modules assets/vendor
  grep -rl "assets/node_modules/" _expo index.html | xargs -r sed -i 's#assets/node_modules/#assets/vendor/#g'
fi
# Policy and support pages live with the backend (also served at /api/privacy and /api/support).
cp /app/backend/static/privacy.html privacy.html
cp /app/backend/static/support.html support.html
echo "Game web export copied into /app/frontend/public"
