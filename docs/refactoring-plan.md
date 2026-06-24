# Nichoir refactoring plan

## Purpose

This plan tracks cleanup needed to keep the PHP landing pages, account area, admin tools, i18n copy, credit accounting, and UI polish maintainable as the app moves toward production.

## Current risks

1. PHP page ownership is now split into focused modules, but inline JavaScript still lives in PHP-rendered page files.
2. i18n copy is split across PHP, JavaScript, and Rust/WASM, which makes translation drift likely.
3. Pricing display copy is separate from Stripe/admin configuration, so public prices can drift from actual products.
4. Export consumption must be protected against duplicate consume requests.
5. Contact form feedback depends on PHP session flash state and must always start the session before reading flash values.
6. HIG/accessibility polish needs consistent keyboard focus, tab semantics, and assistive-technology-safe hidden fields.
7. Security headers exist, but a strict CSP still needs inline scripts moved into external assets first.

## Phase 1: Stabilize behavior

Status: complete for the listed behavior fixes.

Tasks:

1. Make export consume atomically claim an authorization before debit.
2. Start the contact session before reading flash errors/success.
3. Improve tab semantics with `aria-controls`, `role="tabpanel"`, and `aria-labelledby`.
4. Add central `:focus-visible` styling in `site.css`.
5. Mark the contact honeypot as hidden from assistive technologies.

Validation:

1. Run `php -l server-php/public/index.php`.
2. Run `php -l server-php/src/pages.php`.
3. Submit an invalid contact form and confirm errors appear after redirect.
4. Submit two consume requests with the same authorization and confirm only one debit succeeds.
5. Keyboard-tab through public navigation, account tabs, admin tabs, and modal tabs.

## Phase 2: Split the page monolith

Status: complete for the PHP module split; `pages.php` is now a compatibility include.

Target structure:

1. `server-php/src/i18n.php`: language detection and public translation helpers.
2. `server-php/src/public_pages.php`: landing, pricing, about, contact, terms, legal.
3. `server-php/src/account_pages.php`: account page and account AJAX shell helpers.
4. `server-php/src/admin_pages.php`: admin dashboard, panels, modals, and admin form handlers.
5. `server-php/src/contact.php`: contact CSRF, validation, rate limiting, and SMTP handoff.
6. `server-php/public/site.js`: shared public/admin tab and modal behavior.

Validation:

1. Run PHP lint on every split file.
2. Request `/`, `/pricing`, `/about`, `/contact`, `/account`, and `{NICHOIR_ADMIN_PATH}`.
3. Confirm route behavior is unchanged before and after the split.

## Phase 3: Centralize i18n

Status: planned.

Tasks:

1. Define a single translation catalog source for `fr` and `en`.
2. Generate PHP, JS, and Rust translation tables from that source, or add a key-drift check.
3. Remove stale placeholder copy such as unfinished `a venir` labels unless the feature is intentionally disabled.
4. Add a validation command that compares key parity across app surfaces.

Validation:

1. Run the i18n key parity script.
2. Search for hardcoded public copy outside the translation catalog.
3. Open app and web pages in `fr` and `en`.

## Phase 4: Align pricing and Stripe settings

Status: planned.

Tasks:

1. Store display price, Stripe price ID, package name, and credit quantity per package.
2. Render `/pricing` from the same package settings used by checkout.
3. Render package pricing from the same server/admin settings used by checkout, and render per-product export costs from the backend product catalog instead of a single global export cost.
4. Add admin controls for display prices and package quantities.

Validation:

1. Confirm pricing cards match admin package settings.
2. Confirm checkout uses the intended Stripe price IDs.
3. Confirm purchased credits match the advertised package.

## Phase 5: CSP and script cleanup

Status: planned.

Tasks:

1. Move inline page scripts into `server-php/public/site.js`.
2. Add a `Content-Security-Policy` header without `unsafe-inline`.
3. Keep existing headers: `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`.

Validation:

1. Open browser devtools and confirm no CSP violations.
2. Confirm tabs, modals, contact forms, account ticket UI, and admin UI still work.

## Principle

The priority is not abstraction for its own sake. The priority is reducing hidden coupling: one source for copy, one source for pricing/package truth, one source for credit policy, and smaller files with clear ownership.

## Separation-of-concerns completion checklist

This checklist is the gate for finishing the PHP split without turning the refactor into a rewrite.

### Desired PHP ownership

- `src/helpers.php`: small formatting/escaping helpers with no database or request side effects.
- `src/i18n.php`: language detection, language URL helpers, app URL helper, translation lookup, and translation interpolation.
- `src/layout.php`: shared HTML page shell, header, navigation, footer, and shared page-level JavaScript until it moves to `public/site.js`.
- `src/contact.php`: contact CSRF, contact validation, contact rate limiting, SMTP handoff, and contact flash redirect behavior.
- `src/public_pages.php`: landing, pricing, about, contact, terms, and legal rendering.
- `src/account_pages.php`: account page rendering and account-page JavaScript until it moves to `public/site.js`.
- `src/admin_core.php`: admin access, redirects, tab normalization, admin URLs, and summary.
- `src/admin_exports.php`: admin database export dataset builders and response helpers.
- `src/admin_helpers.php`: admin option builders, validators, loaders, audit helper, and notification helper.
- `src/admin_actions.php`: admin POST action handlers and admin redirects.
- `src/admin_pages.php`: admin dashboard rendering, admin tables, admin modals, settings panels, and admin-only display helpers.
- `public/index.php`: route dispatch only, with no long handler bodies.

### Validation checklist for each extraction step

1. Run PHP lint on every touched PHP file.
2. Smoke test public pages: `/`, `/pricing`, `/about`, `/contact`, `/terms`, `/legal`.
3. Smoke test account page: `/account?lang=fr`, `/account?lang=en`.
4. Smoke test the admin page through `{NICHOIR_ADMIN_PATH}` with local/admin access.
5. Submit invalid contact form and confirm flash errors after redirect.
6. Confirm language switching keeps path, query, and fragment behavior.
7. Confirm account/admin tabs still switch and deep links still open the intended panel.
8. Confirm `/api/health` and one authenticated API route still return JSON.
9. Confirm export authorize/consume still use `src/credits.php` policy.
10. Confirm repeated consume for one authorization fails without a second debit.
11. Confirm no new public copy appears outside the intended i18n owner.
12. Confirm no inline-script cleanup is attempted until `public/site.js` is introduced and CSP is tested.

### Current split progress

Completed now:

- `src/helpers.php` extracted from `pages.php`.
- `src/i18n.php` extracted from `pages.php`.
- `src/layout.php` extracted from `pages.php`.
- `src/contact.php` extracted from `pages.php`.
- `src/public_pages.php` extracted from `pages.php`.
- `src/account_pages.php` extracted from `pages.php`.
- `src/admin_core.php` extracted from `pages.php`.
- `src/admin_exports.php` extracted from `pages.php`.
- `src/admin_helpers.php` extracted from `pages.php`.
- `src/admin_actions.php` extracted from `pages.php`.
- `src/admin_pages.php` extracted from `pages.php`.
- English ARIA labels for main navigation and language switch are now translated through `page_t()`.

Still pending:

- Move shared inline JavaScript from `layout.php` / account rendering into `public/site.js`.
- Re-check route behavior after each remaining extraction.
