# Namecheap/cPanel production packaging

## Production target

Production target is PHP + MySQL + prebuilt WASM.

SQLite is local/dev only unless explicitly selected later. Runtime SQLite files must not be copied to `public_html`.

## Layout

```text
/home/USERNAME/
  public_html/
    index.php
    .htaccess
    site.css
    app/
      index.html
      app.js
      style.css
    wasm/
      pkg/
        wasm.js
        wasm_bg.wasm

  nichoir_private/
    config/
      production.php
    logs/
    server-php/
      public/
        index.php
      src/
      data/
        README.md
```

## Public files

Only browser-public files belong in `public_html`:

1. `index.php` wrapper from `deployment/namecheap/public_html/index.php`.
2. `.htaccess` from `deployment/namecheap/public_html/.htaccess`.
3. `server-php/public/site.css` copied to `public_html/site.css`.
4. Runtime `app/` files: `index.html`, `app.js`, `style.css`.
5. Runtime WASM files: `wasm/pkg/wasm.js`, `wasm/pkg/wasm_bg.wasm`.

Do not copy `wasm/pkg/package.json` unless a runtime loader proves it is required. The current browser runtime does not require it.

## Private files

Keep outside `public_html`:

1. `server-php/public/index.php`.
2. `server-php/src/`.
3. `server-php/data/README.md`.
4. `config/production.php`.
5. `logs/`.

`server-php/migrations/` stays in the private artifact only. Production MySQL schema creation is handled by the PHP runtime schema path in `ensure_mysql_schema()`, but the migration file is still needed for the SQLite/dev fallback and local staged artifact smoke tests. It must never be copied to `public_html`.

## Excluded from public artifact

Never copy these to `public_html`:

1. `installation/`.
2. `docs/`.
3. `server/`.
4. `server-php/src/`.
5. `server-php/data/`.
6. `server-php/migrations/`.
7. `server-php/scripts/`.
8. `wasm/src/`.
9. `wasm/target/`.
10. Rust source/build files.
11. `.git/`, `.codex/`, `.agents/`.
12. `.env` and config/secrets.
13. Database files.
14. Logs/backups/archives.
15. Test and local development files.
16. Source maps if sensitive.

## Private config

Prefer real cPanel environment variables when reliable. If unavailable, copy `deployment/namecheap/config/production.example.php` to:

```text
/home/USERNAME/nichoir_private/config/production.php
```

The app reads environment variables first and this private config file second.

Required production values:

1. `NICHOIR_PUBLIC_BASE_URL`.
2. `NICHOIR_ADMIN_PASSWORD_HASH`.
3. `NICHOIR_DB_DRIVER=mysql`.
4. `NICHOIR_MYSQL_HOST`.
5. `NICHOIR_MYSQL_DATABASE`.
6. `NICHOIR_MYSQL_USERNAME`.
7. `NICHOIR_MYSQL_PASSWORD`.
8. `NICHOIR_MYSQL_CHARSET=utf8mb4`.
9. `NICHOIR_LOG_HASH_SALT`.
10. `NICHOIR_STRIPE_WEBHOOK_SECRET` if Stripe is enabled.
11. `NICHOIR_STRIPE_SECRET_KEY` if Stripe live checkout is enabled.

`NICHOIR_PUBLIC_BASE_URL` must be the canonical public origin, for example `https://example.com`. Stripe Checkout and portal return URLs use this configured value; they must not depend on request `Host` headers.

Must not be enabled in production:

1. `NICHOIR_DEBUG=1`.
2. `NICHOIR_ALLOW_UNSIGNED_STRIPE_WEBHOOKS=1`.
3. Demo account globals.

## Build a local artifact

```bash
scripts/build-cpanel-artifact.sh /tmp/nichoir-cpanel-artifact
```

The script creates:

```text
/tmp/nichoir-cpanel-artifact/public_html
/tmp/nichoir-cpanel-artifact/nichoir_private
```

Review the artifact before upload.
