# Plan de reconversion en Rust + WebAssembly (NICHOIR v16)

Objectif: reprendre le fichier `nichoir_v16.html` (UI + géométrie + exports) vers une application fonctionnelle en Rust/WASM avec la même logique métier.

## Etat courant important

- La pente de toit par defaut de la nouvelle app Rust/WASM est maintenant `45 degres`.
- La geometrie des cotes tient compte de l'evasement: l'inset lateral utilise `T / cos(alpha)`.
- Les cotes ont une coupe basse plate pour le plancher et une coupe haute biseautee selon la pente du toit pour reduire les chevauchements visibles.
- Les panneaux `cote_gauche` et `cote_droit` du ZIP utilisent maintenant la meme logique biseautee que le viewer.
- Les pieces separees du ZIP sont verifiees watertight par smoke test.
- `maison_complete.stl` reste un assemblage de panneaux en contact. Pour une impression fiable en une seule piece, il faudra une phase CSG/boolean union ou une autre strategie de fusion de mesh.
- Les calculs et le plan affichent les angles et valeurs d'usinage: pente, angle des parois, retrait lateral, coupe haute des cotes et trait de scie.
- Le plan de coupe propose des formats de panneaux commerciaux et utilise le trait de scie comme espacement reel de placement.
- Les volumes, surfaces et dimensions de plan changent d'affichage selon `mm`, `cm` ou `in`; les valeurs internes restent en millimetres.
- Le viewer a maintenant une action de recentrage de camera.
- Le plancher enclave est maintenant genere avec chants lateraux biseautes: largeur dessous/dessus differenciees, retrait par cote affiche, export ZIP/maison/viewer alignes.

## 1) Référence de comportement à reproduire

`nichoir_v16.html` regroupe 5 axes fonctionnels :

1. **UI + interaction utilisateur**
   - Onglets: `DIM`, `VUE`, `DÉCOR`, `CALCULS`, `PLAN`
   - Sliders/checkboxes/selects + champ numérique lié (sync range <-> input)
   - Gestion unité: `mm / cm / in`
   - Contrôles de vue: solid / wireframe / xray / edges
   - Explode + sections x/y/z
   - Overlay d’info (mode / axes / hints)

2. **Génération géométrique du nichoir**
   - Paramètres principaux `P`: largeur `W`, hauteur `H`, profondeur `D`, pente `slope`, débord `overhang`, épaisseur `T`
   - Options:
     - assemblage plancher: `enclave | pose`
     - arête de toit: `left | right | miter`
     - évasement `taperX`
   - Pièces: façade avant/arrière (trapèze/pentagone), côtés, fond, toits gauche/droite
   - Porte: `none | round | square | pentagon`
   - Perchoir cylindrique optionnel
   - Panneau de porte optionnel (largeur variable par pourcentage)
   - Positionnement selon formule 3D identique au JS

3. **Décoration de panneaux**
   - 6 cibles: `front/back/left/right/roofL/roofR`
   - Chargement fichier SVG / PNG / JPG
   - Deux modes deco:
     - `vector` (extrusion SVG)
     - `heightmap` (relief depuis image)
   - Paramètres déco: taille, position, rotation, profondeur, bevel, résolution, inversion, recadrage sur panneau
   - Placement orientation selon type de panneau (même logique que `placeDecoOnPanel` actuel)

4. **Calculs, liste de coupes et plans de fabrication**
   - Volumes, surfaces, dimensions calculées dynamiquement
   - Tableau des pièces et dimensions
   - Plan de découpe 2D avec packing automatique + export PNG/SVG

5. **Exports**
   - STL: maison complète, porte seule, panneaux séparés ZIP
   - Triangulation existante utilisée pour conversion STL binaire (`trisToSTL`)
   - Export plan (PNG haute qualité, SVG vectoriel en mm)

---

## 2) Recommandation d’architecture Rust

### 2.1 Stack recommandée (pragmatique, maintenable)

- `wasm-bindgen` + `web-sys` pour le binding DOM/FIle API
- Framework UI: `yew` (ou `leptos` si on souhaite réactivité fine SSR-like)
- Moteur 3D: **d’abord** conserver `Three.js` via un mini-wrapper JS pour réduire le risque.
  - Rust fait la logique (`core`) et renvoie les données de triangles/meshes
  - Le rendu 3D côté JS reste stable dans un premier temps
- Export/pack:
  - STL: module Rust natif
  - ZIP: crate `zip`
  - Dessin plan/canvas PNG: générer en Rust via `web_sys::CanvasRenderingContext2d` (ou JS fallback)

Ce choix permet de livrer une app WebAssembly rapidement avec la logique métier en Rust, puis de remplacer le renderer JS plus tard si nécessaire.

### 2.3 Objectif commercial et protection du code

Le but produit est de facturer l'utilisation sans livrer toute la logique métier en HTML/JS lisible. La stratégie cible est :

1. Garder seulement une coquille HTML/JS minimale côté navigateur.
2. Déplacer les calculs, la géométrie, les exports et les validations dans Rust/WASM.
3. Garder la gestion client hors WASM : compte, session, credits, abonnement, paiement, messages et tickets.
4. Ajouter une validation serveur avant chaque téléchargement/export payant.
5. Garder côté serveur ce qui doit rester secret :
   - clés de licence,
   - vérification d'abonnement,
   - quotas,
   - génération de jetons signés,
   - liens Stripe Checkout,
   - historique de consommation,
   - messages et tickets support.

Important : WASM complique fortement la copie directe du code par rapport à HTML/JS, mais ce n'est pas une protection absolue. Un binaire WASM peut être analysé. Pour la facturation, la vraie barrière doit être une licence ou session validée côté serveur.

Pour le test local, l'autorisation doit utiliser PHP + SQLite afin de rester proche du serveur de production vise. MySQL et Stripe viendront plus tard quand le flux compte/credits/paiement sera stabilisé.

Architecture produit cible autour de l'app:

- `/`: landing page PHP publique, avec proposition de valeur et appel vers inscription/app.
- `/pricing`: credits, abonnements et limites commerciales.
- `/app/`: app Rust/WASM.
- `/account`: espace client PHP pour profil, credits, abonnement, factures et tickets.
- `/admin`: admin PHP prive pour gerer clients, credits, abonnements, paiements, consommations et tickets.
- `/api/...`: API JSON PHP consommee par l'app et l'espace client.
- `/stripe/webhook`: endpoint PHP appele par Stripe pour synchroniser paiements et abonnements.

Règle d'architecture :

- WASM calcule et génère les fichiers localement.
- L'API ne reçoit pas la géométrie et ne génère pas les STL/PDF/ZIP.
- L'API répond seulement aux questions commerciales : qui est l'utilisateur, combien de credits reste-t-il, ce téléchargement est-il autorisé, combien faut-il débiter.
- Les pages publiques, l'espace client, l'admin, les webhooks Stripe et les secrets restent hors WASM.
- Le serveur PHP est le maitre de la relation client; l'app WASM est un client esclave qui affiche un resume et appelle l'API.
- Toute gestion complete du compte, des tickets, des factures ou abonnements doit pointer vers `/account` ou `/pricing`, pas etre dupliquee dans l'app.

### 2.2 Option “full Rust rendering” (phase 2)

- `three-d` ou équivalent WebGPU/WebGL en Rust si on veut éliminer la dépendance Three.js plus tard.
- Cette option augmente fortement la complexité des contrôles caméra/clipping; à faire après une version fonctionnelle.

---

## 3) Structure projet cible

```text
nichoir16/
├─ Cargo.toml
├─ src/
│  ├─ lib.rs                     # wasm-bindgen exports
│  ├─ model.rs                   # state P, unités, enums, sérialisation
│  ├─ geometry/
│  │  ├─ loft.rs                # générateur de pentagone, parois latérales, toit
│  │  ├─ panels.rs              # assemblage des pièces, ancres, transforms
│  │  ├─ door.rs                # logique porte + perchoir + trou
│  │  ├─ deco_geometry.rs       # vector/heightmap -> mesh local
│  │  ├─ tri.rs                 # extraction triangles/world -> STL
│  │  └─ clip.rs                # clipping panel / sections x y z
│  ├─ calc/
│  │  ├─ measurements.rs        # volumes/surfaces/formats
│  │  └─ cut_layout.rs          # packing de planches + SVG export
│  ├─ io/
│  │  ├─ svg.rs                # parsing SVG to shapes
│  │  ├─ raster.rs             # rasterization/lecture PNG/JPG
│  │  ├─ stl.rs                # encode STL binaire
│  │  └─ pack.rs               # zip + blobs/download helpers
│  ├─ cam.rs                    # vue orbit/pan/zoom (state caméra)
│  └─ ui_bridge.rs              # helpers sérialisation état <-> interface
├─ pkg/                          # généré par wasm-pack
├─ app/
│  ├─ index.html                 # coquille minimale hôte du module WASM
│  ├─ app.js                     # glue JS temporaire
│  └─ style.css                  # style de la nouvelle app
├─ nichoir_v16.html              # référence fonctionnelle, pas l'app finale
└─ rust-plan.md
```

---

## 4) Port par phases (ordre d’exécution)

### Phase 0 — Base de projet

1. Initialiser `cargo new --lib` + `wasm-pack`.
2. Config `wasm-bindgen`, `serde`, `serde_json`, `nalgebra`/`glam`, `zip`, `bytemuck`, `image` (si raster côté Rust).
3. Créer un bridge minimal:
   - `set_params(json)`
   - `compute_model() -> mesh payload`
   - `compute_calcs() -> json`
   - `compute_plan_layout() -> plan payload`
   - `export_house_stl()`, `export_door_stl()`, `export_panels_zip()`

### Phase 1 — Port des données + unités (priorité haute)

1. Reprendre `P`, `clip`, `decos` en structs Rust.
2. Implémenter `UNIT_DEFS` et conversions (mm/cm/in) + formatteurs (`formatLength`, `formatArea`, `formatVolume`).
3. Porter la logique de synchronisation de valeurs (range + num input) dans Rust ou conserver le binding JS pendant phase initiale.
4. Porter les états UI (`activeDecoKey`, `mode`, onglets, toggles).

### Phase 2 — Géométrie cœur (sans déco)

1. Port `mkPent` en Rust:
   - profil trapézoïdal
   - trous porte (round / square / pentagon avec pente optionnelle)
   - trou perchoir
2. Port `mkHexPanel`.
3. Port de `rebuildPanels`:
   - calculs `wallH`, `rH`, `Wtop/Wbot`, `sideD`, `sL_L/sL_R`, etc.
   - production d’un graphe de pièces avec matrice transform + userData (clés de panneau).
4. Validation: comparer 1) nombre/ordre des pièces, 2) dimensions clés par rapport à HTML original.

### Phase 3 — Affichage et caméra

1. Rebrancher la scène Three.js existante pour consommer des données Rust:
   - soit via JSON de vertices+indices directement,
   - soit via “commands” (`add_mesh(panel_key, triangles, color)`).
2. Reproduire overlays/vues:
   - solid/wireframe/xray/edges
   - explode (`eDist`)
   - clipping x/y/z
3. Reproduire interactions souris/tactile:
   - orbit, pan, zoom, reset.

### Phase 4 — Décorations

1. Modélisation état déco (par panneau) + defaults.
2. SVG:
   - parser Rust via `usvg`/`resvg` + conversion en contours
   - remap bbox en `(w, h)` + flip Y
   - extrusion triangulée (bevel limité à 30%)
3. Heightmap:
   - chargement PNG/JPG via browser File API -> `Vec<u8>` RGBA
   - génération d’une grille de hauteur (`depth * luminance`) avec inversion optionnelle
4. Placement:
   - implémenter `place_deco_on_panel` pour 6 cibles, mêmes conventions locales que JS.
5. Gestion clip-to-panel:
   - calcul des plans (ou filtrage bbox dans l’espace panneau si on choisit un mode simplifié)

### Phase 5 — Calculs + plan de coupe + table de pièces

1. Port `updateCalcs`:
   - volumes, surfaces, dimensions façade/côtés/toit, notes texte (trapèze/évasé/réduit, etc.)
2. Port `computeCutLayout`:
   - calcul des pièces (`front/back/left/right/bottom/roof/porte`)
   - tri par hauteur
   - bin-packing 2D par étagères (shelf-pack)
3. Rendus plan:
   - Vue canvas (fond, grille 200x200, pièces, légende overflow)
   - Export PNG (échelle x2)
   - Export SVG (mm réels)

### Phase 6 — Export STL/ZIP/PNG

1. Port de `meshTriangles` + `collectPanelTris`.
2. Générer STL binaire par pièce/ensemble.
3. Export maison / porte / ZIP panneaux
4. ZIP via crate Rust + déclenchement téléchargement navigateur via wasm-bindgen.

### Phase 7 — Polissage

1. Refactoring UI pour composants Yew (tabs, sliders, labels).
2. Gestion des erreurs en français (parser SVG, chargement image, export vide).
3. Préparer migration renderer Rust:
   - map stable `SceneDescription` déjà en place pour rendre dans un renderer Rust sans toucher la logique.

---

## 5) Décisions techniques clés

### 5.1 Où porter en priorité

- Priorité 1 (logique pure): `model`, `calc`, `geometry`, `export` en Rust.
- Priorité 2 (interop): bindings `wasm-bindgen` + UI actions.
- Priorité 3 (visuel): rendu 3D.

### 5.2 Stratégie anti-régression

- Garder des tests unitaires Rust pour:
  - `Wtop/Wbot/rH/roof lengths` (cas de pente/taper/floor/ridge).
  - position de porte et perchoir.
  - volumes approximatifs et nombre de faces attendues.
- Comparer sorties JSON de `compute_calcs` sur fixtures “référence”.

### 5.3 Contraintes connues

- Parsing SVG en Rust est plus complexe qu’avec `getPointAtLength` natif.
- `heightmap` dépend d’un flux binaire image cohérent; prévoir fallback propre si largeur/hauteur invalide.
- Le vrai clipping matériel 3D peut être simplifié initialement (même si visuellement acceptable) puis amélioré.

---

## 6) Détail de mapping fonctionnel (JS → Rust)

- `const P` + setters → `model::Params`
- `rebuild()` → pipeline `build_model(params, decos, clip_state, view_state)`
- `rebuildPanels()` → `geometry::build_panels(...)`
- `mkPent` → `geometry::mk_pent(...)`
- `mkHexPanel` → `geometry::mk_side_panel(...)`
- `buildDecoGeo` → `deco_geometry::build(...)`
- `placeDecoOnPanel` → `deco_geometry::place_on_panel(...)`
- `updateCalcs()` → `calc::compute_stats(...)`
- `computeCutLayout()` → `cut_layout::compute(...)`
- `updateCutPlan()/draw` → `ui::plan_canvas` + `calc` payload
- `trisToSTL` + `collectPanelTris` → `stl::triangles_to_stl(...)`
- `export*` → `io::pack::*` + wasm download
- Unit bindings `bindS/bindPct` → `ui_bindings::bind_length_input(...)` / `bind_pct_input(...)` ou JS équivalent

---

## 7) Livraison minimale (MVP)

État à considérer “usable”:

1. Paramètres + recalcul en Rust.
2. Vue 3D générée (même via Three.js) + orbit.
3. Export STL maison/porte + plan PNG.
4. Calculs affichés dans l’onglet CALCULS.

Puis itérer vers:

5. Décorations complètes + ZIP panneaux + export SVG plan + clipping + compatibilité unités.

---

## 8) Checklist de démarrage immédiat

- [ ] Init du workspace Rust + configuration wasm.
- [ ] Copier la structure UI (tabs + controls) dans Rust.
- [ ] Porter `P`, `UNIT_DEFS`, `rebuild()` pipeline et `updateCalcs`.
- [ ] Porter `rebuildPanels` + STL export.
- [ ] Ajout décoration (vector + image), puis plan de coupe.
- [ ] Référencer ce plan dans chaque PR de feature.

## 9) Statut actuel (à exécuter maintenant)

- [x] Initialisation `cargo init --lib` dans `/home/marc/Documents/nichoir16/wasm`.
- [x] Ajout des bindings wasm de base (`compute_summary`, `compute_stats`, `compute_cut_layout`, `export_house_stl`, `export_door_stl`).
- [x] Corrections cargo/wasm pack :
  - `Cargo.toml`: `crate-type = ["cdylib", "rlib"]` ajouté.
  - Erreurs de compilation restantes corrigées dans `src/lib.rs` :
    - `GeometryPayload` clonable pour éviter la fuite de mouvement vers `StatsPayload`.
    - `shelf_h` typé `f64` pour éviter `max()` ambigu.
- [x] Plan de migration front (Nichoir v16) commencé dans `nichoir_v16.html` :
  - `compute_summary`/`compute_cut_layout`/`export_house_stl`/`export_door_stl`/`plan_preview_svg` utilisés en priorité.
  - Fallback JS automatique si WASM indisponible (calculs, découpe, STL panneau, plan).
  - Gestion des blobs WASM (`Uint8Array`) + conversion de layout pour rendu canvas/SVG.
- [x] Export ZIP panneaux migré en priorité WASM :
  - `export_panels_zip` ajouté côté Rust.
  - `exportPanelsZIP()` appelle maintenant WASM puis fallback JS si nécessaire.
  - ZIP généré sans dépendance Rust externe additionnelle.
- [x] Mini backend d'autorisation ajouté en FastAPI/SQLite :
  - endpoints `/health`, `/dev/bootstrap`, `/auth/login`, `/license/status`.
  - base locale `server/nichoir16.db`.
  - utilisateur demo configurable via `.env`.
- [x] Nouvelle entrée d'app WASM autonome commencée :
  - `app/index.html` remplace `nichoir_v16.html` comme cible de développement.
  - `app/app.js` est une glue minimale pour charger le module WASM.
  - `render_app_html` et `default_params_json` ajoutés côté Rust.
  - Le rendu principal de cette nouvelle app vient déjà de Rust.
- [x] Interface autonome enrichie depuis la référence v16 :
  - onglets/sections `Corps`, `Toiture`, `Porte`, `Plan`.
  - contrôles Rust pour dimensions, plancher, toiture, crête, porte, perchoir, panneau.
  - début d'i18n dans Rust via `t(lang, key)`.
  - `app.js` reste limité aux événements génériques et aux téléchargements.
- [x] Première géométrie STL cœur déplacée dans Rust :
  - `export_house_stl` assemble maintenant des panneaux Rust au lieu d'un bloc simplifié.
  - façades pentagonales extrudées selon `Wtop/Wbot/wallH/roofH`.
  - toiture gauche/droite inclinée selon la pente.
  - ZIP panneaux utilise des façades pentagonales Rust.
  - porte exportée comme forme extrudée (`round`, `square`, `pentagon`).
- [x] Rendu visuel branché sur géométrie Rust :
  - `scene_meshes_json` ajouté côté Rust.
  - `app/app.js` convertit seulement le payload Rust en `THREE.BufferGeometry`.
  - Three.js est maintenant le viewer, pas la source de vérité géométrique.
  - le faux aperçu CSS a été remplacé par un canvas WebGL.
- [x] Fonctions de vue portées dans l'app autonome :
  - modes `solid`, `wireframe`, `xray`, `edges`.
  - explode calculé côté Rust dans le payload de meshes.
  - orbit, pan et zoom ajoutés au viewer Three.js.
- [x] Layout visuel rapproché de v16 :
  - sidebar compacte à onglets `DIM`, `VUE`, `DÉCOR`, `CALCULS`, `PLAN`.
  - viewport 3D dominant à droite.
  - calculs, liste des pièces et exports replacés dans les onglets.
  - overlay mode/plancher/crête et repères d'axes ajoutés.
- [x] Passe de logique fonctionnelle :
  - correction des listeners d'onglets pour éviter les doublons à chaque clic.
  - nettoyage minimal des ressources Three.js quand la scène est reconstruite.
  - correction du SVG de plan (`height` de feuille complet, grille 200 mm).
  - ajout du preview SVG dans l'onglet `PLAN`.
  - façades du plan rendues comme pentagones quand disponibles.
- [x] Murs latéraux évasés portés dans Rust :
  - ajout d'une primitive `add_hex_panel`.
  - `export_house_stl` et `scene_meshes_json` utilisent les murs inclinés quand `taperX` est actif.
- [x] Contrôles avancés porte/perchoir ajoutés :
  - `doorVar`.
  - `doorFollowTaper`.
  - `perchDiam`, `perchLen`, `perchOff`.
- [x] Trous de porte/perchoir intégrés côté Rust :
  - façade avant générée par tessellation client-side.
  - cellules de porte/perchoir retirées de la façade.
  - parois de contour générées autour des trous.
  - rendu, export maison STL et façade avant du ZIP utilisent la même façade percée.
- [x] Corrections qualité/bugs sur façade, viewer et plan :
  - tessellation de façade affinée.
  - lignes de grille forcées sur les contours porte/perchoir pour améliorer les bords.
  - perchoir aligné avec le trou calculé par Rust.
  - perchoir ajouté au rendu `scene_meshes_json`.
  - cleanup Three.js corrigé avant remplacement du DOM.
  - statistiques de plan visibles dans l'onglet `PLAN`.
  - correction du bug où la partie pointue du pignon pouvait disparaître avec une porte active.
  - pignon généré comme triangle exact séparé; seule la partie murale est tessellée pour les trous.
  - définition des portes rondes augmentée (contour 96 points, grille 2 mm).
  - suppression de la face interne entre mur et pignon pour suivre la logique `THREE.Shape` de v16.
  - suppression des arêtes de triangulation de façade en mode plein dans le viewer.
  - portes carrées/pentagonales sorties du chemin de grille; façade décomposée en polygones exacts autour du trou.
  - perchoir remplacé par une tige cylindrique Rust/WASM dans le viewer, le STL maison et l'export ZIP `perchoir.stl`.
  - porte ronde seule sortie du chemin de grille; façade découpée en bandes polygonales autour de l'ellipse pour réduire les vertex et le poids STL.
  - cas porte ronde + trou de perchoir sorti du fallback grille; les deux trous ronds sont maintenant découpés comme cutouts légers façon v16.
  - exports navigateur renforcés: copie défensive des bytes WASM avant Blob et message d'état explicite pour succès/erreur/export vide.
  - export OBJ debug ajouté côté Rust pour inspecter la géométrie finale hors Three.js.
  - rapport mesh/STL ajouté côté Rust: triangles, bytes STL/OBJ, bounding box, volume signé, dégénérés, valeurs non finies, entrées ZIP.
  - nettoyage final des triangles avant export: suppression des triangles dégénérés et valeurs non finies.
  - smoke test ajouté: `node scripts/mesh-smoke.mjs` valide plusieurs presets et bloque les exports vides/dégénérés.
  - correction du writer STL binaire: enregistrement triangle ramené à 50 octets exacts; le smoke test vérifie maintenant `84 + triCount * 50`.
  - toiture `onglet` portée depuis v16 avec section trapézoïdale/bevelee dans maison, viewer et ZIP panneaux.
  - smoke test ZIP renforcé: chaque STL interne est extrait et validé comme STL binaire conforme.
  - ajout de `earcutr` pour trianguler la façade avec trous comme `THREE.Shape + holes` dans v16.
  - les panneaux du ZIP sont maintenant strictement watertight au test d'arêtes; `maison_complete.stl` reste un assemblage de panneaux en contact, non une union booléenne.
- [x] Correction UX/state management :
  - les sliders ne reconstruisent plus toute la sidebar à chaque `input`.
  - scroll et focus sont preservés après rendu complet.
  - le viewer/plan se mettent à jour sans faire sauter le menu.
  - suppression du rendu complet différé après `change` des sliders.
  - hover/focus des boutons stabilisé pour éviter les micro-reflows.
- [ ] Finaliser la conversion métier complète :
  - Remplacer le rendu 3D/triangles de secours par les données exactes de géométrie Rust.
  - Implémenter décorations Rust (`vector` et `heightmap`) ou maintenir le pipeline JS en v1.
  - Vérifier l’équivalence visuelle de la découpe (plans + `usage_ratio` + pièces).
  - Ajouter contrôle licence/serveur pour verrouiller les fonctions payantes.

## 10) Plan d’exécution immédiat (ce run)

1. [ ] Rebuild Rust après toute modification (`cd /home/marc/Documents/nichoir16/wasm && wasm-pack build --target web`).
2. [x] Brancher `exportPanelsZIP` vers `mod.export_panels_zip` (avec fallback JS).
3. [ ] Ajouter un mode de validation de cohérence:
   - même valeur de `P` chargée en Rust et affichée côté JS,
   - comparer en console `Wtop/Wbot/roof_len` entre `compute_summary` et calcul JS.
4. [ ] Préparer un endpoint de debug (bouton admin) indiquant version WASM + état des exports pour faciliter les retours terrain.

## 11) Roadmap vers application WASM facturable

1. Version hybride actuelle :
   HTML/JS garde l'interface, WASM prend les calculs et exports.
2. Version WASM métier :
   Rust devient la source de vérité pour `Params`, calculs, plans, STL, ZIP, géométrie.
3. Version compte/API :
   le modal Compte se branche sur une API externe pour session, credits, abonnement, Stripe link, messages et tickets. Statut: login/logout, resume `GET /api/me`, autorisation et consommation d'exports sont branches en dev; la gestion complete compte/billing/tickets reste sur `/account`.
4. Version protégée :
   les exports premium appellent `POST /api/exports/authorize` avant téléchargement. En dev, validation PHP/SQLite. En production, validation serveur + MySQL + Stripe.
5. Version site produit :
   PHP sert `/`, `/pricing`, `/account`, `/admin`, `/api` et `/stripe/webhook`; `/app/` reste l'app Rust/WASM.
6. Version app complète :
   interface migrée vers Yew/Leptos ou shell JS minimal, avec rendu 3D alimenté par Rust.

## 12) Nouvelle règle de travail

`nichoir_v16.html` est maintenant un cahier des charges executable. On ne l'utilise plus comme application finale.

La cible officielle devient :

```text
http://127.0.0.1:8016/app/index.html
```

En dev, l'app statique tourne sur `8016` et l'API PHP sur `8021`. En production, PHP devrait servir le site complet et l'app sous `/app/`.

Le fichier hôte HTML restera nécessaire parce qu'un navigateur ne lance pas un `.wasm` directement. L'objectif est que ce HTML reste minimal et que les calculs, exports, rendu d'interface et règles payantes soient pilotés par Rust/WASM, tandis que compte/admin/Stripe restent pilotés par PHP.

## 13) Inventaire v16 a porter dans l'app WASM

Priorité haute :

1. Creer le site PHP public autour de l'app: landing `/`, page prix `/pricing`, lien vers `/app/`.
2. Creer l'espace client `/account` et l'admin prive `/admin`.
3. Terminer le plan de coupe Rust avec rotation/pentagones exacts et statistiques d'occupation visibles.
4. Corriger les exports ZIP pour que chaque panneau ait la forme exacte quand évasement/onglet sont actifs.
5. Remplacer la tessellation de façade par une triangulation polygonale plus propre si la qualité STL l'exige.

Priorité moyenne :

1. Remplacer Stripe placeholder par Checkout reel et verification `Stripe-Signature`; le webhook local/dev remplit deja `payments` et `subscriptions`.
2. Ajouter edition profil, portail Stripe et reponses tickets cote PHP.
3. Recréer les coupes X/Y/Z.
4. Porter décorations SVG/image (`vector`, `heightmap`) après la géométrie coeur.
5. Ajouter export PNG du plan depuis le preview SVG/canvas.

Priorité i18n :

1. Centraliser tous les libellés dans Rust.
2. Garder `fr` par défaut.
3. Prévoir `en` comme deuxième langue sans changer le HTML hôte.
