# Prelaunch quality audit and documentation drift plan

Date: 2026-06-16

Status update after commit `3dee4a1`: the app-level Namecheap/cPanel production blockers from this audit have been addressed in targeted passes. The validated artifact uses prebuilt browser assets, local Three.js, production fail-closed config, MySQL-only production behavior, generic admin-visible technical errors, and no public demo/quick-login UI. Remaining validation is real-hosting validation with production MySQL/MariaDB, SMTP, Stripe and HTTPS.

## Purpose

This document is the fixed reference for the prelaunch quality pass before Nichoir goes online on regular Namecheap/cPanel shared hosting.

It has two jobs:

1. Record the current audit result without rewriting the project.
2. Define a repeatable plan to prevent drift between code, public copy, i18n maps, deployment notes, and the documents in this folder.

## Overall verdict

PASS WITH FIXES for app-level production readiness, excluding final live Namecheap/cPanel validation.

The earlier FAIL verdict below is historical. Its app-level blockers were resolved or converted into explicit follow-up hardening items before the `3dee4a1` release baseline.

## Current deployment context

- Target host: Namecheap/cPanel shared hosting.
- Runtime should not require Node, Rust, Vite, wasm-pack, or a long-running process.
- Runtime must use prebuilt browser assets from `app/` and `wasm/pkg/`.
- Public pages are bilingual: French and English.
- Admin screens are intentionally French-only.
- Language handoff uses `?lang=fr|en` between PHP pages, JS, and the WASM app.
- PHP language resolution order is query parameter, cookie, then `Accept-Language`.
- WASM receives `params.lang` from `app/app.js`.
- The project should keep lightweight helpers and translation maps, not adopt a heavy framework.

## Automated checks already run in this audit

Passed:

1. `php -l` on every PHP file.
2. PHP i18n key parity: 206 French keys and 206 English keys.
3. PHP i18n placeholder parity: no mismatches.
4. Basic rendered public route smoke on a short-lived PHP server:
   - `/`
   - `/pricing`
   - `/about`
   - `/contact`
   - `/terms`
   - `/legal`
   - `/account`
5. Rendered English pages returned `html lang="en"` and three `hreflang` alternates.
6. Dangerous PHP function search found no actual `eval`, `unserialize`, `shell_exec`, `system`, `passthru`, `proc_open`, or `popen`.

Not available:

1. `composer validate`: no `composer.json`.
2. `composer audit`: no Composer dependency manifest.
3. PHPStan: no project config/tool present.
4. PHP_CodeSniffer: no project config/tool present.

Important local state:

1. `server-php/data/nichoir.sqlite` was removed from Git tracking and remains local/dev only.
2. The local smoke server needed an escalated run to bind a port in this environment.

## Fix progress

Completed after this audit:

1. Public account test credentials were removed from server-rendered account markup.
2. Production error display policy was added to the PHP front controller and installer.
3. Secure session cookie setup was centralized for app sessions and added to the installer.
4. Admin POST actions now require a CSRF token in addition to the session login check.
5. The obvious dynamic ticket/user SQL spots were converted to prepared statements.
6. Database identifier validation was added around schema helper inputs.
7. `.wasm`, `.json`, and `.js` MIME declarations were added to `.htaccess` files.
8. WASM stale credit labels and the `deco_clip` fallback were corrected.

Still open after `3dee4a1`:

1. Run real Namecheap/cPanel validation with actual MySQL/MariaDB credentials.
2. Test real SMTP delivery on the target account.
3. Test Stripe checkout, portal and signed webhook delivery against the real HTTPS domain.
4. Confirm HTTPS-only cookie behavior on the final domain.

Completed in the admin login pass:

1. Admin `?key=...` access was replaced by a PHP session login.
2. Admin credentials are no longer accepted from URLs, redirects, forms, or hidden `key` fields.
3. Admin login verifies `NICHOIR_ADMIN_PASSWORD_HASH` with `password_verify()`.
4. Successful admin login regenerates the PHP session ID.
5. Admin logout was added.
6. Logged-out visits to `/admin` and admin exports redirect to `/admin/login`.
7. Admin POST actions still require CSRF.

Completed in the Namecheap/cPanel packaging pass:

1. Added a wrapper-based public entrypoint template at `deployment/namecheap/public_html/index.php`.
2. Added a production `.htaccess` template for `public_html`.
3. Added a private MySQL config fallback example at `deployment/namecheap/config/production.example.php`.
4. Added `scripts/build-cpanel-artifact.sh` to create a local `public_html/` + `nichoir_private/` artifact.
5. Public artifact includes only `index.php`, `.htaccess`, `site.css`, `app/`, and runtime `wasm/pkg/wasm.js` + `wasm_bg.wasm`.
6. Public artifact excludes installer, docs, PHP source, PHP data, migrations, scripts, Rust source, `.git`, package metadata, SQLite, config, logs, backups, and dev files.
7. Private artifact contains `server-php/public/index.php`, `server-php/src/`, `server-php/data/README.md`, `server-php/migrations/`, `config/`, and `logs/`.
8. Runtime config now reads environment variables first and private `config/production.php` second.
9. Production config target is MySQL; SQLite is local/development only and is rejected when `NICHOIR_ENV=production`.
10. Public app runtime no longer ships local test credential literals.

Completed in the production runtime hardening pass:

1. cPanel wrapper defaults to `NICHOIR_ENV=production`.
2. Production requires `NICHOIR_DB_DRIVER=mysql` and complete MySQL/MariaDB config.
3. Production fails closed without valid private config.
4. `/api/health` returns `500 configuration_error` without config and `200` with `env=production`, `db=true`, `db_driver=mysql` when MySQL is valid.
5. MySQL `DATETIME` writes use `Y-m-d H:i:s` UTC formatting through `sql_utc_datetime()`.
6. Stripe webhook event retry/idempotency was fixed so failed events can be retried.
7. `?php_base` is local-host-only and ignored for external hosts.
8. Three.js is vendored locally in the artifact instead of loaded from CDN.
9. Public demo/dev/quick-login UI was removed.
10. SMTP/Stripe/server technical errors shown in admin are generic; details stay in server logs with request IDs.

Packaging validation result:

1. PHP lint passed on the staged private artifact.
2. Public FR/EN route smoke checks passed on the staged public wrapper.
3. `/app?lang=fr` and `/app/index.html?lang=fr` both returned 200.
4. `/wasm/pkg/wasm.js` returned 200.
5. `/wasm/pkg/wasm_bg.wasm` returned `Content-Type: application/wasm`.
6. `/installation`, `/server-php/src/db.php`, `/server-php/data/nichoir.sqlite`, `/docs/README.md`, and `/.git/config` returned 404 in the staged artifact.
7. Admin logged-out redirect, login, POST without CSRF failure, and logout passed.

Completed in the runtime DB/config cleanup pass:

1. Removed `server-php/data/nichoir.sqlite` from Git tracking without deleting the local developer copy.
2. Added ignore rules for SQLite/DB files, logs, local env files, backups, archives, local config, install locks, and private production config.
3. Updated `server-php/data/README.md` to document SQLite as local/dev only and production MySQL as the approved target.
4. Confirmed the packaging artifact excludes runtime SQLite DB files, local config, install locks, logs, backups, `.env` files, and installer runtime state.

## Historical launch blockers from the original audit

The items in this section are kept as an audit trail. For current release status, use the status update and release gate above.

### 1. Admin access and POST protection

Files:

- `server-php/src/admin_core.php`
- `server-php/src/admin_actions.php`
- `server-php/src/admin_pages.php`
- `server-php/public/index.php`

Status:

- Fixed in the admin login pass.
- Admin access now uses a server-side PHP session.
- Admin login verifies `NICHOIR_ADMIN_PASSWORD_HASH` with `password_verify()`.
- Successful login regenerates the PHP session ID.
- Admin credentials are no longer carried in URLs, redirects, forms, or hidden fields.
- Admin POST actions keep per-session CSRF protection.

Remaining note:

- The database schema still contains a legacy `admin_key_hash` audit column name. It no longer stores a URL key; it stores a session-derived audit hash.

Risk:

- Small if implemented as a minimal auth/CSRF layer.
- Higher if combined with a full admin redesign.

### 2. Installer exposure

Files:

- `.htaccess`
- `installation/index.php`

Problem:

- `/installation` is intentionally reachable in root `.htaccess`.
- The installer can write database/config settings and should not exist online after setup.

Current status:

1. `installation/` is not copied into the Namecheap/cPanel production artifact.
2. Production `.htaccess` blocks installer paths.
3. Installer use remains setup/development only.

Risk:

- Safe and small.

### 3. cPanel public/private boundary

Files:

- `.htaccess`
- `server-php/public/.htaccess`
- `server-php/src/i18n.php`
- `app/app.js`
- `wasm/pkg/wasm.js`
- `wasm/pkg/wasm_bg.wasm`

Problem:

- If the whole repository is uploaded as `public_html`, source/dev folders can be exposed.
- If only `server-php/public` is the document root, `/app/index.html` and `/wasm/pkg/...` will not be public unless copied or symlinked.

Current status:

1. The production artifact layout is `public_html/` plus `nichoir_private/`.
2. Public artifact contains only the public wrapper, `.htaccess`, `site.css`, `app/`, local Three.js and `wasm/pkg/` runtime files.
3. Private/runtime files stay under `nichoir_private/`.
4. `.wasm`, `.json`, and `.js` MIME rules are present.

Risk:

- Safe if done as packaging.
- Medium if runtime paths are changed without browser smoke testing.

### 4. Former public test credentials in account page

File:

- `server-php/src/account_pages.php`

Former problem:

- The public account page contained local test credentials.

Current status:

1. Prefilled public test credentials were removed from PHP account pages.
2. Public WASM demo/quick-login UI was removed.
3. Seed credentials remain local development data only and are not documented in production release docs.

Risk:

- Safe and small.

### 5. Production error/session hardening

Files:

- `server-php/public/index.php`
- `installation/index.php`
- `server-php/src/contact.php`
- `server-php/src/public_pages.php`

Problem:

- No explicit production `display_errors=0` policy was found.
- `session_start()` is used without a shared secure session helper.

Required fix:

1. Add a production bootstrap for error display/logging.
2. Add a shared secure session helper.
3. Set `HttpOnly`, `Secure` when HTTPS, and `SameSite=Lax` before session start.

Risk:

- Safe and small.

### 6. Runtime database tracked as source

File:

- `server-php/data/nichoir.sqlite`

Status:

- Fixed. Runtime SQLite data was removed from Git tracking and is ignored.
- `server-php/data/README.md` is the only intended tracked file in the runtime data directory.

Rule:

1. Keep SQLite local/development only.
2. Use MySQL for production.
3. Keep DB/config/secrets outside `public_html`.

Risk:

- Safe, but must be done deliberately with git.

## Security issues to fix before launch

1. Convert the remaining manually concatenated runtime SQL spots to prepared statements.
2. Keep schema/migration identifier SQL restricted to known internal table/column names.
3. Require a Stripe webhook secret in production.
4. Ensure `NICHOIR_ALLOW_UNSIGNED_STRIPE_WEBHOOKS` is not set in production.
5. Decide whether auth tokens in `localStorage` are acceptable for first launch; if yes, CSP and escaping discipline become more important.
6. Add CSP after inline scripts are moved to external assets.

## i18n drift found

PHP public pages:

- `?lang` accepts only `fr` and `en`.
- Invalid language values fall back safely.
- Query parameter takes precedence over cookie.
- Cookie takes precedence over browser language.
- Public `html lang` is rendered correctly.
- Public `hreflang` alternates are rendered.
- PHP public translation keys and placeholders are balanced.

WASM/JS:

- `app/index.html` and `app/app.js` read `?lang` before `localStorage`.
- `app/app.js` passes `params.lang` into WASM.
- `wasm/src/lib.rs` still has stale credit labels and one French fallback for `deco_clip`.

Required fix:

1. Correct WASM static credit labels, or better, feed export costs from the backend policy.
2. Add proper FR/EN arms for `deco_clip`.
3. Keep admin French-only by policy; do not add admin strings to the public i18n parity gate.

## Documentation drift report

Current docs drift observed:

1. `docs/README.md` still described `server-php/src/pages.php` as the main monolithic page module.
2. `docs/README.md` listed old known drift items that are no longer fully current.
3. `docs/refactoring-plan.md` contains historical phase text, but its later checklist reflects the completed PHP split better.
4. `docs/reste-a-faire.md` is explicitly historical and should not be treated as current truth unless reconciled.
5. `docs/securizons.md` is a backlog/reference, not a current security certification.

Documentation rule:

Each document must declare one of these statuses near the top or in the docs index:

1. Current implementation reference.
2. Current execution plan.
3. Historical backlog/reference.
4. Completed plan kept for audit history.

## Anti-drift plan

### Phase 1 - Establish current source of truth

Owner files:

1. `docs/README.md`: documentation index and status of each document.
2. `docs/prelaunch-quality-audit.md`: current launch-blocker audit and execution checklist.
3. `README.md`: top-level operator guide.
4. `server-php/README.md`: backend/API/admin/contact/Stripe/runtime guide.
5. `server-php/src/README.md`: PHP module ownership guide.

Actions:

1. Keep this document as the prelaunch gate.
2. Update `docs/README.md` whenever a new planning or audit document is added.
3. Mark old documents as historical unless they are actively maintained.
4. Do not let `reste-a-faire.md` override current implementation docs.

Validation:

1. Search docs for references to `pages.php` as a monolith.
2. Search docs for stale claims about current i18n drift.
3. Search docs for stale dev-only credential markers and ports marked as production steps.

### Phase 2 - Add repeatable drift checks

Checks:

1. PHP syntax: `php -l` on every PHP file.
2. PHP i18n parity: compare FR/EN key sets and placeholders.
3. JS/WASM i18n parity: compare app and Rust translation keys where practical.
4. Hardcoded public French/English scan:
   - PHP public pages outside `i18n.php`.
   - `app/app.js` outside translation maps.
   - `wasm/src/lib.rs` fallback arms.
5. Deployment path scan:
   - `localhost`
   - `127.0.0.1`
   - `/home/marc`
   - known local seed account markers
   - known local seed password markers
6. Security scan:
   - `$_GET`, `$_POST`, `$_COOKIE`, `$_SERVER`, `$_FILES`
   - dangerous PHP functions
   - SQL string concatenation
   - `header('Location: ...')`
   - session start/cookie handling
7. Docs drift scan:
   - current docs mention files/modules that no longer exist or no longer own that behavior.

Output:

1. A short validation report before each production release.
2. Any drift becomes either a code fix, a docs fix, or an explicitly accepted exception.

### Phase 3 - Fix launch blockers in small passes

Order:

1. Remove public test credentials.
2. Add production error/session helpers.
3. Add admin session auth and CSRF.
4. Convert remaining dynamic SQL to prepared statements.
5. Fix WASM i18n/credit label drift.
6. Add cPanel MIME rules.
7. Define production artifact layout.
8. Remove/block installer from production.
9. Remove runtime DB from source tracking.
10. Re-run full validation.

Rule:

Do not combine deployment packaging, admin auth, and i18n rewrites into one large change. Each pass should have its own validation.

### Phase 4 - Release gate

The project is ready to upload only when all these are true:

1. PHP lint passes.
2. Rendered public FR/EN pages pass language and `hreflang` checks.
3. Public pages have no accidental French text in English mode, except allowed proper nouns.
4. Admin is server-side protected by session auth and CSRF.
5. Installer is absent or blocked.
6. Runtime DB/config/secrets are outside public web access.
7. Public artifact does not expose source/dev folders.
8. WASM loads with the correct MIME type.
9. Stripe webhook requires a production secret.
10. README files match the actual deployment layout.
11. `docs/README.md` matches the current status of every file in `docs/`.

## Fix classification

Safe small fixes:

1. Remove test credentials from public PHP account page.
2. Add `.wasm` and `.json` MIME types.
3. Add production error display policy.
4. Add shared secure session helper.
5. Fix WASM stale translation labels.
6. Convert specific dynamic SQL queries to prepared statements.
7. Update docs index and current facts.

Risky fixes needing explicit approval:

1. Change cPanel document root or deployment package structure.
2. Move private files outside `public_html`.
3. Change migration strategy away from request-time migration.
4. Make WASM pricing/credit labels fully dynamic from backend policy.

## Next execution checklist

Before edits:

1. Confirm this document is the accepted launch audit baseline.
2. Choose whether the next pass is security-first or deployment-first.
3. Keep changes small and validate after each pass.

Recommended next pass:

1. Security-first small pass:
   - Remove public test credentials.
   - Add production error policy.
   - Add secure session helper.
   - Historical note: add admin CSRF while preserving the then-current admin key temporarily.
   - Convert the obvious SQL concatenations.
2. Then run PHP lint and route smoke checks.
3. Historical note: then decide whether to replace the admin key flow completely. Active runtime now uses `/admin/login` with PHP session auth.
