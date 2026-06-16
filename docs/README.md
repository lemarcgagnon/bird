# Nichoir documentation index

This folder is the handoff layer for current release status, security backlog and refactoring work. It should explain current state and known gaps; historical docs must not override current implementation facts from the README files next to the code.

Current release baseline: use the current `main` branch. The production hardening now includes prebuilt browser assets, local Three.js, production fail-closed config, MySQL-only production DB behavior, a configurable non-obvious admin path, and an artifact build that rejects docs/dev files/secrets.

## Documents

- `refactoring-plan.md`: phased DRY/KISS/i18n/HIG/security refactoring plan.
- `securizons.md`: security backlog/reference for files, SVG/input handling, WASM and server boundaries. It is not a release certification.

## Current implementation facts

- PHP routes the public site, pricing, about, contact, terms, legal, account, configurable admin path, JSON API and Stripe webhook through `server-php/public/index.php`.
- `server-php/src/pages.php` is now a compatibility include that loads smaller page, layout, i18n, contact, account, admin, credit, mail, Stripe and helper modules.
- Contact form email is implemented with CSRF, honeypot, IP rate limiting, SMTP handoff through `src/mail.php`, app logging and session flash messages.
- Credit policy is implemented in `server-php/src/credits.php` and configurable from admin settings.
- Export consume claims an authorization before debit to reduce duplicate-consume risk.
- PHP, JS and Rust/WASM each still have their own i18n tables; ownership is not centralized.
- PHP page scripts are still inline in `src/layout.php`, `src/account_pages.php` and `src/admin_pages.php`; CSP hardening depends on moving them into `server-php/public/site.js`.
- Admin pages are intentionally French-only.
- The admin path is controlled by `NICHOIR_ADMIN_PATH`, defaults to `/gestion-nichoir`, and must not be `/admin` or `/administration`.
- Public PHP pages are bilingual and resolve language from `?lang`, then cookie, then `Accept-Language`.
- The static app receives `params.lang` from `app/app.js`.
- Namecheap/cPanel packaging is documented in `deployment/namecheap/README.md` and scripted by `scripts/build-cpanel-artifact.sh`.
- Runtime SQLite files are ignored by Git and must remain local/development only.
- Production Namecheap/cPanel runs as `NICHOIR_ENV=production`, requires `NICHOIR_DB_DRIVER=mysql`, and fails closed without complete private MySQL config.
- Production `/api/health` should return `env=production` and `db_driver=mysql`; `db_driver=sqlite` is a failure in production.
- Three.js is vendored in `app/vendor/three.module.min.js` and included in the artifact; production runtime should not require CDN access.

## Validation status to refresh

Use this checklist when changing code before updating audit docs:

- PHP lint for every PHP file.
- `node --check app/app.js`.
- `cargo check --target wasm32-unknown-unknown` in `wasm/`.
- `wasm-pack build --target web` when Rust/WASM output is needed.
- `node scripts/mesh-smoke.mjs` after WASM rebuilds that affect geometry/exports.
- Render public routes `/`, `/pricing`, `/about`, `/contact`, `/terms`, `/legal`, `/account`.
- Test invalid contact POST and redirected flash errors.
- Test one authenticated export authorize/consume path and repeat consume failure.
- Smoke `{NICHOIR_ADMIN_PATH}/login` and `{NICHOIR_ADMIN_PATH}` with configured admin password.
- Confirm `/admin`, `/admin/login` and `/administration` do not expose the back-office.
- Test real Namecheap SMTP delivery, Stripe checkout/portal/webhook and HTTPS cookies on the final domain before launch.

## Known drift to fix

- Public pricing card display values are translation strings, while Stripe price IDs and credit package quantities are admin settings.
- `app/app.js` and some WASM labels still have 3-credit display fallback/copy even though PHP returns the real authorization cost.
- `wasm/src/lib.rs` has a stale `deco_clip` label saying the clipping feature is coming later, while clipping code is already present.
- `/installation` remains a temporary dev/root installer path only; the production artifact excludes it and production deploys must remove it after setup if it was ever uploaded separately.
- Inline PHP scripts block strict CSP.
- Production log retention/rotation, ticket/webhook rate limits and export-size ceilings need explicit policy.
- Full live Stripe and keyboard traversal checks are still pending before launch.

## Documentation drift rules

- `docs/README.md` is only the index and current status owner for this folder.
- Code-near README files own their subsystem facts: `server-php/README.md`, `app/README.md`, `wasm/README.md`, `deployment/namecheap/README.md`.
- Current release-gate facts belong in this index and the code-near README files.
- Historical documents can remain only when clearly labeled and not likely to confuse the Namecheap release path.
