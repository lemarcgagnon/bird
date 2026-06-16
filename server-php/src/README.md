# PHP source modules

This folder contains the backend code used by `server-php/public/index.php`. PHP is the current source of truth for accounts, sessions, credits, billing, tickets, admin actions, contact email, logs, and Stripe integration.

## Files

- `auth.php`: bearer tokens, session creation/deletion, current-user lookup, public user projection, password/auth checks, activation codes, auth rate limits, email quotas, and client IP helper.
- `credits.php`: valid premium export types, configured export credit cost, and positive-partial-balance bonus calculation.
- `db.php`: SQLite/MySQL config resolution, PDO connections, migration/schema creation, settings persistence, local DB config file helpers, and install-lock helpers.
- `logger.php`: request ID, app logs, audit logs, Stripe event logs, hashed IP/email values, slow request logging, and fatal shutdown logging.
- `mail.php`: SMTP settings, header sanitization, raw SMTP send, ticket notification queue/send helpers, activation email, and contact/support email delivery support.
- `pages.php`: compatibility include that loads the extracted page, account, admin, contact, layout, helper, credit, mail, and Stripe modules.
- `response.php`: JSON response helper, JSON payload size limit, required-field helper, and base HTTP security headers.
- `stripe.php`: Stripe settings, API request helper, Checkout session creation, billing portal creation, and webhook signature verification.
- `stripe_webhook.php`: Stripe event idempotence, event logs, checkout completion handling, invoice/payment sync, and subscription sync.

## Important current coupling

- `pages.php` now only wires extracted modules together. The remaining coupling is that modules are still procedural functions loaded into one namespace.
- `public/index.php` currently includes all source modules directly and dispatches routes procedurally.
- DB settings can come from environment variables, private `config/production.php`, `server-php/data/db-config.php` for local/admin setup, or SQLite defaults for local/dev.
- Production target is MySQL; SQLite remains local/dev unless explicitly selected later.
- Settings such as Stripe, SMTP, credit policy, and support email are stored through `setting_get()` / `setting_set()` unless environment variables override them.

## Invariants

- Credit policy belongs in `credits.php`; do not reintroduce per-export hardcoded costs in routes or UI copy.
- Debit flows must write `credit_ledger` rows and audit/app logs.
- `/api/exports/consume` must atomically claim an authorization before debit.
- Contact form handling must keep CSRF, honeypot, rate limiting, input limits, SMTP error handling, and flash messages.
- Stripe secrets and SMTP passwords should prefer environment variables or private config in production.
- Admin write actions are protected by session login and CSRF; keep them auditable.

## Planned split

See `../../docs/refactoring-plan.md`.

Target split:

- `public/site.js` for current inline page scripts.

Already extracted: `helpers.php`, `i18n.php`, `layout.php`, `contact.php`, `public_pages.php`, `account_pages.php`, `admin_core.php`, `admin_exports.php`, `admin_helpers.php`, `admin_actions.php`, and `admin_pages.php`.
