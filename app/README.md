# Nichoir browser app

This folder contains the static browser shell and JavaScript glue for the Rust/WASM birdhouse designer.

## Files

- `index.html`: minimal HTML shell. It reads `?lang=fr|en`, persists `nichoir-lang`, adjusts the boot/loading text, and loads `app.js` as a module.
- `app.js`: browser integration layer for the WASM app.
- `style.css`: styling for the WASM app UI, viewer layout, account modal, controls, light/dark theme, and responsive app shell.

## What `app.js` currently owns

- Loading the WASM package from `wasm/pkg`.
- Three.js viewer setup and interaction glue around Rust-generated geometry/output.
- Frontend i18n table for dynamic/browser-owned messages.
- Language detection and propagation to PHP links via `?lang=fr|en`.
- Theme persistence with `nichoir-theme` and light/dark toggle behavior.
- Account modal open/close/focus trap behavior.
- API calls to PHP for login, logout, profile, credits ledger, billing summary, Stripe checkout/portal, export authorization/consume, support tickets, and client logs.
- Download flow: ask PHP for authorization, generate file locally, then call PHP consume after successful local generation.
- User-readable mapping of API errors to localized messages.

## Boundaries

- PHP is the source of truth for users, sessions, credits, Stripe billing, support tickets, credit policy, and configured package settings.
- Rust/WASM is the source of truth for geometry, calculation, and export generation.
- JavaScript should coordinate browser behavior but should not duplicate backend business policy.

## Known current drift

- `pricing_info` still says each premium download costs 3 credits in both languages. Backend credit cost is now configurable through `server-php/src/credits.php` and admin settings, so this copy should become dynamic.

## Validation after changes

1. Run `node --check app/app.js`.
2. Open `app/index.html?lang=fr` and `app/index.html?lang=en`.
3. Confirm language switch, theme switch, account modal, PHP page links, and download authorization messaging still work.
4. If download code changes, test a successful generate/consume flow and a failed authorization flow.
