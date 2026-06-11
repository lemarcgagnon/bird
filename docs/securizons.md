# Securisons Nichoir WASM

Date: 2026-06-11

Objectif: reduire les risques d'attaque dans l'app Nichoir WASM tout en gardant le calcul, la geometrie et les exports cote client. Le serveur futur servira surtout a l'autorisation/licence/facturation, pas au calcul lourd.

## 1. Principe general

L'app ne doit jamais faire confiance aux donnees utilisateur, meme si tout tourne dans le navigateur.

Surfaces a proteger:

- Fichiers importes: SVG, PNG, JPG/JPEG, GIF, WEBP.
- Parametres UI: sliders, champs numeriques, toggles.
- JSON envoye au WASM.
- Decodeurs image Rust/WASM.
- Generation mesh/STL/ZIP.
- Future couche d'autorisation/facturation.

## 2. Risques principaux

### SVG

Un SVG peut contenir autre chose que de la geometrie:

- scripts;
- events inline comme `onload`, `onclick`;
- `foreignObject` avec HTML embarque;
- references externes;
- CSS avec `@import`;
- liens `href` ou `xlink:href` vers reseau;
- definitions enormes ou tres complexes;
- chemins/path tres longs.

Meme sans backend, un SVG malveillant peut viser le navigateur, saturer la memoire ou ralentir l'app.

### Images raster

PNG/JPG/GIF/WEBP peuvent poser probleme:

- fichier trop gros;
- dimensions decodees enormes;
- decompression bomb;
- GIF anime tres lourd;
- image volontairement creee pour faire planter un decodeur;
- explosion du nombre de triangles si la resolution heightmap est trop haute.

### Inputs numeriques

Les champs utilisateur peuvent causer:

- `NaN`;
- `Infinity`;
- valeurs negatives absurdes;
- dimensions enormes;
- profondeur relief trop grande;
- resolution heightmap trop haute;
- STL/ZIP gigantesque;
- mesh non fini ou impossible a imprimer.

## 3. Mesures obligatoires a ajouter

### 3.1 Validation fichier avant lecture

Cote JS, avant de lire un fichier:

- taille max fichier: `10 MB` par defaut;
- extensions acceptees: `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`;
- MIME accepte si disponible: `image/svg+xml`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`;
- refuser tout autre type.

Pour GIF:

- utiliser comme image fixe seulement;
- ne pas supporter l'animation dans la premiere version securisee.

### 3.2 Sanitization SVG

Avant rasterisation SVG:

- refuser `<script>`;
- refuser `<foreignObject>`;
- refuser `<iframe>`;
- refuser `<object>`;
- refuser `<embed>`;
- refuser les attributs `on...=`;
- refuser `href="http..."` et `xlink:href="http..."`;
- refuser `@import`;
- limiter la longueur du texte SVG;
- ne jamais injecter le SVG brut dans `innerHTML`.

Approche recommandee:

- parser le SVG comme texte;
- appliquer une fonction `sanitizeSvgText(svgText)`;
- si un pattern interdit est detecte, refuser le fichier avec message clair;
- rasteriser seulement le SVG sanitise.

### 3.3 Limites rasterisation

Pour la rasterisation SVG vers PNG:

- taille canvas max: `1024 x 1024`;
- taille par defaut: `resolution * 4`, clamp entre `64` et `1024`;
- pas de chargement reseau externe;
- fond controle localement par l'app.

### 3.4 Validation image decodee cote Rust/WASM

Cote Rust, apres decode image:

- refuser si largeur ou hauteur inferieure a `2`;
- refuser si largeur ou hauteur superieure a `4096`;
- refuser si `width * height` depasse un plafond, par exemple `16_777_216` pixels;
- refuser si decode impossible;
- retourner un mesh vide ou une erreur structuree, pas un panic.

## 4. Validation des parametres WASM

Ajouter une fonction Rust de normalisation stricte, par exemple:

```rust
fn sanitize_params(mut p: NichoirParams) -> NichoirParams {
    p.w = clamp_finite(p.w, 80.0, 400.0, 160.0);
    p.h = clamp_finite(p.h, 80.0, 500.0, 220.0);
    p.d = clamp_finite(p.d, 80.0, 400.0, 160.0);
    p.slope = clamp_finite(p.slope, 10.0, 60.0, 45.0);
    p.t = clamp_finite(p.t, 3.0, 25.0, 12.0);
    p
}
```

Champs decor a limiter:

- largeur decor: `5..400 mm`;
- hauteur decor: `5..400 mm`;
- profondeur: `0.2..20 mm`;
- resolution heightmap: `8..256`;
- smooth: `0..100`;
- bevel: `0..100`;
- threshold: `0..60`;
- rotation: `0..360`;
- source text SVG max: par exemple `1 MB`;
- source data base64 max: par exemple `15 MB`.

Regle importante:

- Les limites UI ne suffisent pas.
- Les limites doivent exister dans Rust/WASM aussi.

## 5. Protection exports STL/ZIP

Avant export:

- refuser mesh vide;
- refuser valeurs non finies;
- refuser triangle count trop haut;
- refuser taille STL estimee trop haute;
- garder `mesh_report_json` comme diagnostic.

Plafonds proposes:

- STL maison complete: max `1_000_000` triangles;
- chaque piece ZIP: max `500_000` triangles;
- ZIP final: max `250 MB` en premiere version;
- resolution par defaut raisonnable: `64` ou `128`, pas `256`.

## 6. Backend futur et facturation

Le client/WASM ne doit pas etre considere comme une protection forte.

Pour la future facturation/licence:

- le serveur valide session/licence;
- le serveur ne fait pas les calculs lourds;
- le serveur emet un token court terme;
- l'app verifie ce token pour debloquer certaines fonctions;
- Stripe ou autre paiement reste cote serveur;
- ne jamais mettre les secrets Stripe dans le WASM;
- ne jamais faire confiance a une verification uniquement cote client.

Objectif realiste:

- Le WASM protege mieux que HTML/JS clair contre la copie directe.
- Mais il ne remplace pas une vraie autorisation serveur.

## 7. Plan d'implementation recommande

### Phase 1: securite fichiers

- Ajouter `sanitizeSvgText` dans `app/app.js`.
- Ajouter limite taille fichier.
- Ajouter messages d'erreur utilisateur.
- Rejeter SVG dangereux avant rasterisation.

### Phase 2: validation Rust

- Ajouter `sanitize_params`.
- Appliquer `sanitize_params` dans toutes les entrees WASM:
  - `render_app_html`;
  - `scene_meshes_json`;
  - `export_house_stl`;
  - `export_house_obj`;
  - `export_door_stl`;
  - `export_panels_zip`;
  - `mesh_report_json`;
  - `plan_preview_svg`.

### Phase 3: limites mesh/export

- Ajouter plafonds triangles.
- Ajouter refus export si STL trop gros.
- Ajouter diagnostic clair dans `mesh_report_json`.

### Phase 4: autorisation/facturation

- Ajouter mini serveur d'autorisation.
- Tester SQLite local.
- Ajouter Stripe plus tard.
- Garder calcul client-side.

## 8. Checklist rapide

- [ ] Refuser fichier > 10 MB.
- [ ] Refuser SVG avec scripts/events/foreignObject/liens externes.
- [ ] Refuser raster > 4096 x 4096.
- [ ] Clamper tous les inputs en Rust.
- [ ] Refuser `NaN`/`Infinity`.
- [ ] Limiter triangles STL/ZIP.
- [ ] Garder GIF comme image fixe.
- [ ] Ne jamais injecter SVG brut dans `innerHTML`.
- [ ] Ne jamais stocker secrets dans WASM.
- [ ] Ajouter tests avec fichiers invalides.
