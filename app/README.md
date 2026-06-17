# Nichoir browser app

This folder contains the static browser shell and JavaScript glue for the Rust/WASM birdhouse designer.

## Files

- `index.html`: static HTML shell. It resolves `?lang=fr|en`, persists `nichoir-lang`, updates the boot message, loads `style.css`, and imports `app.js` as a module.
- `app.js`: browser integration layer for WASM, PHP API calls, downloads, account modal, client logs, i18n messages, and Three.js.
- `vendor/three.module.min.js`: local vendored Three.js runtime used by production artifacts. Do not switch back to a CDN import for production.
- `style.css`: app shell, controls, viewer, modal, download groups, light/dark theme, and responsive styling.

## Runtime inputs

- `window.NICHOIR_PHP_BASE`: optional explicit PHP API origin for controlled local/dev shells.
- `?php_base=http://127.0.0.1:8021`: local-only override when the static app runs on `8016` and the PHP API runs on `8021`. The override is ignored unless both the page host and target API host are `localhost`, `127.0.0.1` or `::1`.
- `?lang=fr|en` and local storage key `nichoir-lang`.
- Local storage keys `nichoir-theme`, `nichoir-auth-token` and `nichoir-last-mesh-report`.
- `nichoir-last-mesh-report` stores only a diagnostic geometry snapshot so the user does not lose the report after leaving the screen. It is not a credit, account or authorization source.

## What `app.js` owns

- Loading `../wasm/pkg/wasm.js`.
- Local Three.js viewer setup, camera interaction, mesh rebuilds, explode mode and image capture.
- Browser-side FR/EN messages for dynamic UI not rendered by Rust/PHP.
- Language propagation to PHP page links.
- Theme persistence and light/dark toggle behavior.
- Account modal behavior, focus handling, profile summary, credits, billing, support tickets and ticket replies.
- API calls to PHP for auth, profile, ledger, billing, Stripe checkout/portal, export quote/authorize/consume, tickets, admin session visibility and client logs.
- Billed download flow: request a quote from PHP, show the credit/bonus modal if needed, request a short authorization, generate the file locally, then consume the authorization after successful local generation.
- Current billed downloads: house STL, cut-plan SVG, cut-plan PNG, exploded assembly PNG and cut-plan PDF.
- Current local/free downloads: door STL, wall-mount STL, panels ZIP, calculations PDF, debug OBJ and mesh report JSON.
- Diagnostic downloads are rendered by WASM but hidden by default with `data-admin-only`; `app.js` unhides them only when `/api/admin/session` confirms an admin PHP session.
- Client-side decoration file intake with a 2 MiB limit before sending image/vector data to WASM.

## Boundaries

- PHP is the source of truth for users, sessions, credits, Stripe billing, support tickets, credit policy and configured package settings.
- Rust/WASM is the source of truth for geometry, calculations, app control markup and export data generation.
- JavaScript should coordinate browser behavior and display returned policy data, not define billing or credit policy. Local `EXPORT_COSTS` values are fallback copy only; PHP responses are authoritative.

## Current drift

- Local `EXPORT_COSTS` values are fallback UI estimates for modal/status copy only. Backend credit cost is configurable in `server-php/src/credits.php`; quote and authorize responses return the real `cost`.
- Account login is handled by the PHP account page. The app modal only summarizes account state and links users to the server-owned account workflow.

## Validation after changes

1. Run `node --check app/app.js`.
2. Open `app/index.html?lang=fr&php_base=http%3A%2F%2F127.0.0.1%3A8021` and the same URL with `lang=en`.
3. Confirm language switch, theme switch, account modal, PHP links and download authorization messages.
4. If download code changes, test one successful authorize/generate/consume path and one failed authorization path.
5. If decoration intake changes, test SVG plus one raster image and confirm client logs do not include heavy file payloads.
