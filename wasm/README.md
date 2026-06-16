# Nichoir Rust/WASM core

This folder contains the Rust crate compiled to WebAssembly for the birdhouse designer.

## Files

- `Cargo.toml`: Rust crate configuration and WASM dependencies.
- `src/lib.rs`: Rust/WASM implementation. This file currently contains UI rendering strings, i18n lookup, geometry calculations, mesh/export generation, SVG/image decoration handling, and WASM exports called by `app/app.js`.
- `pkg/`: generated `wasm-pack build --target web` output used by the browser app.

## Current ownership

- Birdhouse dimensions, unit conversion, derived measures, panel geometry, roof/floor/door/perch behavior, and mesh generation.
- Rust-rendered control markup and labels for dense app UI sections.
- Rust-side French/English translation table for labels rendered from Rust.
- Export helpers for fabrication outputs used by the JavaScript download flow.
- Client-side validation/clamping for geometry-heavy inputs.

## Boundaries

- Do not put Stripe, account, session, SMTP, admin, or credit-policy truth in Rust/WASM.
- Do not assume a fixed credit cost in Rust labels. Credit policy belongs to PHP.
- Keep browser/API/network orchestration in `app/app.js`.

## Known current drift

- The French `deco_clip` label currently says `Clipper au panneau (a venir)`. Replace it with intentional disabled-state copy or finish the feature.

## Validation after changes

1. Run `cargo check --target wasm32-unknown-unknown` from `wasm/`.
2. When exports or public WASM bindings change, run the project WASM build command: `wasm-pack build --target web`.
3. Run `node scripts/mesh-smoke.mjs` after rebuilding `wasm/pkg` when geometry/export behavior changes.
4. Open the app in French and English and confirm Rust-rendered labels do not fall back to raw keys.
