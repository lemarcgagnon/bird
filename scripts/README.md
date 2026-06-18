# Scripts

Local validation and packaging scripts. They are not runtime production entry points.

## Files

- `mesh-smoke.mjs`: loads `wasm/pkg`, generates several presets, validates binary STL sizes, imported STL decor handling, ZIP entries, OBJ output, mesh report values and topology. It fails on open edges for the full house, fails on open/non-manifold edges for every ZIP part, and allows only known over-shared assembly-contact edges on the combined `house.stl`.
- `build-cpanel-artifact.sh`: creates a local `public_html/` + `nichoir_private/` artifact for Namecheap/cPanel by allowlist. It includes PHP runtime files, SQL migration files, prebuilt browser assets, `wasm/pkg` runtime files and local Three.js from `app/vendor/`.

## Usage

Run the mesh smoke test after Rust geometry/export changes and after rebuilding `wasm/pkg`:

```bash
node scripts/mesh-smoke.mjs
```

Build a cPanel artifact:

```bash
scripts/build-cpanel-artifact.sh /tmp/nichoir-cpanel-artifact
```

The artifact script refuses to overwrite an existing output path. Remove the old artifact yourself or choose a new directory.

The script fails if README files, Markdown docs, `docs/`, `documentation/`, installer files, dev scripts, test folders, `.git`, `.github`, `.env`, real `production.php`, SQLite/DB files, generated config locks, logs, demo/dev login strings or CDN Three.js references are present in the generated artifact.

The generated cPanel wrapper defaults to production. Without private MySQL/MariaDB config, `/api/health` should fail closed with `configuration_error`; with valid config, it should return `env=production` and `db_driver=mysql`.

If decoration clipping or imported STL handling changes, the smoke test should keep proving that exported `deco_*` ZIP entries are watertight. A decor that cannot remain watertight after clipping should be absent from the export rather than emitted with open or non-manifold edges.

## Rules

- Keep scripts deterministic and network-free.
- Do not make scripts depend on local secrets.
- Do not copy repository documentation, installer files, dev scripts, tests, Rust source, `.git`, DB files, logs, archives or secrets into the cPanel artifact.
- Rebuild WASM before running `mesh-smoke.mjs` if `wasm/src/lib.rs` changed.
