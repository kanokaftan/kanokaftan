#!/usr/bin/env bash
# Creates a reel project folder with everything a template needs:
# fonts (incl. latin-ext for Hausa ɗ ƙ ɓ and ₦), local GSAP (the CDN is blocked), logos, sound effects.
#   bash new_project.sh /home/user/kanokaftan-ad/<name> shop-advert|referral-reel
set -euo pipefail
DIR="$1"; TEMPLATE="${2:-shop-advert}"
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$SKILL/../../.." && pwd)"
F="$REPO/node_modules/@fontsource"
mkdir -p "$DIR/assets" "$DIR/renders"

[ -d "$F/inter" ] || (cd "$REPO" && npm ci --silent)
for w in 400 500 600 700 800 900; do
  cp "$F/inter/files/inter-latin-$w-normal.woff2" "$F/inter/files/inter-latin-ext-$w-normal.woff2" "$DIR/assets/"
done
for v in 600-normal 700-italic; do
  cp "$F/playfair-display/files/playfair-display-latin-$v.woff2" "$F/playfair-display/files/playfair-display-latin-ext-$v.woff2" "$DIR/assets/"
done
cp "$REPO/public/logo.svg" "$REPO/public/logo-dark.svg" "$DIR/assets/"

if [ ! -f "$DIR/assets/gsap.min.js" ]; then
  TMP=$(mktemp -d); (cd "$TMP" && npm init -y >/dev/null && npm i gsap@3.14.2 --silent >/dev/null)
  cp "$TMP/node_modules/gsap/dist/gsap.min.js" "$DIR/assets/"; rm -rf "$TMP"
fi

mkdir -p "$DIR/assets/sfx"
python3 -I "$SKILL/scripts/make_sfx.py" "$DIR/assets/sfx"

cp "$SKILL/templates/$TEMPLATE.html" "$DIR/template.html"
cat > "$DIR/hyperframes.json" <<'JSON'
{
  "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
  "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  "paths": { "blocks": "compositions", "components": "compositions/components", "assets": "assets" },
  "media": { "autoProxy": true }
}
JSON
echo "project ready: $DIR (edit template.html, then copy it to index.html)"
echo "keep template.html OUT of the render: move it to a backups folder before 'hyperframes lint/render' (two root compositions = lint error)"
