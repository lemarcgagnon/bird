# Nichoir Rust/WASM core

This folder contains the Rust crate compiled to WebAssembly for the birdhouse designer. It is the client-side calculation and fabrication engine.

## Files

- `Cargo.toml`: Rust crate configuration. The crate builds as `cdylib`/`rlib` and uses `wasm-bindgen`, `serde`, `serde_json`, `earcutr`, `base64` and `image`.
- `Cargo.lock`: locked Rust dependency graph.
- `src/lib.rs`: UI markup, i18n lookup, parameter sanitization, geometry calculations, mesh generation, decoration handling, cut-plan SVG generation and WASM exports called from `app/app.js`.
- `pkg/`: generated `wasm-pack build --target web` output used by the browser app. The directory is ignored by Git and can be regenerated.

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
- `export_panels_zip(input)`
- `mesh_report_json(input)`

`app/app.js` wraps several outputs into browser downloads, including plan PNG/PDF, calculation PDF and exploded-view PNG.

## Current ownership

- Birdhouse dimensions, unit conversion, derived measures, panel geometry, roof/floor/door/perch behavior and mesh generation.
- Rust-rendered control markup and labels for dense app UI sections.
- Rust-side French/English translation table for labels rendered from Rust.
- SVG/image decoration parsing, heightmap/vector extrusion and panel/hole clipping.
- Export helpers for fabrication outputs used by the JavaScript download flow.
- Client-side validation/clamping for geometry-heavy inputs.

## Boundaries

- Do not put Stripe, account, session, SMTP, admin or credit-policy truth in Rust/WASM.
- Do not assume a fixed credit cost in Rust labels. Credit policy belongs to PHP.
- Keep browser/API/network orchestration in `app/app.js`.
- Treat all incoming JSON and imported files as untrusted, even when they come from the UI.

## Current drift

- The clip-to-panel decoration path is implemented, but the `deco_clip` label still says "coming later/bientot". The label should be corrected or the UI should expose the state more intentionally.
- Export-size ceilings for very large meshes/STL/ZIP are still an open hardening item.

## Validation after changes

```bash
cd wasm
cargo check --target wasm32-unknown-unknown
wasm-pack build --target web
```

After rebuilding `wasm/pkg`, run:

```bash
cd /home/marc/Documents/nichoir16
node scripts/mesh-smoke.mjs
```

Open the app in French and English after UI/i18n changes and confirm Rust-rendered labels do not fall back to raw keys.
