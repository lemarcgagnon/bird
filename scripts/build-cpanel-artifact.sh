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
for php_file in "$ROOT"/server-php/src/*.php; do
  [ -e "$php_file" ] || continue
  cp "$php_file" "$PRIVATE/server-php/src/"
done
for migration in "$ROOT"/server-php/migrations/*.sql; do
  [ -e "$migration" ] || continue
  cp "$migration" "$PRIVATE/server-php/migrations/"
done
cp "$ROOT/deployment/namecheap/config/production.example.php" "$PRIVATE/config/production.example.php"

forbidden_files="$(
  find "$OUT" \
    \( \
      -iname 'README*' -o \
      -iname '*.md' -o \
      -path '*/docs/*' -o \
      -path '*/documentation/*' -o \
      -path '*/.git/*' -o \
      -path '*/.github/*' -o \
      -path '*/installation/*' -o \
      -path '*/scripts/*' -o \
      -path '*/tests/*' -o \
      -path '*/test/*' -o \
      -name '.env' -o \
      -name 'production.php' -o \
      -name 'db-config.php' -o \
      -name 'installed.lock.php' -o \
      -iname '*.sqlite' -o \
      -iname '*.db' -o \
      -iname '*.log' -o \
      -iname '*.tmp' -o \
      -iname '*.bak' -o \
      -iname '*.backup' -o \
      -iname '*audit*' -o \
      -iname '*context*' \
    \) \
    -print
)"

if [ -n "$forbidden_files" ]; then
  echo "Artifact contains forbidden documentation, dev, private config, or runtime-data files:" >&2
  echo "$forbidden_files" >&2
  exit 1
fi

sensitive_matches="$(
  grep -RInE 'sk_live_|sk_test_|rk_live_|rk_test_|whsec_|password123|demo@nichoir\.local|quick-login|demo[_ -]?login|dev[_ -]?login|https://cdnjs|cdnjs|cloudflare' "$OUT" || true
)"

if [ -n "$sensitive_matches" ]; then
  echo "Artifact contains forbidden sensitive, demo/dev, or CDN references:" >&2
  echo "$sensitive_matches" >&2
  exit 1
fi

echo "$OUT"
