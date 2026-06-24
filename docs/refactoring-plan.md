# Nichoir refactoring plan

## Purpose

This document is the current source of truth for codebase refactoring. The goal is not cosmetic cleanup. The goal is to reduce hidden coupling, split oversized files by ownership, and make future fixes cheaper and safer.

## Audit summary

The current codebase has five major structural hotspots:

1. `wasm/src/lib.rs` mixes params, sanitization, i18n, HTML generation, geometry, decor parsing, STL import, wall mount generation, mesh analysis, and exports.
2. `app/app.js` mixes boot, i18n, API calls, account UI, billing/export flow, decor import, decor STL preview, plan exports, viewer lifecycle, and full app rendering.
3. `server-php/public/index.php` is still a large front controller with route dispatch plus long inline route bodies.
4. `server-php/src/admin_pages.php` renders most admin sections from one file.
5. STL preview logic exists in both `app/app.js` and `server-php/public/library-preview.js`.

## Refactor principles

1. One responsibility per module.
2. One source of truth per business rule.
3. Shared logic must be shared in code, not copied.
4. File splitting is only valid if the runtime contract becomes clearer after the move.
5. Each step must have a concrete verification gate before the next step begins.

## Current hotspot inventory

### WASM

- `wasm/src/lib.rs`
  - Current role: full app core, UI HTML, i18n, geometry, exports.
  - Main oversized blocks:
    - `t(...)`
    - `sanitize_params(...)`
    - `build_cuts(...)`
    - `build_layout_pieces(...)`
    - `parse_svg_path_subset(...)`
    - `add_imported_stl_heightfield_basis(...)`
    - `build_scene_meshes(...)`
    - `plan_preview_svg(...)`
    - `render_app_html(...)`

### Frontend app

- `app/app.js`
  - Current role: full browser runtime for the WASM app.
  - Main oversized blocks:
    - `debugStlLog(...)`
    - `renderDecorLibraryStlGeometry(...)`
    - `openExportGateModal(...)`
    - `buildPlanPdf(...)`
    - `renderViewer(...)`
    - `render(...)`

- `app/style.css`
  - Current role: tabs, account, decor workflow, STL library preview, viewer, plan preview.

### PHP public/admin

- `server-php/public/index.php`
  - Current role: static assets, public pages, auth, billing, exports, tickets, library, admin, Stripe webhook.

- `server-php/src/admin_pages.php`
  - Current role: admin dashboard page, panels, modals, settings UI, logs UI.

- `server-php/public/site.css`
  - Current role: landing pages, public library, admin UI, settings forms, dialogs.

### Shared STL preview duplication

- `app/app.js`
- `server-php/public/library-preview.js`

These two files implement overlapping STL parsing and viewer behaviors and should converge on one shared browser module.

## Delivery order

The order below is chosen to reduce coupling before splitting files aggressively.

1. Stabilize the HTML contract between Rust and `app/app.js`.
2. Extract shared STL preview logic.
3. Split `app/app.js`.
4. Split `wasm/src/lib.rs`.
5. Split `server-php/public/index.php` into route modules.
6. Split `server-php/src/admin_pages.php`.
7. Split CSS by domain.
8. Finish i18n source-of-truth cleanup.

## Phase 1: Stabilize the Rust HTML and JS contract

Status: planned.

### Objective

Stop depending on post-render DOM surgery as the main way to shape the app UI.

### Files targeted

1. `wasm/src/lib.rs`
2. `app/app.js`

### Planned changes

1. Define a stable app shell contract:
   - Rust owns semantic HTML structure and data hooks.
   - JS owns event binding and live state only.
2. Remove structural DOM rewrites after `render_app_html(...)`.
3. Replace fragile selectors with explicit `data-*` hooks where needed.

### Verification gate per file

- `wasm/src/lib.rs`
  - Measure: `render_app_html(...)` no longer requires JS to move core action buttons, regroup sections, or patch missing layout wrappers.
  - Check: search for app-shell selectors used by JS and confirm they map to stable `data-*` hooks instead of implicit structure.

- `app/app.js`
  - Measure: `rewriteLeftMenu(...)` and `wrapPanelSections(...)` are either removed or reduced to non-structural enhancement only.
  - Check: render still mounts correctly in `fr` and `en`, tabs still switch, controls still bind, no missing section after first render.

### Exit criteria

1. No structural DOM surgery remains after `root.innerHTML = render_app_html(...)`.
2. The app still renders the same panels and actions in both languages.

## Phase 2: Extract shared STL preview runtime

Status: planned.

### Objective

Remove duplicated STL parsing/viewer code between the app and the public/admin library.

### Files targeted

1. `app/app.js`
2. `server-php/public/library-preview.js`
3. `app/shared/stl-preview.js` or `public/shared/stl-preview.js`

### Planned changes

1. Extract shared browser STL preview helpers:
   - STL binary/ascii parsing
   - preview geometry build
   - viewer toolbar
   - viewer render controls
2. Keep surface-specific code in thin adapters only.

### Verification gate per file

- `app/app.js`
  - Measure: no local duplicate implementations remain for STL preview parsing/rendering.
  - Check: functions such as STL parse/build/render now import from the shared preview module.

- `server-php/public/library-preview.js`
  - Measure: becomes an adapter layer, not a full preview engine.
  - Check: public and admin STL thumbnails/previews still render, including original STL modal preview.

- Shared preview module
  - Measure: one implementation serves both runtimes.
  - Check: one code path supports toolbar, fit/reset, and preview geometry generation in both contexts.

### Exit criteria

1. Only one STL preview engine remains in the repository.
2. Public library STL preview and app decor library STL preview both still work.

## Phase 3: Split `app/app.js` by responsibility

Status: planned.

### Objective

Turn the browser runtime into smaller files with clear ownership.

### Target structure

1. `app/bootstrap.js`
2. `app/render.js`
3. `app/i18n.js`
4. `app/api.js`
5. `app/account.js`
6. `app/exports.js`
7. `app/decor-import.js`
8. `app/decor-library.js`
9. `app/viewer.js`
10. `app/pdf.js`

### Verification gate per file

- `app/bootstrap.js`
  - Measure: startup sequence is isolated and short.
  - Check: app boot still sets theme, language, initial params, and first render.

- `app/render.js`
  - Measure: `render()` becomes orchestration only.
  - Check: DOM paint and binding order still work with no duplicate listeners.

- `app/i18n.js`
  - Measure: all browser translation helpers live in one file.
  - Check: `tr(...)`, language detection, and document lang updates still work in `fr` and `en`.

- `app/api.js`
  - Measure: request/response handling and auth headers are centralized.
  - Check: account, exports, library, billing, and admin session checks still use the same API wrapper.

- `app/account.js`
  - Measure: account/tickets rendering and session refresh are isolated.
  - Check: login/logout, ticket list, and ticket detail still work.

- `app/exports.js`
  - Measure: export quote/authorize/consume and download flows are isolated.
  - Check: STL export, panels ZIP, PDF plan, and export gate modal still work.

- `app/decor-import.js`
  - Measure: SVG/image/STL import and status UI are isolated.
  - Check: upload, clear, preview source refresh, and relief mode still work.

- `app/decor-library.js`
  - Measure: decor library list and preview modal are isolated from general render logic.
  - Check: library list loads, preview opens, download auth still works.

- `app/viewer.js`
  - Measure: persistent viewer lifecycle is isolated.
  - Check: rotate/pan/zoom/reset and tab changes still preserve the viewer correctly.

- `app/pdf.js`
  - Measure: PDF/image export utilities are isolated from app state orchestration.
  - Check: calculations PDF and plan PDF still generate.

### Exit criteria

1. `app/app.js` becomes a thin entrypoint or disappears.
2. No module owns unrelated concerns.

## Phase 4: Split `wasm/src/lib.rs`

Status: planned.

### Objective

Split the WASM core into coherent Rust modules without changing geometry behavior.

### Target structure

1. `wasm/src/params.rs`
2. `wasm/src/sanitize.rs`
3. `wasm/src/i18n.rs`
4. `wasm/src/ui_html.rs`
5. `wasm/src/geometry/mod.rs`
6. `wasm/src/geometry/house.rs`
7. `wasm/src/geometry/layout.rs`
8. `wasm/src/decor/svg.rs`
9. `wasm/src/decor/stl.rs`
10. `wasm/src/decor/heightmap.rs`
11. `wasm/src/wall_mount.rs`
12. `wasm/src/export.rs`
13. `wasm/src/mesh_report.rs`
14. `wasm/src/lib.rs` as the public facade only

### Verification gate per file

- `wasm/src/params.rs`
  - Measure: `NichoirParams`, enum modes, defaults, and param helpers are isolated.
  - Check: default params JSON remains identical in shape.

- `wasm/src/sanitize.rs`
  - Measure: all input clamping and decor sanitization move here.
  - Check: invalid or extreme input still clamps to the same safe ranges.

- `wasm/src/i18n.rs`
  - Measure: `t(...)` leaves `lib.rs`.
  - Check: all existing translation keys still resolve in `fr` and `en`.

- `wasm/src/ui_html.rs`
  - Measure: HTML builders and controls leave geometry modules.
  - Check: rendered control ids, names, and section hooks remain stable.

- `wasm/src/geometry/house.rs`
  - Measure: house panel generation and cutout logic are isolated.
  - Check: house STL export still includes facade, sides, roof, floor, perch, and wall-mount merge behavior.

- `wasm/src/geometry/layout.rs`
  - Measure: BOM and cut plan logic are isolated.
  - Check: cut plan summary and piece layout remain consistent.

- `wasm/src/decor/svg.rs`
  - Measure: SVG parsing and loop normalization are isolated.
  - Check: SVG decor still previews and exports with the same clipping behavior.

- `wasm/src/decor/stl.rs`
  - Measure: imported STL parsing and basis placement are isolated.
  - Check: imported STL decor still merges and clips against entry boring correctly.

- `wasm/src/decor/heightmap.rs`
  - Measure: raster/heightfield decor logic is isolated.
  - Check: PNG/JPEG/GIF/WEBP relief decor still renders with low/medium/high preset behavior.

- `wasm/src/wall_mount.rs`
  - Measure: dovetail wall mount geometry leaves the general house module.
  - Check: male merged mount, female receiver export, holes, overhang extension, and bevel details still work.

- `wasm/src/export.rs`
  - Measure: STL/OBJ/ZIP/SVG export functions are isolated.
  - Check: each export still produces the same product family entrypoints.

- `wasm/src/mesh_report.rs`
  - Measure: mesh analysis and topology checks are isolated.
  - Check: mesh report JSON still flags non-manifold/open-edge issues.

- `wasm/src/lib.rs`
  - Measure: becomes a public facade and wiring layer only.
  - Check: file size drops sharply and public exported WASM functions remain stable.

### Exit criteria

1. `wasm/src/lib.rs` becomes orchestration only.
2. Geometry and UI HTML no longer live in the same source file.

## Phase 5: Split `server-php/public/index.php` into route modules

Status: planned.

### Objective

Reduce the front controller to bootstrap plus dispatch.

### Target structure

1. `server-php/public/index.php`
2. `server-php/src/routes/public_routes.php`
3. `server-php/src/routes/auth_routes.php`
4. `server-php/src/routes/library_routes.php`
5. `server-php/src/routes/export_routes.php`
6. `server-php/src/routes/billing_routes.php`
7. `server-php/src/routes/ticket_routes.php`
8. `server-php/src/routes/admin_routes.php`
9. `server-php/src/routes/webhook_routes.php`

### Verification gate per file

- `server-php/public/index.php`
  - Measure: route bodies leave the file.
  - Check: file becomes bootstrap plus route registration/dispatch only.

- `server-php/src/routes/public_routes.php`
  - Measure: public page and static asset routes are isolated.
  - Check: `/`, `/pricing`, `/about`, `/contact`, `/terms`, `/legal`, `/library` still resolve.

- `server-php/src/routes/auth_routes.php`
  - Measure: register/activate/login/logout/profile routes are isolated.
  - Check: account auth lifecycle still works.

- `server-php/src/routes/library_routes.php`
  - Measure: library preview, authorize, download routes are isolated.
  - Check: thumbnail, STL preview, auth, and download flows still work.

- `server-php/src/routes/export_routes.php`
  - Measure: quote/authorize/consume live in one route owner.
  - Check: billing logic still debits only on consume and still honors repeat-download rules.

- `server-php/src/routes/billing_routes.php`
  - Measure: checkout, portal, ledger, summary routes are isolated.
  - Check: billing summary and Stripe portal/checkout endpoints still answer correctly.

- `server-php/src/routes/ticket_routes.php`
  - Measure: ticket list/detail/create/message flows are isolated.
  - Check: ticket creation and replies still work.

- `server-php/src/routes/admin_routes.php`
  - Measure: admin page, login/logout, exports download, admin actions are isolated.
  - Check: admin login and dashboard still work through the configured admin path.

- `server-php/src/routes/webhook_routes.php`
  - Measure: Stripe webhook handling is isolated.
  - Check: webhook endpoint remains reachable and unchanged in path.

### Exit criteria

1. `server-php/public/index.php` is no longer a long route script.
2. Each route family has one owner file.

## Phase 6: Split `server-php/src/admin_pages.php`

Status: planned.

### Objective

Separate admin presentation by section and shared components.

### Target structure

1. `server-php/src/admin/pages/dashboard.php`
2. `server-php/src/admin/pages/support.php`
3. `server-php/src/admin/pages/clients.php`
4. `server-php/src/admin/pages/library.php`
5. `server-php/src/admin/pages/billing.php`
6. `server-php/src/admin/pages/logs.php`
7. `server-php/src/admin/pages/settings.php`
8. `server-php/src/admin/components/modal.php`
9. `server-php/src/admin/components/forms.php`

### Verification gate per file

- `server-php/src/admin/pages/dashboard.php`
  - Measure: top-level dashboard composition is isolated.
  - Check: admin tab routing still renders the same sections.

- `server-php/src/admin/pages/support.php`
  - Measure: support/open tickets UI has one owner.
  - Check: support and ticket modal still render correctly.

- `server-php/src/admin/pages/clients.php`
  - Measure: selected user profile/credits/billing/exports/library blocks are isolated.
  - Check: client modal deep links and detail panels still work.

- `server-php/src/admin/pages/library.php`
  - Measure: library settings and library inventory UI are isolated.
  - Check: library item forms, thumbnails, STL previews, limits settings still render correctly.

- `server-php/src/admin/pages/billing.php`
  - Measure: export links and DB export section are isolated.
  - Check: billing/export panels still match admin actions.

- `server-php/src/admin/pages/logs.php`
  - Measure: logs rendering and filters are isolated.
  - Check: app logs, audit logs, and Stripe logs still render.

- `server-php/src/admin/pages/settings.php`
  - Measure: DB, email, Stripe, credit, and library settings are isolated.
  - Check: settings forms still fit the layout and preserve current values.

- `server-php/src/admin/components/modal.php`
  - Measure: modal chrome is shared once.
  - Check: ticket modal and client modal still share the same shell.

- `server-php/src/admin/components/forms.php`
  - Measure: repeated admin form fragments are centralized.
  - Check: form labels, buttons, and notice areas remain consistent.

### Exit criteria

1. `server-php/src/admin_pages.php` becomes a thin compatibility layer or disappears.
2. Each admin tab has a distinct owner.

## Phase 7: Split CSS by domain

Status: planned.

### Objective

Make style ownership explicit instead of keeping all app/public/admin rules in two oversized stylesheets.

### Target structure

1. `app/styles/base.css`
2. `app/styles/viewer.css`
3. `app/styles/decor.css`
4. `app/styles/account.css`
5. `app/styles/exports.css`
6. `server-php/public/styles/site-base.css`
7. `server-php/public/styles/landing.css`
8. `server-php/public/styles/library.css`
9. `server-php/public/styles/admin.css`
10. `server-php/public/styles/settings.css`

### Verification gate per file

- Each split CSS file
  - Measure: selectors belong to one UI domain only.
  - Check: no selector group spans unrelated surfaces such as public landing plus admin settings plus STL library preview.

- App CSS group
  - Measure: viewer, decor, account, exports are independently maintainable.
  - Check: app still renders correctly on desktop and mobile.

- Public/admin CSS group
  - Measure: landing/public library/admin settings stop sharing one giant stylesheet.
  - Check: public pages and admin pages still preserve the established visual language.

### Exit criteria

1. CSS ownership matches UI ownership.
2. Future UI changes stop risking unrelated surfaces.

## Phase 8: Centralize i18n source of truth

Status: planned.

### Objective

Stop translation drift across PHP, JS, and Rust.

### Files targeted

1. Translation source file, for example `i18n/catalog.json` or `i18n/catalog.yml`
2. `server-php/src/i18n.php`
3. `app/i18n.js`
4. `wasm/src/i18n.rs`

### Planned changes

1. Define one canonical translation catalog.
2. Generate or verify surface-specific lookup tables from it.
3. Add a key parity check.

### Verification gate per file

- Canonical catalog
  - Measure: one list of `fr`/`en` keys owns public product copy.
  - Check: all app/public/admin visible keys exist in both languages.

- `server-php/src/i18n.php`
  - Measure: PHP uses the canonical key set.
  - Check: public pages and admin labels still render in both languages where supported.

- `app/i18n.js`
  - Measure: browser app translations stop diverging from Rust/PHP naming.
  - Check: app UI labels still map correctly.

- `wasm/src/i18n.rs`
  - Measure: Rust no longer owns an independent giant translation switch.
  - Check: WASM-rendered controls and notes still use valid keys.

### Exit criteria

1. One canonical catalog exists.
2. Translation drift becomes detectable automatically.

## Global verification checklist

This is the cross-cutting gate to use after each phase.

1. Confirm targeted files actually shrank and did not just move code sideways.
2. Confirm each moved responsibility has one owner file only.
3. Confirm no duplicate STL preview code remains after Phase 2.
4. Confirm no route body remains in `server-php/public/index.php` after Phase 5.
5. Confirm no admin tab HTML remains outside its target section owner after Phase 6.
6. Confirm no new hardcoded visible copy appears outside the intended i18n owner after Phase 8.
7. Confirm file-count growth is justified by clearer ownership, not fragmentation.

## File-size outcome targets

These are guidance targets, not strict hard limits.

- `wasm/src/lib.rs`: below 1200 lines
- `app/app.js`: below 400 lines if kept as entrypoint
- `server-php/public/index.php`: below 250 lines
- `server-php/src/admin_pages.php`: below 250 lines or replaced by section includes
- `app/style.css`: split so no single app stylesheet carries unrelated domains
- `server-php/public/site.css`: split so no single public/admin stylesheet carries unrelated domains

## Decision rule

Do not split files just to increase file count. Split only when ownership becomes sharper, duplicated logic disappears, and the verification gate for that step becomes objectively easier to pass.

## Handover protocol

This protocol is mandatory for any interrupted or resumed refactoring session.

### Before starting a phase

1. Re-read this file completely.
2. Read `docs/refactoring-non-regression-contract.md` completely.
3. Read `docs/refactoring-smoke-checklist.md` completely.
4. State the exact phase and sub-scope being executed.
5. List the exact files to be touched before editing.
6. State the invariants that must not move for that scope.

### While executing a phase

1. Do not mix two phases in one edit batch unless the second phase is required mechanically by the first.
2. Do not duplicate moved logic in the destination file. Move ownership, do not fork ownership.
3. Keep public API names, route paths, export product codes, and storage keys stable unless the phase explicitly changes them.
4. If a structural change requires a temporary compatibility layer, mark it clearly and keep it thin.

### Before closing a phase

1. Record which files were touched.
2. Record which target ownership was achieved.
3. Record which verification items from the smoke checklist were actually checked.
4. Record any residual risk or deferred cleanup.
5. Update this plan if the intended next step changed.

### Stop conditions

Stop and document the issue before continuing if one of these happens:

1. A file must now own two unrelated concerns after the refactor.
2. A compatibility shim grows into a second permanent source of truth.
3. A moved module still requires structural DOM surgery from another layer.
4. A route split changes a public path, admin path, billing path, or webhook path unintentionally.
5. A billing/export change weakens debit, entitlement, fingerprint, or admin bypass rules.

### Resume note template

Use this exact structure in the next handoff note:

1. Phase in progress
2. Exact files touched
3. Ownership moved
4. Invariants preserved
5. Verification completed
6. Known risk
7. Next smallest safe step
