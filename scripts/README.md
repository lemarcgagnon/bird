# Scripts

Local validation and packaging scripts. They are not runtime production entry points.

## Files

- `mesh-smoke.mjs`: loads `wasm/pkg`, generates several presets, validates binary STL sizes, basic watertightness for separate parts, ZIP entries, OBJ output and mesh report values.
- `build-cpanel-artifact.sh`: creates a local `public_html/` + `nichoir_private/` artifact for Namecheap/cPanel without copying source-only folders, docs, installer, SQLite data, logs or dev files into the public tree. It includes prebuilt browser assets, `wasm/pkg` runtime files and local Three.js from `app/vendor/`.

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

The generated cPanel wrapper defaults to production. Without private MySQL/MariaDB config, `/api/health` should fail closed with `configuration_error`; with valid config, it should return `env=production` and `db_driver=mysql`.

## Rules

- Keep scripts deterministic and network-free.
- Do not make scripts depend on local secrets.
- Do not copy `installation/`, `docs/`, `server/`, `server-php/src`, `server-php/data`, `server-php/migrations`, Rust source, `.git`, DB files, logs, archives or secrets into `public_html/`.
- Rebuild WASM before running `mesh-smoke.mjs` if `wasm/src/lib.rs` changed.
