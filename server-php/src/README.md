# PHP source modules

This folder contains the backend code included by `server-php/public/index.php`. The code is procedural PHP loaded into one namespace, but most page/admin concerns have been split out of the old large `pages.php`.

## Modules

- `helpers.php`: escaping, private config loading, runtime error display policy, secure session cookie setup and money formatting.
- `db.php`: SQLite/MySQL config resolution, PDO creation, migration/schema creation, settings persistence, local DB config helpers and install lock helpers.
- `logger.php`: request IDs, hashed IP/email values, app logs, audit logs, Stripe event logs, slow request logging and fatal shutdown logging.
- `auth.php`: bearer tokens, session creation/deletion, current-user lookup, public user projection, activation codes, auth rate limits, email quotas and client IP helper.
- `credits.php`: valid premium export types, configured export credit cost and positive-partial-balance bonus calculation.
- `mail.php`: SMTP settings, header sanitization, raw SMTP sending, activation email support, contact email support and ticket notification queue/send helpers.
- `stripe.php`: Stripe settings, API request helper, Checkout session creation, billing portal creation and webhook signature verification.
- `stripe_webhook.php`: Stripe event idempotence, event logs, checkout completion handling, invoice/payment sync and subscription sync.
- `response.php`: JSON response helper, JSON payload size limit, required-field helper and base HTTP security headers.
- `i18n.php`: public/account translation tables, language detection, language-aware URLs and local dev app URL helper.
- `layout.php`: shared PHP page shell, header/nav/footer, language switcher and shared tab/modal inline JavaScript.
- `public_pages.php`: landing, pricing, about, contact, terms and legal page renderers.
- `contact.php`: contact CSRF helpers and `handle_contact_post()`.
- `account_pages.php`: account page renderer and account inline JavaScript.
- `admin_core.php`: configurable admin path, admin session auth, admin CSRF, redirect helpers and admin summary helpers.
- `admin_helpers.php`: admin option rendering, validation helpers, entity loaders, ticket notification creation and audit helper.
- `admin_actions.php`: admin POST handlers for login/logout, users, credits, subscriptions, tickets, SMTP, DB, Stripe and credit policy.
- `admin_exports.php`: admin database export scopes and CSV/XLS/JSON download handling.
- `admin_pages.php`: admin login page and back-office page rendering.
- `pages.php`: compatibility include that requires the page/admin/contact/layout/helper modules and defines shared constants.

## Important coupling

- `public/index.php` includes all modules directly and dispatches routes procedurally.
- `pages.php` no longer owns rendering logic, but callers still include it for the extracted modules and constants.
- DB settings can come from defaults, `server-php/data/db-config.php`, environment variables or private `config/production.php`.
- SQLite is local/development only. When `NICHOIR_ENV=production`, `db.php` requires `NICHOIR_DB_DRIVER=mysql` and complete MySQL/MariaDB connection values.
- Invalid DB drivers are rejected; they are not normalized back to SQLite.
- Stripe, SMTP, credit policy and support email settings are stored through `setting_get()` / `setting_set()` unless env/private config overrides them.

## Invariants

- Credit policy belongs in `credits.php`; do not reintroduce per-export hardcoded costs in routes or UI copy.
- Debit flows must write `credit_ledger` rows and app/audit logs.
- `/api/exports/consume` must atomically claim an authorization before debit.
- Contact handling must keep CSRF, honeypot, rate limit, input limits, SMTP failure handling and flash messages.
- Stripe secrets and SMTP passwords should prefer environment variables or private config in production.
- Admin write actions require a logged-in PHP session and CSRF; keep them auditable.
- `NICHOIR_ADMIN_PATH` owns the back-office path and defaults to `/gestion-nichoir`; do not reintroduce `/admin` or `/administration` as live routes.
- Keep the configured admin path out of public HTML/JavaScript; render it only in admin page responses.
- Public page text should go through `i18n.php`; admin pages are currently French-only.

## Planned cleanup

See `../../docs/refactoring-plan.md`.

Current main cleanup target:

- Move inline scripts from `layout.php`, `account_pages.php` and `admin_pages.php` into `server-php/public/site.js`, then add and test a stricter CSP.
