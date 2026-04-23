// Généré depuis CONTRACTS.md v0.2.0 — ne pas éditer manuellement en dehors d'une révision du contrat.
import * as THREE from 'three';
import type { PaletteKey } from './palettes.js';

// ---------------------------------------------------------------------------
// Enums / literal unions
// ---------------------------------------------------------------------------

export type PanelKey    = 'front' | 'back' | 'left' | 'right' | 'roofL' | 'roofR' | 'bottom';
export type DecoKey     = 'front' | 'back' | 'left' | 'right' | 'roofL' | 'roofR';

export type DisplayMode = 'solid' | 'wireframe' | 'xray' | 'edges';
export type FloorType   = 'enclave' | 'pose';
export type RidgeType   = 'left' | 'right' | 'miter';
export type DoorType    = 'none' | 'round' | 'square' | 'pentagon';
/** Panneau qui porte le trou de porte + perchoir + pièce physique. 'front' = défaut (façade avant, comportement historique). */
export type DoorFace    = 'front' | 'left' | 'right';
export type DecoMode    = 'heightmap' | 'vector';
export type DecoSourceType = 'svg' | 'image';

export type Lang        = 'fr' | 'en';
export type TabKey      = 'dim' | 'vue' | 'deco' | 'calc' | 'plan' | 'plan2' | 'export';
export type ClipAxisKey = 'x' | 'y' | 'z';

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

export type Vec3 = readonly [number, number, number];

export interface BBox {
  minX: number; minY: number;
  maxX: number; maxY: number;
}

/** Fonction de traduction injectée par l'appelant. */
export type Translator = (key: string, params?: Record<string, string | number>) => string;

/** Point 2D précalculé (remplace les APIs DOM type getPointAtLength). */
export interface Pt2 { x: number; y: number; }
export type ParsedShape = Pt2[];  // un contour fermé discrétisé

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

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
  /** Face qui reçoit la porte + perchoir + pièce physique doorPanel. Défaut 'front'. */
  doorFace: DoorFace;
  doorW: number; doorH: number;
  doorPX: number; doorPY: number;   // %
  doorVar: number;                   // %
  doorPanel: boolean;
  doorFollowTaper: boolean;

  // Perchoir
  perch: boolean;
  perchDiam: number; perchLen: number; perchOff: number;

  // Suspension (trous dans le débordement du toit)
  hang: boolean;
  hangPosY: number;    // mm, distance from each gable end along D axis (symmetric front/back)
  hangOffsetX: number; // mm, distance from ridge along slope direction (mirrored left/right)
  hangDiam: number;    // mm, hole diameter

  // Feuille de découpe source
  panelW: number; panelH: number;

  /** Palette de couleurs appliquée aux panneaux 3D et au plan de coupe 2D. */
  palette: PaletteKey;
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
 * traduit au render (pas au parse) pour que le texte suive la langue active.
 *
 * `key` est une clé i18n opaque côté core (ex: 'deco.svg.noShapes').
 * `params` contient les interpolations si la clé en prend (ex: `{ message }`
 * pour 'deco.svg.parseError').
 */
export interface DecoWarning {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * DecoSlot — version CORE (sans types DOM/Three.js).
 * La UI convertit depuis/vers sa forme runtime qui peut contenir
 * HTMLCanvasElement et THREE.Shape[] (non-sérialisables).
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
  /**
   * Quand `true`, le motif SVG vectoriel devient un VRAI trou dans le panneau
   * via 2D boolean (Shape + Path holes + ExtrudeGeometry). Applicable uniquement
   * aux 4 murs (front/back/left/right) en mode 'vector' avec parsedShapes non-vide.
   * Default : `false` (comportement inchangé — déco mesh séparé).
   * Phase 1 MVP : roof et heightmap non supportés (ignorés silencieusement).
   */
  carveThrough: boolean;
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

// ---------------------------------------------------------------------------
// Résultats de calcul
// ---------------------------------------------------------------------------

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
 *
 * Les coordonnées `px, py` sont RELATIVES au panneau qui contient la pièce
 * (Panel.pieces). Une pièce dans `CutLayout.overflow` n'a ni `px`, ni `py`,
 * ni `rot` : elle est plus grande que le panneau lui-même.
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
 * Un panneau physique de contreplaqué. Toutes les `pieces` y sont placées
 * dans les bornes `[0, shW] × [0, shH]` avec leurs coordonnées relatives.
 */
export interface Panel {
  pieces: LayoutPiece[];
  shW: number;
  shH: number;
  usedArea: number;     // somme des (w * h) des pièces placées
  occupation: number;   // usedArea / (shW * shH), ∈ [0, 1]
}

/**
 * Résultat de `computeCutLayout`.
 * - `panels` : 1..N panneaux physiques. Vide si toutes les pièces sont en overflow.
 * - `overflow` : pièces plus grandes que le panneau lui-même (w > shW && h > shW).
 *                Jamais placées, jamais dessinées dans un panneau.
 */
export interface CutLayout {
  panels: Panel[];
  overflow: LayoutPiece[];
  totalUsedArea: number;
  meanOccupation: number;
}

// ---------------------------------------------------------------------------
// Résultats géométriques
// ---------------------------------------------------------------------------

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
