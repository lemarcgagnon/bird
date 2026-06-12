# Scripts

Role: scripts de validation et diagnostic local. Ils ne sont pas dans le chemin critique runtime de production.

Fichiers importants:

- `mesh-smoke.mjs`: charge `wasm/pkg`, genere plusieurs presets, valide STL/ZIP/mesh report et detecte des regressions grossieres.

Regles d'usage:

- Executer apres une modification de `wasm/src/lib.rs` ou des exports app.
- Reconstruire `wasm/pkg` avant ce script si le Rust a change.
- Garder les scripts deterministes et sans dependance reseau.

Validation utile:

```bash
node scripts/mesh-smoke.mjs
```
