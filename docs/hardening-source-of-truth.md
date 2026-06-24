# Hardening Source Of Truth

> Archived branch plan note (2026-06-24): this document records the original work order for the `hardening-auth-svg-renderer` branch. It is kept for traceability, not as the live repository source of truth. The current codebase already includes a static PHP i18n cache, HttpOnly SameSite=Lax account auth via `nichoir_account_session`, cleanup of the legacy `nichoir-auth-token` browser key, the major DB/export indexes in `server-php/src/db.php`, Stripe invoice enrichment before the webhook DB transaction, and a persistent Three.js viewer lifecycle in `app/app.js`.

This document was the working source of truth for the `hardening-auth-svg-renderer` branch.

The goal is targeted hardening after the production stabilization pass, without redesigning the app or changing the validated Namecheap/cPanel release path unless a real blocker is found.

## Scope

Do:

- Keep the backend as the authority for accounts, credits, entitlements, and download authorization.
- Move browser auth away from `localStorage` bearer tokens to server-set `HttpOnly` cookies.
- Improve SVG handling without breaking valid user decorations.
- Improve frontend rendering lifecycle only after security-sensitive work is stable.
- Keep SQLite development-only and MySQL production-only.
- Keep the current cPanel artifact model: prebuilt browser assets, local Three.js, no runtime Node/Rust/Vite/wasm-pack requirement.

Do not:

- Redesign the deployment structure.
- Remove SQLite development support.
- Move the app registry to the database in this branch unless it becomes necessary.
- Rewrite the Three.js viewer before auth and SVG safety are verified.
- Commit secrets, real config, `.env`, real `production.php`, database files, or generated cPanel zips.
- Treat client state as authoritative for credits, downloads, or billing.

## Current Baseline

- Branch: `hardening-auth-svg-renderer`
- Baseline commit on `main`: `55cff7a Prepare mission control and review fixes`
- Known external review inputs:
  - `docs/gemini-review.md`
  - `docs/gemini-kiss-review.md`
- Already handled before this branch:
  - Mission Control `app_id` support for export quotes/authorizations/consumption.
  - DB indexes for major account/export/payment/support tables.
  - WASM negative taper clamp.
  - Stripe invoice prefetch moved outside webhook DB transaction.

## Original Work Order

### 1. PHP i18n Cache

Objective: stop rebuilding large translation arrays on every `page_t()` call.

Allowed change:

- Use a `static` cache or equivalent in `server-php/src/i18n.php`.

Do not:

- Rewrite translations.
- Change public copy except for a confirmed typo.
- Split i18n into many files in this pass.

Verification:

- `php -l server-php/src/i18n.php`
- Public route smoke for `?lang=fr` and `?lang=en`.
- Confirm invalid language still falls back safely.

### 2. HttpOnly Cookie Auth

Objective: remove account bearer token exposure from `localStorage`.

Server requirements:

- Login/register/session creation sets an `HttpOnly` cookie.
- Cookie uses `SameSite=Lax` or stricter unless a real flow requires otherwise.
- Cookie uses `Secure` when HTTPS is active.
- Logout clears the cookie and invalidates server session state.
- Existing bearer-token support may remain temporarily only if needed for backward compatibility, but app runtime should prefer cookie auth.
- All account/download/credit decisions remain server-side.
- CSRF remains required for state-changing cookie-authenticated endpoints where appropriate.

Frontend requirements:

- Stop storing the auth token in `localStorage`.
- Use `fetch(..., { credentials: "same-origin" })` or equivalent for account API calls.
- Do not store download authorization, credits, or entitlement state as trusted client authority.
- Keep UI state local only for presentation.

Verification:

- Login succeeds and `/api/me` sees the session through cookie auth.
- Logout clears auth state and `/api/me` returns logged out.
- Download quote/authorize/consume still require server approval.
- Admin auth remains separate and unaffected.
- Browser devtools check: no account bearer token in `localStorage`.
- `php -l` all PHP.
- `node --check app/app.js`.
- Public and account route smokes.

### 3. SVG Safety

Objective: make user-provided SVG decoration handling safer without breaking normal SVG decoration workflows.

Preferred direction:

- Keep JS as a fast UX prefilter.
- Make WASM the strict consumer gate.
- Prefer allowlisted SVG elements and attributes over blacklist-only logic.

Allowed elements should be intentionally small. Start from what the app actually supports today, not from the entire SVG spec.

Do not:

- Allow scripts, event handlers, external references, remote images, CSS imports, `javascript:` URLs, or entity expansion.
- Trust SVG just because the browser parsed it.
- Break raster decoration workflows.

Verification:

- Safe simple SVG works.
- SVG with `<script>` is rejected.
- SVG with `onload=` or other event attributes is rejected.
- SVG with external href/src or `javascript:` is rejected.
- SVG export/decor smoke still passes.
- `cargo check`.
- `wasm-pack build --target web`.
- `node scripts/mesh-smoke.mjs`.

### 4. Persistent Three.js Renderer

Objective: reduce viewer churn by keeping renderer/camera lifecycle stable.

Before editing:

- Identify current viewer lifecycle in `app/app.js`.
- List what must be disposed: geometries, materials, textures, animation frame, resize handlers.

Implementation rules:

- Initialize `WebGLRenderer` once per viewer container lifecycle.
- Reuse camera, scene, lights, controls/state where practical.
- Replace mesh groups or geometry data cleanly on parameter updates.
- Dispose old geometries/materials when replaced.
- Preserve existing user interactions and exports.

Do not:

- Rewrite the UI.
- Change download billing behavior.
- Change WASM export APIs.

Verification:

- App loads with local Three.js only.
- Viewer updates after dimension/decor/plan changes.
- No blank canvas after repeated parameter edits.
- Mobile and desktop screenshots or smoke checks if Playwright/browser tooling is available.
- `node --check app/app.js`.
- `node scripts/mesh-smoke.mjs`.

### 5. Deferred Items

These are not part of the first hardening pass unless a test proves they are urgent:

- Move Mission Control `EXPORT_APPS` registry from PHP code to `app_settings`/database.
- Spatial indexing for decoration heightmap clipping.
- Full CSP cleanup beyond the current working CSP.
- Complete replacement of JS SVG prefilter with a single shared sanitizer.

## Anti-Drift Checklist

Before each code change:

- Identify the exact file and behavior being changed.
- Confirm the change belongs to one current work-order item.
- Avoid touching docs or unrelated UI unless needed for that item.
- Avoid broad formatting-only diffs.

After each code change:

- Run the smallest relevant syntax check.
- Inspect `git diff --stat`.
- Inspect `git diff --name-only`.
- Confirm no unrelated files changed.

Before committing:

- `git status --short`
- `git diff --check`
- `php -l` on changed PHP, or all PHP if PHP shared files changed.
- `node --check app/app.js` if frontend JS changed.
- `cargo check` if Rust changed.
- `node scripts/mesh-smoke.mjs` if WASM geometry/export/decor changed.
- Build cPanel artifact if runtime files, PHP bootstrap, config, or WASM/browser assets changed.

## Production Safety Checklist

The branch cannot be considered ready to merge unless:

- Production still fails closed without valid private config.
- Production cannot use SQLite.
- `/api/health` cannot report `db_driver=sqlite` in production.
- No bearer token is stored in `localStorage` by the production app.
- Server remains the source of truth for credit balance, debit, entitlement, and download authorization.
- Stripe webhook signature and idempotency behavior remain intact.
- No CDN Three.js import is reintroduced.
- Artifact scan finds no README/docs/dev files, `.env`, `.git`, SQLite/DB files, real `production.php`, secrets, quick-login/demo/dev login strings, or CDN references.

## Commit Discipline

Prefer one commit per work-order item:

1. `Cache public translations`
2. `Use HttpOnly account session cookies`
3. `Harden SVG decoration sanitization`
4. `Reuse Three.js viewer renderer`

If a smaller bug fix is discovered during a pass, commit it separately with a precise message.
