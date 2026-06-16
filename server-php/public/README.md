# PHP public document root

This folder is the intended web document root for the PHP site.

## Files

- `index.php`: front controller. It includes backend modules, runs migrations, registers shutdown logging, emits security/CORS headers, dispatches public pages, handles contact POST, serves JSON APIs, handles Stripe webhook, and returns JSON 404 for unknown API paths.
- `site.css`: centralized CSS for PHP-rendered public pages, pricing/about/contact layouts, account tabs, admin dashboard, admin modals, tables, forms, responsive behavior, language switcher, and focus-visible states.
- `.htaccess`: Apache front-controller and deployment hardening when Apache serves this directory.

## Current routes owned by `index.php`

Pages:

- `GET /`
- `GET /pricing`
- `GET /about`
- `GET /contact`
- `POST /contact`
- `GET /terms`
- `GET /legal`
- `GET /account`
- `GET /admin`
- `POST /admin`

API/webhook:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/activate`
- `POST /api/auth/resend-activation`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/profile`
- `GET /api/credits/ledger`
- `GET /api/billing/summary`
- `POST /api/checkout/stripe-link`
- `POST /api/billing/portal`
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
- Do not place SQLite databases, DB configs, secrets, migrations, source modules, or install locks in this folder.
- API routes should return through `json_response()`.
- HTML pages should use `page_response()` from `src/layout.php` until the planned split moves page rendering out of `pages.php`.
- New shared visual styling should go in `site.css`, not inline page styles.
- Inline JavaScript currently lives in `pages.php`; the planned CSP cleanup should move it to `site.js` in this folder.

## Local server

```bash
php -S 127.0.0.1:8021 -t server-php/public
```
