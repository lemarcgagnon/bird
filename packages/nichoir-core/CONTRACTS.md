# `@nichoir/core` — Public Contract

> **Source d'autorité pour les exports publics du package `nichoir-core`.**
> Toute modification de ce document doit précéder la modification du code.
> Les consommateurs (`nichoir-ui`, `nichoir-adapters`) ne peuvent importer QUE ce qui est listé ici.

**Version du contrat** : 0.2.0 (multi-bin cut plan)
**Dépendances runtime** : `three` (≥ r160), `jszip` (≥ 3.10). Aucune autre.

---

## Invariants

**I1 — Zéro DOM.** Aucune référence à `document`, `window`, `HTMLCanvasElement`, `HTMLElement`, `Blob`, `URL`, `Image`, `DOMParser`, `requestAnimationFrame`, ou toute API navigateur. Toute violation casse l'exécution Node.

**I2 — Zéro React, zéro Next.** Aucun import depuis `react`, `next/*`, `react-dom`, etc.

**I3 — Zéro i18n embarqué.** Les chaînes traduites N'existent PAS dans le core. Toute fonction qui produit un artefact contenant du texte traduit (SVG, noms de fichiers dans le ZIP) accepte un paramètre `translate: Translator` injecté par l'appelant.

**I4 — Zéro état interne.** Pas de singletons, pas de module-level state mutable. Toutes les fonctions sont pures ou prennent leur input par paramètre.

**I5 — Testable en Node.** Chaque fonction listée ci-dessous doit pouvoir s'exécuter dans un test Vitest sous Node sans `jsdom`.

**I6 — Stable.** Une fois cette version figée, aucune signature ne change sans diff explicite sur ce document, approuvé par orchestrateur + revue.

---

## Types publics

### Enums / literal unions

```ts
export type PanelKey    = 'front' | 'back' | 'left' | 'right' | 'roofL' | 'roofR' | 'bottom';
export type DecoKey     = 'front' | 'back' | 'left' | 'right' | 'roofL' | 'roofR';  // subset sans 'bottom'

export type DisplayMode = 'solid' | 'wireframe' | 'xray' | 'edges';
export type FloorType   = 'enclave' | 'pose';
export type RidgeType   = 'left' | 'right' | 'miter';
export type DoorType    = 'none' | 'round' | 'square' | 'pentagon';
/** Face porteuse du trou de porte + perchoir + pièce physique doorPanel.
 *  'front' = comportement historique (façade avant). 'left'/'right' = mur latéral. */
export type DoorFace    = 'front' | 'left' | 'right';
export type DecoMode    = 'heightmap' | 'vector';
export type DecoSourceType = 'svg' | 'image';

export type Lang        = 'fr' | 'en';
export type TabKey      = 'dim' | 'vue' | 'deco' | 'calc' | 'plan' | 'export';
export type ClipAxisKey = 'x' | 'y' | 'z';
```

### Utilitaires

```ts
export type Vec3 = readonly [number, number, number];

export interface BBox {
  minX: number; minY: number;
  maxX: number; maxY: number;
}

/**
 * Fonction de traduction injectée par l'appelant.
 *
 * Contrat strict : **doit retourner une `string`, jamais `undefined`**.
 * Si l'appelant n'a pas la clé, il est responsable d'un fallback (ex: retourner la clé elle-même).
 * Le core ne fait pas de garde-fou runtime — un retour `undefined` est un bug chez l'appelant
 * et peut produire un artefact corrompu (string `"undefined"` dans un SVG, nom de fichier invalide).
 *
 * Les tests de robustesse "translate casse" vivent en UI (P2), pas ici.
 */
export type Translator = (key: string, params?: Record<string, string | number>) => string;

/** Point 2D précalculé (remplace les APIs DOM type getPointAtLength). */
export interface Pt2 { x: number; y: number; }
export type ParsedShape = Pt2[];  // un contour fermé discrétisé
```

### State

```ts
export interface Params {
  // Boîte (mm)
  W: number; H: number; D: number;

  // Toit
  slope: number;      // degrés, 10..60
  overhang: number;   // mm
  T: number;          // épaisseur panneau mm

  // Affichage
  mode: DisplayMode;
  explode: number;    // 0..100

  // Structure
  floor: FloorType;
  ridge: RidgeType;
  taperX: number;     // mm, négatif autorisé

  // Porte
  door: DoorType;
  doorFace: DoorFace;               // défaut 'front' ; route le trou vers front|left|right
  doorW: number; doorH: number;
  doorPX: number; doorPY: number;   // %
  doorVar: number;                   // %
  doorPanel: boolean;
  doorFollowTaper: boolean;

  // Perchoir
  perch: boolean;
  perchDiam: number; perchLen: number; perchOff: number;

  // Feuille de découpe source
  panelW: number; panelH: number;
}

export interface ClipAxis { on: boolean; pos: number; }
export interface ClipState { x: ClipAxis; y: ClipAxis; z: ClipAxis; }

export interface CameraState {
  theta: number; phi: number;   // radians
  dist: number;
  tx: number; ty: number; tz: number;
}

/**
 * Warning structuré émis par le parse d'un fichier deco, destiné à être
 * traduit au render (pas au parse). `key` est une clé i18n opaque côté core
 * (ex: 'deco.svg.noShapes') ; `params` contient les interpolations si la clé
 * en prend (ex: `{ message }` pour 'deco.svg.parseError').
 *
 * Stocké sous cette forme pour que le texte du warning suive la langue active
 * sans re-parser le fichier (fix bug v15 "langue figée").
 */
export interface DecoWarning {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * DecoSlot — version CORE (sans types DOM/Three.js).
 * La UI convertit depuis/vers sa forme runtime qui peut contenir
 * HTMLCanvasElement et THREE.Shape[] (non-sérialisables).
 *
 * ⚠️ `resolution` vs `heightmapResolution` :
 *   - `resolution` est la valeur contrôlée par le slider utilisateur (32..128)
 *   - `heightmapResolution` est la taille effective en pixels² du buffer `heightmapData`
 *     au moment de l'appel à `buildDecoGeoHeightmap`
 *   - C'est la UI qui garantit leur cohérence au moment de la rastérisation.
 *     Le core ne re-synchronise PAS ces champs (et ne peut pas — il n'a pas accès au canvas).
 *   - Dans `createInitialState()`, les deux valent 64 par défaut.
 */
export interface DecoSlotCore {
  enabled: boolean;
  source: string | null;
  sourceType: DecoSourceType | null;
  parsedShapes: ParsedShape[] | null;         // remplace THREE.Shape[]
  bbox: BBox | null;
  heightmapData: Uint8ClampedArray | null;    // remplace HTMLCanvasElement
  heightmapResolution: number;
  mode: DecoMode;
  w: number; h: number;
  posX: number; posY: number;
  rotation: number;
  depth: number;
  bevel: number;
  invert: boolean;
  resolution: number;
  clipToPanel: boolean;
  lastParseWarning: DecoWarning | null;
}

export interface NichoirState {
  params: Params;
  clip: ClipState;
  camera: CameraState;
  decos: Record<DecoKey, DecoSlotCore>;
  activeDecoKey: DecoKey;
  lang: Lang;
  activeTab: TabKey;
}
```

### Résultats de calcul

```ts
export interface Volumes  { ext: number; int: number; mat: number; }
export interface Surfaces { total: number; facades: number; sides: number; bottom: number; roof: number; }

export interface DerivedDims {
  wallH: number; rH: number; sL: number; rL: number; bev: number;
  sL_L: number; sL_R: number;
  Wtop: number; Wbot: number;
  wallHreal: number; hasTaper: boolean;
  floorW: number; floorD: number; sideD: number;
  isPose: boolean; ang: number;   // ang en radians
}

export interface Calculations {
  volumes: Volumes;
  surfaces: Surfaces;
  derived: DerivedDims;
}

export interface DoorShape { key: string; percent: number | null; }
export interface CutItem {
  nameKey: string;
  noteKey?: string | null;
  noteParams?: Record<string, string | number> | null;
  qty: number;
  dim: string;
  doorShape?: DoorShape;
}
export interface CutList { cuts: CutItem[]; nPieces: number; }

/**
 * LayoutPiece.nameKey est une CLÉ i18n opaque (ex: 'panel.front'),
 * résolue par le consumer via `Translator`. `computeCutLayout` ne traduit jamais.
 * Les coordonnées `px, py` sont RELATIVES au panneau (Panel.pieces).
 */
export interface LayoutPiece {
  nameKey: string;
  suffix?: string;
  w: number; h: number;
  color: string;
  shape: 'rect' | 'pent';
  rH?: number; wallH?: number; Wtop?: number; Wbot?: number;
  px?: number; py?: number;
  rot?: boolean;
  idx?: number;
}

/**
 * Panneau physique : toutes les `pieces` sont dans [0, shW] × [0, shH].
 */
export interface Panel {
  pieces: LayoutPiece[];
  shW: number;
  shH: number;
  usedArea: number;
  occupation: number;   // ∈ [0, 1]
}

/**
 * Résultat multi-bin de `computeCutLayout`.
 * `overflow` contient les pièces strictement plus grandes que le panneau.
 */
export interface CutLayout {
  panels: Panel[];
  overflow: LayoutPiece[];
  totalUsedArea: number;
  meanOccupation: number;
}
```

### Résultats géométriques

```ts
import * as THREE from 'three';

export type PanelDefKey =
  | PanelKey
  | `deco_${DecoKey}`
  | 'doorPanel'
  | 'perch';

export interface PanelDef {
  key: PanelDefKey;
  geometry: THREE.BufferGeometry;
  basePos: Vec3;
  baseRot: Vec3;
  color: number;                // hex 0xRRGGBB
  explodeDir: Vec3;
  extraClips?: THREE.Plane[] | null;
}

/**
 * Dims dérivées exposées par `buildPanelDefs` via `BuildResult.derived`.
 * Surensemble strict des champs lus par le source `panels.js` ligne 343-349.
 * Inclut `peakY` (absent de `DerivedDims`) et omet `isPose` (présent de `DerivedDims`).
 * Les deux types co-existent : `DerivedDims` est pour `computeCalculations`,
 * `BuildDerived` pour `buildPanelDefs`. Unification possible en P2 si tests valident.
 */
export interface BuildDerived {
  wallH: number; rH: number; sL: number; rL: number; bev: number;
  Wtop: number; Wbot: number; wallHreal: number;
  floorW: number; floorD: number; sideD: number;
  hasTaper: boolean; ang: number; peakY: number;
}

export interface BuildResult {
  defs: PanelDef[];
  explodeDistance: number;
  activeClips: ClipAxisKey[];
  clipPlanesOut: Partial<Record<ClipAxisKey, { constant: number }>>;
  derived: BuildDerived;
}

export interface DecoCtx {
  W: number; Wtop: number; Wbot: number;
  wallH: number; wallHreal: number;
  rH: number; sideD: number; T: number;
  sL: number; sL_L: number; sL_R: number;
  rL: number; bev: number;
  ridge: RidgeType; taperX: number; alpha: number;
}

/** Internes de `buildPanelDefs`, exposés pour permettre des tests ciblés. */
export interface DoorInfo {
  type: Exclude<DoorType, 'none'>;
  w: number; h: number; cx: number; cy: number;
  followTaper: boolean; taperX: number; wallH: number;
}
export interface PerchHoleInfo { cx: number; cy: number; diam: number; }

export type RoofPlaneFn = (x: number, z: number) => number;
```

---

## Fonctions publiques

### Constantes publiques

```ts
/** Liste canonique des panneaux qui peuvent porter une décoration.
 *  Utilisée par la UI pour itérer les cibles. */
export const DECO_KEYS: readonly DecoKey[];

/** Version du package au moment du build, utile pour debug/telemetry. */
export const CORE_VERSION: string;
```

### State

```ts
export function createInitialState(): NichoirState;
```

### Calculations (pure data)

```ts
export function computeCalculations(params: Params): Calculations;

export function computeCutList(params: Params, derived: DerivedDims): CutList;
```

### Cut plan (pure data — PAS de rendering)

```ts
export function computeCutLayout(params: Params): CutLayout;
```

> ⚠️ **Non-export** : `drawCutPlan(ctx, layout)` appartient à `nichoir-ui/rendering/` car il dépend de `CanvasRenderingContext2D`. Le core n'en sait rien.

### Geometry

```ts
export function mkPent(
  Wtop: number, Wbot: number, wH: number, rH: number, T: number,
  door: DoorInfo | null,
  perch: PerchHoleInfo | null
): THREE.ExtrudeGeometry;

export function mkHexPanel(
  v0: Vec3, v1: Vec3, v2: Vec3, v3: Vec3,
  outwardNormal: Vec3,
  T: number,
  roofPlane?: RoofPlaneFn | null
): THREE.BufferGeometry;

/**
 * Construit les `PanelDef[]` de tous les panneaux + décos depuis l'état.
 * Lit : `state.params`, `state.clip`, `state.decos`. N'utilise PAS `state.camera`,
 * `state.lang`, `state.activeTab`, `state.activeDecoKey`.
 * Branche sur `decos[k].mode` pour appeler en interne `buildDecoGeoVector`
 * ou `buildDecoGeoHeightmap` (c'est un détail d'implémentation, pas une API publique).
 */
export function buildPanelDefs(state: NichoirState): BuildResult;
```

> ⚠️ **Non-export** : `materializeDefs(group, buildResult, mode, clipPlanes)` crée des `MeshPhongMaterial`/`MeshBasicMaterial`/`EdgesGeometry`/`LineBasicMaterial` — rendering, pas géométrie. Vit dans `nichoir-ui/viewports/`.

### Décoration (branches pures uniquement)

```ts
export function buildDecoGeoVector(
  shapes: ParsedShape[],
  bbox: BBox,
  w: number, h: number,
  depth: number, bevel: number
): THREE.BufferGeometry;

/**
 * Construit une géométrie de déco heightmap depuis des pixels pré-rastérisés.
 *
 * Contrat strict sur `heightmapData` :
 *   - Format : RGBA, ligne par ligne, row-major, origine top-left.
 *   - Longueur requise : `heightmapResolution * heightmapResolution * 4` octets exactement.
 *   - La luminance est extraite par `(R + G + B) / 3` sur chaque pixel.
 *
 * **Throws `TypeError`** si :
 *   - `heightmapResolution` n'est pas un entier dans `[16, 128]`. Cette borne
 *     est alignée sur le **clamp historique de `src/geometry/deco.js:144`**
 *     (`Math.max(16, Math.min(128, deco.resolution | 0))`), PAS sur le slider UI
 *     (qui va de 32 à 128, cf. `index.html:300` — un input <32 ne peut être produit
 *     que par API directe, fixture manuelle, ou bypass du slider).
 *   - `heightmapData.length !== heightmapResolution * heightmapResolution * 4`
 *
 * Rationale : silence sur input invalide = bug silencieux dans un pipeline d'export
 * (hors [16,128], la grille interne et le buffer divergent → lectures hors-bornes
 * silencieuses). Throw précoce = fail-fast.
 *
 * La UI est responsable de la rastérisation (DOM canvas + ImageData) en amont.
 */
export function buildDecoGeoHeightmap(
  heightmapData: Uint8ClampedArray,
  heightmapResolution: number,
  w: number, h: number,
  depth: number, invert: boolean
): THREE.BufferGeometry;

/**
 * Positionne/oriente `geo` sur le panneau ciblé.
 * **Mutation in-place** du BufferGeometry fourni (attributs position réécrits).
 * Ne retourne rien. L'appelant ne doit pas réutiliser le `geo` ailleurs après l'appel.
 */
export function placeDecoOnPanel(
  geo: THREE.BufferGeometry,
  panelKey: DecoKey,
  deco: Pick<DecoSlotCore, 'rotation' | 'posX' | 'posY'>,
  ctx: DecoCtx
): void;

export function buildPanelClipPlanes(
  panelKey: DecoKey,
  ctx: DecoCtx,
  basePos: Vec3,
  baseRot: Vec3
): THREE.Plane[];
```

> ⚠️ **Non-export** : `parseSVG(svgText)` utilise `DOMParser` et `getPointAtLength` → UI. `rasterizeToCanvas(source, type, res)` utilise `Image` + canvas → UI. La UI parse/rastérise puis fournit au core des `ParsedShape[]` et `Uint8ClampedArray`.

### Génération d'artefacts (bytes/strings purs, zéro DOM)

```ts
/**
 * Génère le STL binaire de la maison complète (murs + toit + plancher + perchoir + décos).
 * Retourne `null` si `buildResult.defs` ne contient aucun panneau maison éligible.
 *
 * Invariants de transformation :
 * - Utilise `PanelDef.basePos` et `PanelDef.baseRot` pour les coordonnées monde.
 * - **Ignore `buildResult.explodeDistance`** — les STL sont toujours en configuration montée.
 *
 * ⚠️ Nature du STL (ne PAS confondre avec un merge CSG) :
 * - Le STL est une **concaténation** de triangles provenant de chaque `PanelDef` éligible.
 *   Pas de boolean union, pas de stitching entre panneaux et décos.
 * - Les panneaux extrudés (`mkPent`, `mkHexPanel`, `BoxGeometry`) sont watertight individuellement.
 * - Les décos **vectorielles** (mode 'vector') sont watertight individuellement.
 * - Les décos **heightmap** (mode 'heightmap') sont des **surfaces simples** (non-watertight) —
 *   pas de faces latérales, pas de fond. C'est le comportement de v15 et des slicers 3D l'acceptent
 *   avec tolérance, mais le STL généré n'est PAS un solide fermé dès qu'une déco heightmap est active.
 * - Les décos sont **incluses** dans le STL maison (pas exportées séparément au niveau maison).
 */
export function generateHouseSTL(buildResult: BuildResult): Uint8Array | null;

/**
 * Génère le STL binaire de la porte seule (panneau `doorPanel`).
 * Retourne `null` si aucun `doorPanel` n'est présent dans `buildResult.defs`.
 * Ignore `explodeDistance` (même invariant que `generateHouseSTL`).
 */
export function generateDoorSTL(buildResult: BuildResult): Uint8Array | null;

/**
 * Génère un ZIP contenant 1 STL par panneau physique.
 *
 * Politique de regroupement (parité avec v15) :
 * - Pour chaque panneau des `HOUSE_KEYS`, le STL inclut les triangles du panneau
 *   ET les triangles de sa déco associée (`deco_<key>`) **concaténés** (pas mergés).
 * - Le `doorPanel` est inclus uniquement si `params.door !== 'none' && params.doorPanel`.
 * - Mêmes caveats watertight que `generateHouseSTL` :
 *   panneau seul = watertight ; + déco heightmap = surface non-fermée.
 *
 * `translate` résout :
 *   - les noms de fichiers via `panel.<key>` (ex: `panel.front` → "facade_avant")
 */
export function generatePanelsZIP(
  buildResult: BuildResult,
  params: Params,
  translate: Translator
): Promise<Uint8Array>;

/** Génère la string SVG d'UN panneau du plan de découpe.
 *  `translate` résout les labels de pièces et `plan.rotated`. */
export function generatePlanSVG(
  panel: Panel,
  translate: Translator
): string;

/** Génère un ZIP contenant un SVG par panneau (`panel-1.svg`, `panel-2.svg`, …). */
export function generatePlanZIP(
  layout: CutLayout,
  translate: Translator
): Promise<Uint8Array>;
```

---

## Non-goals (explicitement hors du core)

- Téléchargement de fichier (`URL.createObjectURL`, `<a download>`) → `nichoir-adapters/DownloadService`
- Rendu canvas 2D (`drawCutPlan`, `toBlob`) → `nichoir-ui/rendering`
- Création de matériaux Three.js + scene graph de rendu (`materializeDefs`) → `nichoir-ui/viewports`
- Parsing SVG dans le DOM (`DOMParser`, `getPointAtLength`) → `nichoir-ui/parsers`
- Rastérisation d'image (`<img>`, `canvas.getContext('2d').getImageData`) → `nichoir-ui/parsers`
- Feedback UI (toasts, alerts, busy indicators) → `nichoir-ui/feedback`
- Gating crédits, auth, persistance → `nichoir-adapters/ports`

---

## Checklist de validation (pour code-reviewer)

Tous les greps s'exécutent dans `packages/nichoir-core/src` et doivent retourner **zéro ligne** :

- [ ] Pas d'APIs DOM :
  `grep -rE "\\b(document|window|HTMLCanvas|HTMLElement|DOMParser|requestAnimationFrame|Image)\\b" packages/nichoir-core/src`
- [ ] Pas de constructions Blob/URL :
  `grep -rE "\\b(Blob|URL\\.createObjectURL|URL\\.revokeObjectURL)\\b" packages/nichoir-core/src`
- [ ] Pas de React / Next :
  `grep -rE "from ['\"]react['\"]|from ['\"]next/|\\.jsx\\b|\\.tsx\\b" packages/nichoir-core/src`
- [ ] Pas d'import i18n :
  `grep -rE "from ['\"].*i18n|import.*translations" packages/nichoir-core/src`
- [ ] `pnpm --filter @nichoir/core test` passe en Node pur (pas de `jsdom` dans vitest config)
- [ ] `pnpm --filter @nichoir/core build` produit un bundle sans dépendance DOM (vérifier avec `npx @cypress/web-test` ou équivalent bundler analysis)
