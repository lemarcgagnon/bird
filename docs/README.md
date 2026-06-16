# Nichoir documentation index

This folder is the handoff layer for installation, security, contact email, and refactoring work. It should explain current state and known gaps, not aspirational architecture only.

## Documents

- `reprise-installation.md`: restart notes for the installer/server continuation, including how the temporary installer and local servers were expected to be used.
- `contact-email-plan.md`: contact email implementation plan, attack-surface reasoning, protections, and validation steps.
- `refactoring-plan.md`: current phased DRY/KISS/i18n/HIG/security refactoring plan.
- `prelaunch-quality-audit.md`: current prelaunch audit report, launch blockers, validation gates, and documentation anti-drift plan.
- `reste-a-faire.md`: older feature/roadmap backlog. Treat as historical unless reconciled with current code.
- `securizons.md`: older security notes for files, SVG/input handling, WASM, and server boundaries. Treat as security backlog/reference.

## Current implementation facts

- PHP currently routes the public site, pricing, about, contact, account, admin, API, and Stripe webhook through `server-php/public/index.php`.
- `server-php/src/pages.php` is now a compatibility include that loads smaller page, layout, i18n, contact, account, admin, credit, mail, Stripe, and helper modules.
- Contact form email is implemented with CSRF, honeypot, IP rate limiting, SMTP handoff through `src/mail.php`, app logging, and session flash messages.
- Credit policy is implemented in `server-php/src/credits.php` and configurable from admin settings.
- Export consume now claims an authorization before debit to reduce duplicate-consume risk.
- PHP, JS, and Rust/WASM each still have their own i18n tables; key parity currently passes, but ownership is not centralized.
- PHP page scripts are still inline in `src/layout.php` and `src/account_pages.php`; CSP hardening depends on moving them into `server-php/public/site.js`.
- Admin pages are intentionally French-only.
- Public PHP pages are bilingual and resolve language from `?lang`, then cookie, then `Accept-Language`.
- WASM receives `params.lang` from `app/app.js`.

## Last validation pass

Latest prelaunch audit checks:

- PHP lint for every PHP file passed.
- PHP public i18n key parity passed: 206 French keys and 206 English keys.
- PHP public placeholder parity passed.
- Rendered English public smoke checks passed for `/`, `/pricing`, `/about`, `/contact`, `/terms`, `/legal`, and `/account`.
- Basic dangerous PHP function search found no actual shell execution/eval/unserialize usage.

Pending checks:

- Live duplicate export consume test with an authenticated account and real authorization.
- Admin route smoke test with configured admin access.
- Stripe test-mode checkout/portal/webhook path.
- Browser keyboard traversal for account/admin tabs and modals.
- JS syntax and Rust/WASM compile checks after the next code edits.

## Known drift to fix

- Admin access still uses a key accepted from URL/header and hidden form propagation; production needs session auth and admin CSRF.
- `/installation` is still reachable by root `.htaccess`; production deploy must remove or block it.
- Production artifact layout is not yet locked: whole-repo `public_html` can expose source/dev folders, while `server-php/public` alone does not expose `/app` and `/wasm/pkg`.
- `server-php/src/account_pages.php` still exposes demo credentials in public account markup.
- `wasm/src/lib.rs` has stale credit labels and a French fallback for `deco_clip`.
- Runtime SQLite data is tracked and currently modified locally.
- Production error display and secure session cookie policy should be explicit, not left to shared-host defaults.

## Documentation drift rules

- `docs/README.md` is the index and current status owner for this folder.
- `docs/prelaunch-quality-audit.md` is the current release gate until its blockers are fixed or explicitly accepted.
- Historical documents can remain, but they must not override current implementation facts.
- When code ownership changes, update the relevant README in the same change or mark the doc as historical.
