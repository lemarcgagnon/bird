# Module Rust/WASM

Role: coeur de calcul local. Ce dossier contient la logique Rust compilee en WebAssembly pour les parametres, la geometrie, les previews, les diagnostics mesh et les exports.

Fichiers importants:

- `src/lib.rs`: API exposee au navigateur via `wasm-bindgen`, generation HTML, scene meshes, STL/OBJ/ZIP/PDF helpers et traitement decor.
- `Cargo.toml`: dependances Rust et configuration du crate `cdylib`.
- `pkg/`: sortie generee par `wasm-pack build --target web`; ce dossier est consomme par `app/app.js`.

Regles d'architecture:

- Le WASM est le slave calcul: il ne decide pas des droits, credits ou abonnements.
- Le serveur PHP autorise et debite; le WASM produit les fichiers localement.
- Les inputs doivent etre consideres non fiables meme s'ils viennent de l'UI.
- Ne pas ajouter d'appel reseau ni de secret dans Rust/WASM.

Points de vigilance:

- `sanitize_params` normalise les entrees JSON principales avant calcul: dimensions, modes, unites, panneaux, porte, perchoir, trous, decor et sources.
- Les images decor decodees sont refusees si elles depassent `4096 x 4096` ou `16_777_216` pixels.
- Ajouter des plafonds mesh/export pour eviter des STL/ZIP trop lourds.
- Garder `mesh_report_json` comme outil de diagnostic rapide.
- Apres changement Rust, reconstruire `wasm/pkg`.

Validation utile:

```bash
cd wasm
cargo test
wasm-pack build --target web
```
