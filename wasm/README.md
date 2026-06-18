# Nichoir Rust/WASM core

This folder contains the Rust crate compiled to WebAssembly for the birdhouse designer. It is the client-side calculation and fabrication engine.

## Files

- `Cargo.toml`: Rust crate configuration. The crate builds as `cdylib`/`rlib` and uses `wasm-bindgen`, `serde`, `serde_json`, `earcutr`, `base64` and `image`.
- `Cargo.lock`: locked Rust dependency graph.
- `src/lib.rs`: UI markup, i18n lookup, parameter sanitization, geometry calculations, mesh generation, decoration handling, cut-plan SVG generation and WASM exports called from `app/app.js`.
- `pkg/`: generated `wasm-pack build --target web` output used by the browser app. In this repo it contains `wasm.js`, `wasm_bg.wasm`, `wasm.d.ts`, `wasm_bg.wasm.d.ts` and `package.json`; the directory is ignored by Git and can be regenerated.

## WASM exports

Current public bindings include:

- `wasm_version()`
- `default_params_json()`
- `render_app_html(input)`
- `scene_meshes_json(input)`
- `compute_summary(input)`
- `compute_stats(input)`
- `compute_cut_layout(input)`
- `plan_preview_svg(input)`
- `export_house_stl(input)`
- `export_house_obj(input)`
- `export_door_stl(input)`
- `export_wall_mount_stl(input)`
- `export_panels_zip(input)`
- `mesh_report_json(input)`

`app/app.js` wraps several outputs into browser downloads. The WASM module only generates data; PHP and JavaScript decide which buttons require a server-side credit flow.

## Current ownership

- Birdhouse dimensions, unit conversion, derived measures, panel geometry, roof/floor/door/perch/wall-mount behavior and mesh generation.
- Rust-rendered control markup and labels for dense app UI sections.
- Rust-rendered download button markup, including the diagnostic group marker. Admin visibility is resolved later by JavaScript/PHP session state.
- Rust-side French/English translation table for labels rendered from Rust.
- SVG/image/STL decoration parsing, heightmap/vector extrusion, imported mesh placement, panel clipping and dominant front-door/perch hole clipping.
- Export helpers for fabrication outputs used by the JavaScript download flow: house STL, door STL, wall-mount STL, panels ZIP, debug OBJ, mesh report JSON and cut-plan SVG. Imported STL decor is included in the full house mesh as an additive local mesh merge.
- Mesh topology analysis for reports and safety gates: open edge count, non-manifold edge count and `watertight` flag using the same 0.001 mm quantization as the Node smoke test.
- Watertight safety gate for generated decor: heightmap cells with zero relief are not emitted as double coplanar skin, and STL/heightmap decor that would survive clipping as an open or non-manifold mesh is excluded from strict exports instead of exported broken.
- Client-side validation/clamping for geometry-heavy inputs.

## Boundaries

- Do not put Stripe, account, session, SMTP, admin or credit-policy truth in Rust/WASM.
- Do not assume a fixed credit cost in Rust labels. Credit policy, credit balance, bonus eligibility, authorization and debit all belong to PHP.
- Keep browser/API/network orchestration in `app/app.js`.
- The browser may save the mesh report snapshot in local storage as `nichoir-last-mesh-report`; this is diagnostic state only, not account, token or credit authority.
- Treat all incoming JSON and imported files as untrusted, even when they come from the UI.
- Do not claim arbitrary imported STL clipping is exact CSG. The current implementation maps the STL onto a panel and clips triangles against panel/hole footprints. Door/perch holes dominate the decor. The viewer uses a permissive preview mesh so users can still see and position imported STL files; strict exports drop decor that becomes non-watertight rather than repairing it with a fake surface.

## Download billing contract

Current billed browser exports are:

- house STL (`export_house_stl`);
- cut plan SVG (`plan_preview_svg`);
- cut plan PNG;
- exploded assembly PNG;
- cut plan PDF.

Current free/local browser exports are:

- door STL (`export_door_stl`);
- wall-mount STL (`export_wall_mount_stl`);
- panels ZIP (`export_panels_zip`);
- calculations PDF;
- debug OBJ (`export_house_obj`);
- mesh report JSON (`mesh_report_json`).

For billed exports, `app/app.js` identifies this app as `app_id=nichoir`, asks PHP for `/api/exports/quote`, shows the credit/bonus gate if needed, calls `/api/exports/authorize`, generates the file locally from WASM or browser capture, then calls `/api/exports/consume`. WASM must not skip or replace that server-side flow.

Admin sessions are handled entirely by PHP/JavaScript. If PHP reports an admin session, premium exports still use quote/authorize/consume but with `cost=0`; WASM is unaware of that policy and only returns bytes/text.

## Current drift

- Export-size ceilings for very large meshes/STL/ZIP are still an open hardening item.
- The unused `credits_three` translation key still exists in `src/lib.rs`; it must not be used for visible credit pricing.

## Validation after changes

```bash
cd wasm
cargo check
cargo test
wasm-pack build --target web
```

After rebuilding `wasm/pkg`, run:

```bash
cd /home/marc/Documents/nichoir16
node scripts/mesh-smoke.mjs
```

Open the app in French and English after UI/i18n changes and confirm Rust-rendered labels do not fall back to raw keys.

Topology expectations:

- ZIP panel parts and surviving `deco_*` parts should have `open_edges=0`, `non_manifold_edges=0` and `watertight=true`.
- `house.stl` should have no open edges, but it can report over-shared/non-manifold contact edges because it is an assembly of touching panels, not a CSG union.
