#!/usr/bin/env bash
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-"$ROOT/build/cpanel-artifact"}"

if [ -e "$OUT" ]; then
  echo "Refusing to overwrite existing artifact: $OUT" >&2
  exit 1
fi

PUBLIC="$OUT/public_html"
PRIVATE="$OUT/nichoir_private"

mkdir -p "$PUBLIC/app/vendor" "$PUBLIC/wasm/pkg"
mkdir -p "$PRIVATE/server-php/public" "$PRIVATE/server-php/src" "$PRIVATE/server-php/data" "$PRIVATE/server-php/migrations" "$PRIVATE/config" "$PRIVATE/logs"

cp "$ROOT/deployment/namecheap/public_html/index.php" "$PUBLIC/index.php"
cp "$ROOT/deployment/namecheap/public_html/.htaccess" "$PUBLIC/.htaccess"
cp "$ROOT/server-php/public/site.css" "$PUBLIC/site.css"

cp "$ROOT/app/index.html" "$PUBLIC/app/index.html"
cp "$ROOT/app/app.js" "$PUBLIC/app/app.js"
cp "$ROOT/app/style.css" "$PUBLIC/app/style.css"
cp "$ROOT/app/vendor/three.module.min.js" "$PUBLIC/app/vendor/three.module.min.js"

cp "$ROOT/wasm/pkg/wasm.js" "$PUBLIC/wasm/pkg/wasm.js"
cp "$ROOT/wasm/pkg/wasm_bg.wasm" "$PUBLIC/wasm/pkg/wasm_bg.wasm"

cp "$ROOT/server-php/public/index.php" "$PRIVATE/server-php/public/index.php"
cp -R "$ROOT/server-php/src/." "$PRIVATE/server-php/src/"
cp "$ROOT/server-php/data/README.md" "$PRIVATE/server-php/data/README.md"
cp -R "$ROOT/server-php/migrations/." "$PRIVATE/server-php/migrations/"
cp "$ROOT/deployment/namecheap/config/production.example.php" "$PRIVATE/config/production.example.php"

cat > "$OUT/README.txt" <<'EOF'
Namecheap/cPanel artifact.

Upload public_html/* into cPanel public_html.
Upload nichoir_private/ next to public_html, outside browser access.
Copy nichoir_private/config/production.example.php to production.php and fill private values.
The cPanel wrapper defaults to NICHOIR_ENV=production. Without a complete private MySQL production config, the app fails closed.
Do not upload repository root, docs, installation, Rust source, SQLite DB, logs, .git, or scripts to public_html.
EOF

echo "$OUT"
