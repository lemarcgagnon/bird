# Fixtures de référence — Nichoir P1.0

## Source d'autorité

Ces fixtures sont capturées depuis `src/*` modular refactor, validé par parité visuelle contre
`nichoir_v15.html` servi à `localhost:8765`.

Elles constituent la source de vérité numérique pour toutes les comparaisons de parité dans
P1.1, P1.2, P1.3. Toute divergence de valeurs lors du port = bug dans le port, pas dans la
fixture.

## Presets couverts

| Lettre | Nom                    | Description                                          |
|--------|------------------------|------------------------------------------------------|
| A      | `default`              | État initial exact — aucun override                  |
| B      | `pentagon-door-tapered`| Façade évasée, porte pentagone, perchoir, W=180      |
| C      | `steep-miter`          | Pente 60°, toit onglet (miter), surplomb 50mm, T=18 |

Presets D (heightmap) et E (decos vector) seront ajoutés en P1.2 quand les branches deco
seront portées (nécessitent des ressources image/SVG).

## Comment régénérer

```bash
cd packages/nichoir-core
node tests/fixtures/capture-reference.mjs
```

Pour un preset spécifique :
```bash
node tests/fixtures/capture-reference.mjs A
node tests/fixtures/capture-reference.mjs B
node tests/fixtures/capture-reference.mjs C
```

## MD5 des fixtures (idempotentes)

```
b0081bb3209d57d3a5b702d9b095ef7c  presetA.snapshot.json  (capturé 2026-04-16, P1.0, src/*)
a8a8c4793d832cee0917dd1217c58053  presetB.snapshot.json  (capturé 2026-04-16, P1.0, src/*)
3e4c95a38b3d6c72ae8911a881b16598  presetC.snapshot.json  (capturé 2026-04-16, P1.0, src/*)
e104c1c81b0afac00b8da8884f0d97eb  presetD.snapshot.json  (capturé 2026-04-17, P1.2.β, capture mixte TS+src)
a5ed18ed689d39dea02e0e90edafdd81  presetE.snapshot.json  (capturé 2026-04-17, P1.2.β, capture mixte TS+src)
```

**Source par preset** :
- **A, B, C** : capturés entièrement depuis `src/*` modular (parité visuelle v15 établie + garde-fou puppeteer A+).
- **D, E** : capture **mixte**. Précisément :
  - `createInitialState` + `buildPanelDefs` (+ donc STL house/door/zip) → **TS port** (`dist/`). Raison : src.buildDecoGeo heightmap branch utilise `document.createElement('canvas')` → non-exécutable en Node.
  - `computeCalculations` + `computeCutList` + `computeCutLayout` (+ donc `planSvg` dérivé) → **src/*** (par inertie ; ces fonctions pures passent la parité 1e-6 entre src et TS en P1.1, donc le choix est numériquement équivalent mais conceptuellement mixte).
  - Ces fixtures sont des **snapshots de régression du port**, pas des références indépendantes vs v15. Le spot-check manuel browser reste possible mais hors scope P1.2.β.

Ces MD5 sont **stables** : relancer `capture-reference.mjs` produit exactement les mêmes bytes.
Cela permet de détecter toute dérive involontaire via `md5sum`.

Commande de vérification :
```bash
md5sum packages/nichoir-core/tests/fixtures/*.snapshot.json
```

## Anchor values pour spot-check manuel vs v15

| Preset | `volumes.ext` (mm³)  | STL house triangles | SVG polygonCount |
|--------|----------------------|---------------------|------------------|
| A      | 6349012.5191         | 92                  | 2                |
| B      | 7563468.9695         | 280                 | 2                |
| C      | 7405620.0270         | 92                  | 2                |

## Garde-fou indépendant

### But

Détecter une divergence silencieuse entre `src/*` (modular refactor) et `nichoir_v15.html`
(source originale inline). Le script compare les anchors numériques clés de chaque preset
en rendant la page dans un vrai navigateur headless — indépendamment de tout code TypeScript.

### Lancer

```bash
# Depuis packages/nichoir-core
node tests/fixtures/verify-v15-anchors.mjs
```

### Prérequis

- `http-server` lancé sur le port 8765 (servant `nichoir_v15.html`)
- Chrome ou Chromium système disponible — le script cherche automatiquement :
  1. `$CHROME_EXECUTABLE` ou `$PUPPETEER_EXECUTABLE_PATH` (override explicite)
  2. Liste de chemins standards (Linux : `/usr/bin/google-chrome-stable`, `-chrome`, `chromium`, `chromium-browser`, `/snap/bin/chromium` ; macOS : bundles `.app`)
  3. Throw explicite si rien trouvé
- `puppeteer-core` installé (`pnpm install` dans le package suffît)

### Anchors vérifiés par preset

Pour chaque preset A, B, C :

| Anchor          | Tolérance  | Méthode                          |
|-----------------|------------|----------------------------------|
| `volumes.ext`   | 1% relative| Parse `#v-ext` → mm³             |
| `volumes.int`   | 1% relative| Parse `#v-int` → mm³             |
| `surfaces.total`| 1% relative| Parse `#s-total` → mm²           |
| `doorPanel`     | exact       | `#cb-door-panel.checked` + absence ligne "Porte" dans `#cut-table` |

La tolérance de 1% est justifiée par l'arrondi d'affichage de `fV` (`.toFixed(2)` en L,
soit ±10 000 mm³ de granularité sur ~6–8 M mm³ → ≈0.15% au pire) et `fA2` (`.toFixed(1)` en cm²).

### Codes de sortie

- `0` — 3/3 presets GREEN (tous les anchors dans la tolérance)
- `1` — au moins un mismatch, avec détail dans stdout

### Conséquence d'un échec

Si le script retourne `1` : la phase P1.0 est **rouverte**. Investiguer le delta :
- Bug introduit dans `src/*` lors d'un refactor ultérieur ?
- Régression dans `nichoir_v15.html` (modification non contrôlée) ?
- Bruit de parsing DOM (format de texte inattendu) ?

## Règles d'immutabilité

Ces fixtures sont **immutables** une fois commitées.

- Toute divergence lors de P1.1/P1.2/P1.3 = **bug dans le port**, pas dans la fixture.
- Si un bug est identifié dans `src/*` qui nécessite une correction de fixture, la correction
  doit être approuvée par l'orchestrateur + revue externe avant de modifier ces fichiers.
- Ne jamais régénérer les fixtures sans approbation explicite du gestionnaire de la phase P1.

## Structure d'une fixture

Chaque `preset{X}.snapshot.json` contient :

```
{
  preset, name, description, source,
  state: NichoirState (sans shapes/rasterCanvas),
  reference: {
    calculations: { volumes, surfaces, derived },
    cutList: { cuts, nPieces },
    cutLayout: { pieces, shW, shH, totalArea },
    panelDefsNormalized: [ { key, triangleCount, bbox, basePos, baseRot, color, hasExtraClips } ],
    stlHouse: { byteLength, triangleCount, aggregateBbox } | null,
    stlDoor: { byteLength, triangleCount, aggregateBbox } | null,
    panelsZip: { byteLength, entries: [ { filename, stlByteLength, stlTriangleCount } ] } | null,
    planSvg: { byteLength, polygonCount, rectCount, textCount }
  }
}
```

Note : `stlDoor` est `null` quand `params.doorPanel = false` (porte = trou dans la façade,
pas une pièce physique séparée). C'est le cas pour les 3 presets A, B, C.
