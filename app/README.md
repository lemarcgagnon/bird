# Nichoir browser app

This folder contains the static browser shell and JavaScript glue for the Rust/WASM birdhouse designer.

## Files

- `index.html`: static HTML shell. It resolves `?lang=fr|en`, persists `nichoir-lang`, updates the boot message, loads `style.css`, and imports `app.js` as a module.
- `app.js`: browser integration layer for WASM, PHP API calls, downloads, account modal, client logs, i18n messages, and Three.js.
- `vendor/three.module.min.js`: local vendored Three.js runtime used by production artifacts. Do not switch back to a CDN import for production.
- `style.css`: app shell, controls, viewer, modal, download groups, light/dark theme, and responsive styling.

## Runtime inputs

- `window.NICHOIR_PHP_BASE`: optional explicit PHP API origin for controlled local/dev shells.
- `EXPORT_APP_ID`: fixed to `nichoir` for this WASM app. It is sent with export quote/authorize/consume calls so the PHP backend can act as mission control for multiple WASM apps.
- `?php_base=http://127.0.0.1:8021`: local-only override when the static app and PHP API run on separate local origins. The override is ignored unless both the page host and target API host are `localhost`, `127.0.0.1` or `::1`.
- When the static app is served from `127.0.0.1:8016` or `localhost:8016` without `php_base`, `app.js` automatically uses the PHP API at the same host on port `8021`.
- `?lang=fr|en` and local storage key `nichoir-lang`.
- Local storage keys `nichoir-theme` and `nichoir-last-mesh-report`.
- Legacy key `nichoir-auth-token` is removed on load. Current account auth relies on the PHP HttpOnly cookie `nichoir_account_session` and `fetch(..., { credentials: 'include' })`.
- `nichoir-last-mesh-report` stores only a diagnostic geometry snapshot so the user does not lose the report after leaving the screen. It is not a credit, account or authorization source.

## What `app.js` owns

- Loading `../wasm/pkg/wasm.js`.
- Local Three.js viewer setup, camera interaction, mesh rebuilds, explode mode and image capture.
- Browser-side FR/EN messages for dynamic UI not rendered by Rust/PHP.
- Language propagation to PHP page links.
- Theme persistence and light/dark toggle behavior.
- Account modal behavior, focus handling, profile summary, credits, billing, support tickets and ticket replies.
- API calls to PHP for auth, profile, ledger, billing, Stripe checkout/portal, export quote/authorize/consume with `app_id=nichoir`, tickets, admin session visibility and client logs.
- Billed download flow: request a quote from PHP, show the credit/bonus modal if needed, request a short authorization, generate the file locally, then consume the authorization after successful local generation.
- Current billed downloads: house STL, cut-plan SVG, cut-plan PNG, exploded assembly PNG and cut-plan PDF.
- Current local/free downloads: door STL, wall-mount STL, panels ZIP, calculations PDF, debug OBJ and mesh report JSON.
- Diagnostic downloads are rendered by WASM but hidden by default with `data-admin-only`; `app.js` unhides them only when `/api/admin/session` confirms an admin PHP session.
- Admin export access: when `/api/admin/session` returns `admin=true`, premium downloads still go through quote/authorize/consume but PHP returns `cost=0`, stores the token in the admin PHP session, and consumes it once without touching credits.
- Client-side decoration file intake: SVG/raster images are capped at 2 MiB and converted to WASM heightmaps; local STL imports are capped at 25 MiB and sent to WASM as base64 mesh data.
- Library decor remains a server/PHP download flow: the Decor panel lists active library files with server-generated PNG thumbnails, offers a Three.js STL preview modal before download, and can authorize/download them with credits. The client still receives the STL/image file on their computer and imports that local file through the decoration uploader. `app.js` does not fetch private library files directly into WASM.
- Decoration controls support panel target selection, width/height proportion lock, rotation, depth, heightmap smoothing/threshold and clipping to panel/hole geometry. Door/perch holes dominate front-panel decor in the WASM geometry.
- STL decor preview is permissive so imported meshes remain visible while the user places them. Strict export/report generation can still omit a decor if clipping makes it open or non-manifold; `app.js` logs the strict `deco_*` export report after import and shows a warning when that happens.

## Boundaries

- PHP is the source of truth for users, sessions, credits, Stripe billing, support tickets, credit policy and configured package settings.
- Rust/WASM is the source of truth for geometry, calculations, app control markup and export data generation.
- JavaScript should coordinate browser behavior and display returned policy data, not define billing or credit policy. Local `EXPORT_COSTS` values are fallback copy only; PHP responses are authoritative.
- JavaScript should not persist account bearer tokens. The current browser flow depends on the PHP session cookie and `/api/admin/session` for admin-only visibility.
- JavaScript should not special-case downloads by directly skipping authorization. Even admin downloads use the server quote/authorize/consume endpoints so one-shot tokens, expiry and logging stay consistent.

## Current drift

- Local `EXPORT_COSTS` values are fallback UI estimates for modal/status copy only. Backend credit cost is configurable in `server-php/src/credits.php`; quote and authorize responses return the real `cost`.
- Account login is handled by the PHP account page. The app modal only summarizes account state and links users to the server-owned account workflow.

## Validation after changes

1. Run `node --check app/app.js`.
2. Open `http://127.0.0.1:8016/app/?lang=fr` and the same URL with `lang=en`.
3. Confirm language switch, theme switch, account modal, PHP links and download authorization messages.
4. If download code changes, test one successful authorize/generate/consume path and one failed authorization path.
5. If admin download code changes, log into `{NICHOIR_ADMIN_PATH}/login`, confirm `/api/admin/session` returns `admin=true`, and verify a premium export returns `cost=0` then refuses a second consume of the same authorization.
6. If decoration intake changes, test SVG plus one raster image and one STL, and confirm client logs do not include heavy file payloads.
