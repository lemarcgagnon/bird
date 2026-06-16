# Namecheap/cPanel production packaging

Production target: PHP + MySQL/MariaDB + prebuilt WASM on a shared-host-friendly layout.

SQLite is local/development only. The cPanel artifact defaults to `NICHOIR_ENV=production`, requires `NICHOIR_DB_DRIVER=mysql`, and fails closed if production MySQL config is missing, invalid or incomplete. Runtime SQLite files, source modules, migrations, docs, installer and secrets must not be copied to `public_html`.

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
      vendor/
        three.module.min.js
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
      migrations/
      data/
        (empty at build time)
```

## Public files

Only browser-public files belong in `public_html`:

1. `index.php` wrapper from `deployment/namecheap/public_html/index.php`.
2. `.htaccess` from `deployment/namecheap/public_html/.htaccess`.
3. `server-php/public/site.css` copied to `public_html/site.css`.
4. Runtime `app/` files: `index.html`, `app.js`, `style.css` and local `vendor/three.module.min.js`.
5. Runtime WASM files: `wasm/pkg/wasm.js`, `wasm/pkg/wasm_bg.wasm`.

Do not copy `wasm/pkg/package.json` unless a runtime loader proves it is required. The current browser runtime does not require it.

## Private files

Keep outside `public_html`:

1. `server-php/public/index.php`.
2. `server-php/src/`.
3. Runtime migration SQL files in `server-php/migrations/`.
4. Empty `server-php/data/` and `logs/` directories for generated runtime files.
5. `config/production.php`.
6. `logs/`.

The public wrapper loads `nichoir_private/server-php/public/index.php`. It also sets `NICHOIR_CONFIG_FILE` to `nichoir_private/config/production.php` when that file exists.

The wrapper sets `NICHOIR_ENV=production` when no environment value exists. Without a complete private production config, `/api/health` must return `500` with `configuration_error`.

## Excluded from the artifact

Never copy these to the generated artifact:

1. `README*`, `*.md`, `docs/`, `documentation/` and internal notes.
2. `installation/`, `server/`, `server-php/scripts/`, tests and dev scripts.
3. Rust source/build files such as `wasm/src/` and `wasm/target/`.
4. `.git/`, `.github/`, `.codex/`, `.agents/`.
5. `.env`, real `production.php`, private config and secrets.
6. Database files, SQLite files, dumps, generated config locks, logs and archives.
7. Source maps if sensitive.

The build script copies PHP runtime files, SQL migration files, prebuilt browser assets, local Three.js and the safe production config example by allowlist. It fails the build if documentation, dev context, private config, database files, demo/dev login strings or CDN Three.js references appear in the artifact.

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
4. MySQL host, port, database, username, password and charset.
5. `NICHOIR_CORS_ORIGINS`.
6. `NICHOIR_LOG_HASH_SALT`.
7. `NICHOIR_STRIPE_WEBHOOK_SECRET` if Stripe is enabled.
8. `NICHOIR_STRIPE_SECRET_KEY` if Stripe live checkout is enabled.
9. `NICHOIR_SMTP_PASSWORD` if SMTP is enabled and the password is not stored in admin settings.

Canonical DB env/config names are `NICHOIR_DB_HOST`, `NICHOIR_DB_PORT`, `NICHOIR_DB_NAME`, `NICHOIR_DB_USER`, `NICHOIR_DB_PASSWORD` and `NICHOIR_DB_CHARSET`. The current production example uses accepted cPanel aliases: `NICHOIR_MYSQL_HOST`, `NICHOIR_MYSQL_PORT`, `NICHOIR_MYSQL_DATABASE`, `NICHOIR_MYSQL_USERNAME`, `NICHOIR_MYSQL_PASSWORD` and `NICHOIR_MYSQL_CHARSET`.

`NICHOIR_PUBLIC_BASE_URL` must be the canonical public origin, for example `https://example.com`. Stripe Checkout and portal return URLs use this configured value; they must not depend on request `Host` headers.

Must not be enabled in production:

1. `NICHOIR_DEBUG=1`.
2. `NICHOIR_ALLOW_UNSIGNED_STRIPE_WEBHOOKS=1`.
3. Public test credentials or demo login globals.

## Build a local artifact

```bash
scripts/build-cpanel-artifact.sh /tmp/nichoir-cpanel-artifact
```

The script creates:

```text
/tmp/nichoir-cpanel-artifact/public_html
/tmp/nichoir-cpanel-artifact/nichoir_private
```

The script refuses to overwrite an existing output directory. Review the artifact before upload.

## Runtime expectations

- Browser assets and the PHP wrapper share one public origin, so `app/app.js` should use same-origin API calls in production.
- Three.js is served from `public_html/app/vendor/three.module.min.js`; no CDN access is required at runtime.
- The production `.htaccess` blocks installer, docs, server source, private folders, SQLite/dump/log/archive files and Rust source paths.
- `installation/` is not part of the artifact and should not be uploaded.
- `server-php/data/db-config.php` and `installed.lock.php` are local/generated files, not source artifacts.
- Expected production health after private MySQL config is installed: `/api/health` returns `200` with `env=production`, `db=true` and `db_driver=mysql`.
- Expected production health before private config is installed: `/api/health` returns `500 configuration_error`.
