# Hardening Handover

Use this handover to resume work after a cleared context window.

> Archived handover note (2026-06-24): this file is a historical branch handover from the 2026-06-17 hardening pass. It is no longer the current next-step order for the repository. Since this handover was written, the current codebase already includes the static PHP i18n cache, HttpOnly SameSite=Lax account auth via `nichoir_account_session`, cleanup of the legacy `nichoir-auth-token` browser key, the major DB/export indexes in `server-php/src/db.php`, Stripe invoice enrichment before the webhook DB transaction, and a persistent viewer lifecycle in `app/app.js`.

## Repository State

- Repository: `/home/marc/Documents/nichoir16`
- Remote: `https://github.com/lemarcgagnon/bird.git`
- Current branch for next work: `hardening-auth-svg-renderer`
- Stable production baseline on `main`: `55cff7a Prepare mission control and review fixes`

## Original Goal

Harden the app after the Namecheap/cPanel production stabilization work, without refactoring broadly.

The source of truth for the next pass is:

- `docs/hardening-source-of-truth.md`

External review inputs kept in the repo:

- `docs/gemini-review.md`
- `docs/gemini-kiss-review.md`

## What Is Already Done

Main branch has already been pushed with:

- Mission Control `app_id` support for export quote/authorize/consume.
- `/api/apps` app catalog endpoint.
- `app_id` stored on `export_authorizations`.
- Admin/export views include `app_id`.
- DB indexes added for account/export/payment/support tables.
- WASM negative taper clamp.
- Stripe invoice enrichment moved out of the webhook DB transaction.
- cPanel artifact validation remains clean.

Recent validations passed before this handover:

- PHP lint across repo.
- `cargo check` in `wasm/`.
- `wasm-pack build --target web`.
- `node scripts/mesh-smoke.mjs`.
- `node --check app/app.js`.
- Temporary SQLite migration/index check.
- Temporary cPanel artifact build at `/tmp/nichoir-cpanel-gemini-20260617`.
- Artifact PHP lint.
- Artifact scans for docs/dev/secrets/CDN.
- Artifact smoke:
  - `/api/health` without production config returns `500 configuration_error`.
  - `/app/index.html?lang=fr` returns `200`.
  - `/wasm/pkg/wasm.js` returns `200`.
  - `/wasm/pkg/wasm_bg.wasm` returns `200`.

## Original Next Work Order

Follow this exact order unless a test reveals a blocker:

1. PHP i18n cache.
2. HttpOnly cookie account auth.
3. SVG safety hardening.
4. Persistent Three.js renderer.

Do not start by moving the Mission Control app registry to the DB. Keep that deferred unless it becomes necessary.

## Guardrails

- Do not redesign deployment structure.
- Do not remove SQLite dev support.
- Production must remain MySQL-only and fail closed.
- Do not touch the validated upload zip/package unless specifically asked.
- Do not trust browser state for credits, entitlements, billing, or download authorization.
- Do not reintroduce CDN Three.js.
- Do not commit real secrets, `.env`, real `production.php`, DB files, generated zips, or private host credentials.
- Keep admin path hardening intact. Obvious `/admin` and `/administration` paths must remain unavailable/reserved in the public artifact.

## Original First Task To Start

Start with `server-php/src/i18n.php`.

Objective:

- Make `page_t()` reuse translation arrays with a `static` cache or equivalent.
- Do not rewrite translation content.

Minimum checks:

```bash
php -l server-php/src/i18n.php
php -l server-php/public/index.php
git diff --check
git diff --stat
```

If public route smoke is available, also test:

```txt
/?lang=fr
/?lang=en
/pricing?lang=fr
/pricing?lang=en
/contact?lang=fr
/contact?lang=en
```

## Original Larger Tasks After That

### HttpOnly Cookies

Change account auth so the production app does not store bearer tokens in `localStorage`.

Expected result:

- Login/register creates a server-side session and sets an `HttpOnly` cookie.
- `/api/me` works with cookie auth.
- Logout clears the cookie and invalidates the session.
- Fetch calls use same-origin credentials.
- Server remains the authority for credits/download authorization.

### SVG Safety

Make WASM the strict final gate for SVG decoration safety. JS may remain as a UX prefilter.

Expected result:

- Safe simple SVG still works.
- Script/event/external-reference SVGs are rejected.
- Raster decoration paths still work.

### Persistent Three.js Renderer

Reuse renderer/camera lifecycle instead of recreating the renderer on each parameter update.

Expected result:

- App stays visually identical.
- Viewer updates correctly.
- Old geometries/materials are disposed.
- No blank canvas after repeated edits.

## Commit Plan

Use small commits:

1. `Cache public translations`
2. `Use HttpOnly account session cookies`
3. `Harden SVG decoration sanitization`
4. `Reuse Three.js viewer renderer`

Run the relevant checklist from `docs/hardening-source-of-truth.md` before each commit.
