# Nichoir WASM

Application web pour concevoir un nichoir parametrable, visualiser le modele 3D et exporter des fichiers de fabrication. Cette version migre la logique principale vers Rust compile en WebAssembly afin que les calculs, la geometrie et les exports s'executent cote client.

## Objectif du projet

Le but est de remplacer l'ancienne app HTML/JavaScript par une app WASM plus difficile a copier directement et plus robuste pour la generation de geometrie.

Principes du projet:

- Le navigateur calcule le modele, les pieces, le plan de coupe et les exports.
- Le serveur futur sert seulement a l'autorisation, licence et facturation.
- Les fichiers STL/OBJ/ZIP sont generes localement pour eviter les couts CPU et transfert serveur.
- `nichoir_v16.html` reste une reference fonctionnelle historique, pas l'app finale.

## Lancer l'app localement

Depuis la racine du projet:

```bash
php -S 127.0.0.1:8020 -t /home/marc/Documents/nichoir16
```

Puis ouvrir:

```text
http://127.0.0.1:8020/app/index.html
```

Si le navigateur garde une ancienne version, faire `Ctrl+F5`.

## Compiler le WASM

Prerequis:

```bash
rustc --version
wasm-pack --version
```

Build:

```bash
cd /home/marc/Documents/nichoir16/wasm
wasm-pack build --target web
```

Le package genere est dans:

```text
wasm/pkg/
```

Ce dossier est utilise par `app/app.js`.

## Structure du projet

```text
app/
  index.html      Coquille web minimale
  app.js          Glue JS, viewer Three.js, telechargements
  style.css       Interface, light/dark mode

wasm/
  Cargo.toml
  src/lib.rs      Logique Rust/WASM: UI, geometrie, calculs, exports
  pkg/            Sortie wasm-pack

docs/
  reste-a-faire.md  Etat fonctionnel et roadmap
  securizons.md     Notes de securite fichiers/inputs/WASM

server/
  Mini API FastAPI/SQLite pour tester une future autorisation/licence

scripts/
  mesh-smoke.mjs  Smoke test mesh/STL

nichoir_v16.html  Ancienne reference fonctionnelle
rust-plan.md      Plan de migration Rust/WASM
```

## Fonctionnalites principales

- Dimensions en `mm`, `cm` et `in`.
- Largeur, hauteur, profondeur, epaisseur et evasement.
- Plancher `enclave` ou `pose`.
- Toit avec pente, debordement pluie et jonction de crete.
- Jonction de crete `gauche`, `droit` ou `onglet`.
- Porte `aucune`, `ronde`, `carree` ou `pentagonale`.
- Panneau de porte optionnel.
- Perchoir cylindrique optionnel.
- Jusqu'a quatre trous de suspension dans le toit.
- Viewer 3D avec modes plein, filaire, rayons X et aretes.
- Mode eclate.
- Recentrage de la vue.
- Light mode et dark mode.
- Interface avec divulgation progressive pour reduire les menus.

## Decorations

La section `Decor` permet d'importer des fichiers pour generer du relief sur les panneaux.

Formats supportes:

- SVG
- PNG
- JPG/JPEG
- GIF comme image fixe
- WEBP

Modes:

- `Vectoriel`: extrusion simple de formes SVG.
- `Heightmap`: relief selon la luminance de l'image.

Controles disponibles:

- taille;
- position;
- rotation;
- profondeur;
- resolution;
- suppression optionnelle du fond blanc/transparent;
- inversion;
- autosmooth;
- bevel/chamfer;
- seuil anti-bruit;
- clipping au panneau.

Sur la facade avant, le decor est coupe pour ne pas recouvrir la porte d'entree ou le trou du perchoir.

## Exports

Exports actuellement disponibles:

- STL maison complete;
- OBJ maison complete pour debug;
- STL porte;
- ZIP de panneaux separes;
- plan de coupe SVG.

Important pour l'impression 3D:

- Les pieces separees du ZIP sont l'objectif principal pour fabrication par panneaux.
- Le STL maison complete est un assemblage de panneaux en contact.
- Pour une maison complete parfaitement fusionnee en un seul solide manifold, il faudra ajouter une vraie union booleenne/CSG.

## Plan de coupe

Le plan de coupe utilise:

- formats de panneaux commerciaux;
- dimensions custom;
- trait de scie;
- placement 2D des pieces;
- statistiques d'utilisation.

Les valeurs affichees respectent l'unite choisie par l'utilisateur.

## Tests et diagnostics

Build WASM:

```bash
cd wasm
wasm-pack build --target web
```

Smoke test mesh:

```bash
node scripts/mesh-smoke.mjs
```

Diagnostic depuis l'interface:

- bouton `Rapport mesh`;
- export OBJ pour ouvrir dans Blender ou inspecter la geometrie.

## Securite

Le document detaille est ici:

```text
docs/securizons.md
```

Points importants:

- Ne jamais faire confiance aux fichiers importes.
- Sanitize les SVG avant rasterisation ou extrusion.
- Limiter la taille des fichiers et images decodees.
- Clamper les inputs numeriques cote Rust/WASM, pas seulement dans l'UI.
- Refuser les meshes vides, non finis ou trop lourds avant export.
- Ne jamais placer de secrets Stripe ou licence dans le WASM.

## API licence de test

Le dossier `server/` contient une mini API FastAPI/SQLite pour tester l'autorisation.

Demarrage:

```bash
cd /home/marc/Documents/nichoir16/server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8018
```

Cette API ne fait pas la geometrie. Elle servira seulement a valider une session/licence avant activation de fonctions payantes.

Stripe sera ajoute plus tard cote serveur.

## Roadmap courte

- Finaliser la parite fonctionnelle avec `nichoir_v16.html`.
- Continuer le nettoyage HIG de l'interface.
- Ajouter les coupes X/Y/Z dans le viewer.
- Completer la parite du plan de coupe.
- Ajouter une suite de tests de parite entre presets.
- Renforcer la validation securite des fichiers et inputs.
- Etudier une union booleenne/CSG pour produire une maison complete fusionnee.
- Brancher la licence serveur, puis Stripe.

## Branche de sauvegarde

L'ancien `main` GitHub a ete sauvegarde dans:

```text
avant-le-wsam
```

La branche `main` contient maintenant la version Rust/WASM.
