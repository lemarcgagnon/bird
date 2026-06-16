# Nichoir documentation index

This folder is the handoff layer for installation, security, contact email, and refactoring work. It should explain current state and known gaps, not aspirational architecture only.

## Documents

- `reprise-installation.md`: restart notes for the installer/server continuation, including how the temporary installer and local servers were expected to be used.
- `contact-email-plan.md`: contact email implementation plan, attack-surface reasoning, protections, and validation steps.
- `refactoring-plan.md`: current phased DRY/KISS/i18n/HIG/security refactoring plan.
- `reste-a-faire.md`: older feature/roadmap backlog. Treat as historical unless reconciled with current code.
- `securizons.md`: older security notes for files, SVG/input handling, WASM, and server boundaries. Treat as security backlog/reference.

## Current implementation facts

- PHP currently renders the public site, pricing, about, contact, account, admin, API, and Stripe webhook through `server-php/public/index.php` plus `server-php/src/pages.php`.
- Contact form email is implemented with CSRF, honeypot, IP rate limiting, SMTP handoff through `src/mail.php`, app logging, and session flash messages.
- Credit policy is implemented in `server-php/src/credits.php` and configurable from admin settings.
- Export consume now claims an authorization before debit to reduce duplicate-consume risk.
- PHP, JS, and Rust/WASM each still have their own i18n tables; key parity currently passes, but ownership is not centralized.
- PHP page scripts are still inline in `pages.php`; CSP hardening depends on moving them into `server-php/public/site.js`.

## Last validation pass

Completed checks:

- PHP lint for main backend files.
- JS syntax check for `app/app.js`.
- Rust/WASM compile check for `wasm32-unknown-unknown`.
- i18n key parity for PHP, JS, and Rust/WASM French/English tables.
- Public route smoke checks for home, pricing, about, contact, and account.
- Contact invalid POST flash behavior.

Pending checks:

- Live duplicate export consume test with an authenticated account and real authorization.
- Admin route smoke test with configured admin access.
- Stripe test-mode checkout/portal/webhook path.
- Browser keyboard traversal for account/admin tabs and modals.

## Known drift to fix

- `app/app.js` hardcodes the current 3-credit policy in `pricing_info` copy.
- `wasm/src/lib.rs` has a stale `a venir` label for `deco_clip`.
- English public pages still use French ARIA labels for navigation/language.
- `server-php/src/pages.php` contains an apparently unused `coming_soon` translation key.
