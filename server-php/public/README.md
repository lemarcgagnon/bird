# PHP public document root

This folder is the intended web document root for the PHP site during local PHP-server use and simple deployments. The validated Namecheap/cPanel artifact uses `deployment/namecheap/public_html/index.php` as the public wrapper and keeps this front controller under `nichoir_private/server-php/public/`.

## Files

- `index.php`: front controller. It includes backend modules, runs migrations, registers shutdown logging, emits security/CORS headers, dispatches public pages, handles contact POST, serves JSON APIs, handles Stripe webhook, guards admin routes and returns JSON 404 for unknown API paths.
- `site.css`: shared CSS for PHP-rendered public pages, pricing/about/contact layouts, account tabs, admin dashboard, admin modals, tables, forms, language switcher, responsive behavior and focus-visible states.
- `.htaccess`: Apache front-controller and hardening rules when Apache serves this directory.
- `assets/bird-chirp.mp3`: mp3 asset used for first-visit welcome sound.

## Routes owned by `index.php`

Pages:

- `GET /`
- `GET /pricing`
- `GET /about`
- `GET /contact`
- `POST /contact`
- `GET /terms`
- `GET /legal`
- `GET /account`
- `GET /assets/bird-chirp.mp3`
- `GET {NICHOIR_ADMIN_PATH}/login`
- `POST {NICHOIR_ADMIN_PATH}/login`
- `POST {NICHOIR_ADMIN_PATH}/logout`
- `GET {NICHOIR_ADMIN_PATH}`
- `POST {NICHOIR_ADMIN_PATH}`
- `GET {NICHOIR_ADMIN_PATH}/exports/download`

`NICHOIR_ADMIN_PATH` defaults to `/gestion-nichoir`. The obvious paths `/admin` and `/administration` are reserved/interdicted and should not serve the back-office.

Public pages must not expose the configured admin path in rendered HTML or JavaScript. Shared layout scripts should receive the real admin path only while rendering admin pages.

API/webhook:

- `GET /api/health`
- `GET /api/admin/session`
- `POST /api/auth/register`
- `POST /api/auth/activate`
- `POST /api/auth/resend-activation`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/profile`
- `GET /api/credits/ledger`
- `GET /api/billing/summary`
- `GET /api/apps`
- `POST /api/checkout/stripe-link`
- `POST /api/billing/portal`
- `POST /api/exports/quote`
- `POST /api/exports/authorize`
- `POST /api/exports/consume`
- `GET /api/tickets`
- `POST /api/tickets`
- `GET /api/tickets/{id}`
- `POST /api/tickets/{id}/messages`
- `POST /api/tickets/{id}/status`
- `POST /api/client-log`
- `POST /stripe/webhook`

## Rules

- Keep only public assets and the front controller here.
- Do not place SQLite databases, DB configs, secrets, migrations, source modules, install locks, dumps or logs in this folder.
- In production, `/api/health` should report `env=production` and `db_driver=mysql`; `db_driver=sqlite` is a failed production configuration.
- `GET /api/admin/session` should return only the current admin-session boolean used by the static app for admin-only diagnostics and zero-cost admin export access.
- Export quote/authorize/consume routes must support both client credit-backed authorizations and admin session-backed zero-cost authorizations. Admin tokens stay in PHP session, expire, and are consumed once.
- `GET /assets/bird-chirp.mp3` is handled in `index.php` and should be returned as `audio/mpeg`.
- API routes should return through `json_response()`.
- HTML pages should use `page_response()` from `src/layout.php`.
- New shared visual styling should go in `site.css`, not page-local inline styles.
- Inline JavaScript currently lives in `src/layout.php`, `src/account_pages.php` and `src/admin_pages.php`; CSP cleanup should move it to `site.js` in this folder.

## Local server

```bash
php -d upload_max_filesize=25M -d post_max_size=64M -S 127.0.0.1:8021 -t server-php/public
```

Local quick links:

- `http://127.0.0.1:8021/`
- `http://127.0.0.1:8021/library`
- `http://127.0.0.1:8021/gestion-nichoir/login`
- `http://127.0.0.1:8021/gestion-nichoir#admin-library`
