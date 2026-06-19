# Nichoir PHP backend and site

`server-php/` is the active backend and PHP-rendered site. It serves public pages, account, admin, contact, JSON API and Stripe webhook from one front controller. SQLite is the local/development default; MySQL/MariaDB is mandatory for the Namecheap/cPanel production artifact.

The Rust/WASM app stays under `/app/` and generates geometry and fabrication files locally. PHP authorizes and debits billed downloads but does not receive heavy geometry payloads.

## Structure

- `public/`: intended PHP document root with front controller, `.htaccess` and shared CSS. See `public/README.md`.
- `src/`: procedural modules for DB, auth, pages, admin, account, credits, mail, Stripe, logging and responses. See `src/README.md`.
- `migrations/`: SQLite migration baseline. MySQL schema is created by `ensure_mysql_schema()` in `src/db.php`. See `migrations/README.md`.
- `data/`: local SQLite database and local generated config/lock files, all outside the public web root. These are development/local artifacts only. See `data/README.md`.
- `scripts/`: local utilities, currently demo dataset seeding. See `scripts/README.md`.

## Local server

```bash
cd /home/marc/Documents/nichoir16
php -S 127.0.0.1:8021 -t server-php/public
```

Useful pages:

- `http://127.0.0.1:8021/`
- `http://127.0.0.1:8021/pricing`
- `http://127.0.0.1:8021/account`
- `http://127.0.0.1:8021/gestion-nichoir/login` unless `NICHOIR_ADMIN_PATH` is configured differently.

When the static WASM app runs separately on `8016`, open it with:

```text
http://127.0.0.1:8016/app/
```

The app auto-detects this local split-port setup and sends API calls to `127.0.0.1:8021`. The `php_base` query parameter remains available for local-only override tests.

## Current routes

Pages and admin:

- `GET /`
- `GET /pricing`
- `GET /about`
- `GET /contact`
- `POST /contact`
- `GET /terms`
- `GET /legal`
- `GET /account`
- `GET {NICHOIR_ADMIN_PATH}/login`
- `POST {NICHOIR_ADMIN_PATH}/login`
- `POST {NICHOIR_ADMIN_PATH}/logout`
- `GET {NICHOIR_ADMIN_PATH}`
- `POST {NICHOIR_ADMIN_PATH}`
- `GET {NICHOIR_ADMIN_PATH}/exports/download`

API and webhook:

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
- `GET /api/library`
- `GET /api/library/thumbnail`
- `GET /api/library/preview`
- `GET /api/library/stl-preview`
- `POST /api/library/authorize`
- `GET /api/library/download`
- `GET /api/tickets`
- `POST /api/tickets`
- `GET /api/tickets/{id}`
- `POST /api/tickets/{id}/messages`
- `POST /api/tickets/{id}/status`
- `POST /api/client-log`
- `POST /stripe/webhook`

## Current behavior

- Public pages are bilingual and use `?lang`, then cookie, then `Accept-Language`.
- Admin pages are intentionally French-only.
- `/account` manages login/register/logout, activation codes, profile edits, credits, ledger, billing summary, Stripe checkout/portal, invoices/payments, tickets, ticket messages and open/closed status.
- Account auth now uses the HttpOnly SameSite `nichoir_account_session` cookie. Current browser code clears the legacy `nichoir-auth-token` local-storage key and uses credentialed same-origin requests.
- `{NICHOIR_ADMIN_PATH}` manages users, profiles, passwords, credits, statuses, manual subscriptions, support tickets, logs, database export, DB settings, Stripe settings, SMTP settings and test email.
- `{NICHOIR_ADMIN_PATH}/login` uses `NICHOIR_ADMIN_PASSWORD_HASH`, PHP session cookies, `password_verify()` and `session_regenerate_id(true)`.
- `/api/admin/session` returns whether the current PHP session is admin-authenticated so the static app can reveal admin-only diagnostics without exposing the configured admin path.
- The same admin session can authorize premium WASM downloads without client credits. Export quote/authorize/consume still run, but they return `admin=true`, `cost=0`, store the authorization in `$_SESSION`, consume it once, and do not write `credit_ledger`.
- `NICHOIR_ADMIN_PATH` defaults to `/gestion-nichoir`; `/admin` and `/administration` are reserved/interdicted and must not expose the back-office.
- Public responses must not inject the configured admin path into shared HTML/JavaScript; only admin responses may render it.
- Admin POST actions use CSRF tokens and write audit/app logs for important changes.
- Contact POST keeps CSRF, honeypot, IP rate limit, length checks, SMTP handoff, logging and flash redirects.
- Auth endpoints have IP/email rate limits, email activation quotas and cleanup for stale pending accounts.
- JSON payloads are limited to 256 KiB in `src/response.php`.
- CORS is restricted by `NICHOIR_CORS_ORIGINS`, defaulting to `http://127.0.0.1:8016` for local dev.
- `/api/client-log` is rate-limited to 10 logs/minute per user or IP and should not receive geometry or form payloads.
- `/api/health` reports `env` and `db_driver`. In production it must never return `db_driver=sqlite`.

## Credits, exports and library

- Valid server-billed export type identifiers are `svg`, `png`, `pdf`, `stl` and `zip`.
- `server-php/src/credits.php` owns the WASM app registry, configured export cost and partial-credit bonus policy.
- `/api/apps` returns the server-known WASM apps. The current app id is `nichoir`.
- `/api/exports/quote` checks `app_id`, export type and, for clients, current balance plus optional partial-balance bonus without creating a token or debiting credits. Admin sessions get `cost=0`.
- `/api/exports/authorize` checks `app_id`, export type and, for clients, active account status/current balance/bonus eligibility, then creates a short-lived token. Client tokens are stored in `export_authorizations`; admin tokens are stored in PHP session.
- `/api/exports/consume` revalidates the account or admin session and `app_id`, atomically claims the authorization, applies any configured client top-up, debits client credits, writes `credit_ledger`, and logs/audits the event. Admin consumption is one-shot, logged, and does not debit or create ledger rows.
- The browser generates the actual file locally after authorization. PHP never generates STL, PDF, ZIP or mesh data.
- The current app only bills house STL and plan-section SVG/PNG/PDF exports. Door STL, wall-mount STL, panels ZIP, calculations PDF and diagnostic exports are local/free unless the browser wiring is intentionally changed.
- `/library` is the public decor file library. Clients download a server-hosted STL or image to their computer, then import it manually into the WASM decoration uploader.
- `/api/library` returns active file metadata and a PNG thumbnail URL. `/api/library/thumbnail` returns a public low-resolution PNG preview without serving the source STL/image file. `/api/library/stl-preview` returns a lightweight sampled STL preview JSON for admin/debug rendering. `/api/library/authorize` checks the active account and current credit balance, then creates a short-lived token. `/api/library/download` claims that token, debits client credits, writes `credit_ledger` with reason `library_download`, records `library_downloads`, then streams the private file.
- Admins manage library STL/image files from the back-office Librairie tab, including title, description, credit cost, active/inactive state and permanent deletion. STL uploads are capped by the admin `library_stl_upload_max_mb` setting up to 25 MiB, images are capped at 2 MiB, and files are stored in `server-php/data/library`, outside `public_html`. Admin sessions can preview images through `/api/library/preview` and authorize/download library files at cost zero through one-shot PHP-session tokens.
- Browser console prefixes: `[nichoir library admin]` for back-office file selection, upload submit and STL preview loading; `[nichoir library user]` for public library loading, STL preview, authorization and download redirect.

## Stripe

- `POST /api/checkout/stripe-link` creates a real Stripe Checkout session when Stripe is configured.
- `POST /api/billing/portal` creates a Stripe customer portal session.
- `/stripe/webhook` verifies `Stripe-Signature` when `NICHOIR_STRIPE_WEBHOOK_SECRET` is configured.
- Webhooks are stored/idempotent in `stripe_events`, failed events can be retried, and terminal duplicate events are ignored safely.
- Unsigned webhooks are acceptable only for local/development. `NICHOIR_ALLOW_UNSIGNED_STRIPE_WEBHOOKS=1` is rejected when `NICHOIR_ENV=production`.

Prefer production secrets from environment variables or private config:

- `NICHOIR_STRIPE_SECRET_KEY`
- `NICHOIR_STRIPE_WEBHOOK_SECRET`
- `NICHOIR_SMTP_PASSWORD`

If env/private config is absent, admin settings can store Stripe/SMTP values for simple local/shared-host testing.

## Database and config

Resolution order:

1. Defaults from `src/db.php` use SQLite at `server-php/data/nichoir.sqlite` for local/development.
2. Local `server-php/data/db-config.php`, generated by admin or installer, can override defaults.
3. Environment/private config values override local config.
4. When `NICHOIR_ENV=production`, the normalized config must use `NICHOIR_DB_DRIVER=mysql`; invalid drivers and SQLite fail closed.

Canonical DB env names:

- `NICHOIR_DB_DRIVER`
- `NICHOIR_DB_HOST`
- `NICHOIR_DB_PORT`
- `NICHOIR_DB_NAME`
- `NICHOIR_DB_USER`
- `NICHOIR_DB_PASSWORD`
- `NICHOIR_DB_CHARSET`

The cPanel aliases `NICHOIR_MYSQL_HOST`, `NICHOIR_MYSQL_PORT`, `NICHOIR_MYSQL_DATABASE`, `NICHOIR_MYSQL_USERNAME`, `NICHOIR_MYSQL_PASSWORD` and `NICHOIR_MYSQL_CHARSET` are also accepted.

`server-php/data/db-config.php`, `server-php/data/installed.lock.php`, SQLite DB files, dumps and secrets are ignored by Git and must stay out of public web roots.

Expected production health with valid private MySQL config:

```json
{"ok":true,"service":"nichoir-php","env":"production","db":true,"db_driver":"mysql"}
```

Expected production health without valid private config: HTTP `500` with `error` set to `configuration_error`.

## Local seed dataset

For local admin/account test data:

```bash
php server-php/scripts/seed_demo_dataset.php
```

The script creates disposable local users, credits, subscriptions, payments, invoices, export authorizations, ticket threads and notification rows. Do not run the seed script on a production database, and do not publish seeded credentials in production docs or public assets.

## cPanel deployment

Preferred path:

```bash
scripts/build-cpanel-artifact.sh /tmp/nichoir-cpanel-artifact
```

The artifact separates browser-public files in `public_html/` from PHP source/config/data in `nichoir_private/`. See `../deployment/namecheap/README.md`.

If using the temporary installer:

- remove `installation/` from the server after setup;
- keep `server-php/src`, `server-php/data` and `server-php/migrations` outside `public_html`;
- define `NICHOIR_ADMIN_PASSWORD_HASH`;
- define `NICHOIR_ADMIN_PATH` or keep the non-obvious default `/gestion-nichoir`;
- define `NICHOIR_PUBLIC_BASE_URL`, `NICHOIR_CORS_ORIGINS` and `NICHOIR_LOG_HASH_SALT`;
- define `NICHOIR_DB_DRIVER=mysql` and complete MySQL/MariaDB connection values;
- disable `NICHOIR_DEBUG` and unsigned Stripe webhooks in production.

## Validation after backend changes

```bash
find server-php installation deployment/namecheap -name '*.php' -print -exec php -l {} \;
curl http://127.0.0.1:8021/api/health
```

Manual checks:

1. Smoke `/`, `/pricing`, `/about`, `/contact`, `/terms`, `/legal`, `/account`, `{NICHOIR_ADMIN_PATH}/login`.
2. Confirm `/admin`, `/admin/login` and `/administration` do not expose the back-office.
3. Confirm public page sources do not contain the configured admin path.
4. Submit invalid contact form and confirm redirected flash errors.
5. Test auth/register/activate or login with a known local account.
6. Test one export quote/authorize/consume success.
7. Repeat the same consume and confirm no second debit.
8. Test admin export quote/authorize/consume with no account session: it should return `admin=true`, `cost=0`, then reject a second consume of the same token.
9. If Stripe code changed, test checkout, portal and webhook signature handling in Stripe test mode.

## Open risks

- Public pricing cards are static translations while Stripe price IDs and credit package quantities are admin settings.
- Inline JavaScript remains in PHP-rendered pages, so strict CSP is not ready.
- Ticket and webhook rate limits are weaker than auth/client-log rate limits.
- Production log retention/rotation and export-size ceilings still need explicit policy.
