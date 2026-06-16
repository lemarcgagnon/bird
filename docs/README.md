# Nichoir documentation index

This folder is the handoff layer for installation, security, contact email, refactoring and prelaunch work. It should explain current state and known gaps; historical docs must not override current implementation facts from the README files next to the code.

Current release baseline: commit `3dee4a1` is the stabilized Namecheap/cPanel production base. The validated artifact uses prebuilt browser assets, local Three.js, production fail-closed config, and MySQL-only production DB behavior.

## Documents

- `prelaunch-quality-audit.md`: historical prelaunch audit plus post-`3dee4a1` status notes. Treat older FAIL sections as superseded where the document says fixed.
- `refactoring-plan.md`: phased DRY/KISS/i18n/HIG/security refactoring plan.
- `contact-email-plan.md`: contact email implementation plan, attack-surface reasoning, protections and validation steps.
- `reprise-installation.md`: restart notes for installer/server continuation and older local server workflow.
- `reste-a-faire.md`: older feature/roadmap backlog. Treat as historical unless reconciled with current code.
- `securizons.md`: older security notes for files, SVG/input handling, WASM and server boundaries. Treat as security backlog/reference.

## Current implementation facts

- PHP routes the public site, pricing, about, contact, terms, legal, account, admin login/admin, JSON API and Stripe webhook through `server-php/public/index.php`.
- `server-php/src/pages.php` is now a compatibility include that loads smaller page, layout, i18n, contact, account, admin, credit, mail, Stripe and helper modules.
- Contact form email is implemented with CSRF, honeypot, IP rate limiting, SMTP handoff through `src/mail.php`, app logging and session flash messages.
- Credit policy is implemented in `server-php/src/credits.php` and configurable from admin settings.
- Export consume claims an authorization before debit to reduce duplicate-consume risk.
- PHP, JS and Rust/WASM each still have their own i18n tables; ownership is not centralized.
- PHP page scripts are still inline in `src/layout.php`, `src/account_pages.php` and `src/admin_pages.php`; CSP hardening depends on moving them into `server-php/public/site.js`.
- Admin pages are intentionally French-only.
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
- Smoke `/admin/login` and `/admin` with configured admin password.
- Test real Namecheap SMTP delivery, Stripe checkout/portal/webhook and HTTPS cookies on the final domain before launch.

## Known drift to fix

- Public pricing card display values are translation strings, while Stripe price IDs and credit package quantities are admin settings.
- `app/app.js` and some WASM labels still have 3-credit display fallback/copy even though PHP returns the real authorization cost.
- `wasm/src/lib.rs` has a stale `deco_clip` label saying the clipping feature is coming later, while clipping code is already present.
- `/installation` remains reachable in the root dev `.htaccess`; production artifact blocks it and production deploys must remove it after setup.
- Inline PHP scripts block strict CSP.
- Production log retention/rotation, ticket/webhook rate limits and export-size ceilings need explicit policy.
- Full live Stripe and keyboard traversal checks are still pending before launch.

## Documentation drift rules

- `docs/README.md` is only the index and current status owner for this folder.
- Code-near README files own their subsystem facts: `server-php/README.md`, `app/README.md`, `wasm/README.md`, `deployment/namecheap/README.md`.
- `docs/prelaunch-quality-audit.md` is historical plus status tracking; current release-gate facts belong in this index and the code-near README files.
- Historical documents can remain, but they must be labeled historical or reconciled when they conflict with current implementation.
