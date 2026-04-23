// src/state.ts
// Schéma d'état initial. Organisé en slices par domaine.
// Port fidèle de src/state.js. Divergence : `makeDecoSlot` ajoute 3 champs
// (parsedShapes, heightmapData, heightmapResolution) requis par le contrat
// TS DecoSlotCore et absents du src JS (shapes/rasterCanvas/resolution).

import type {
  DecoKey,
  DecoSlotCore,
  NichoirState,
} from './types.js';

export const DECO_KEYS: readonly DecoKey[] = [
  'front', 'back', 'left', 'right', 'roofL', 'roofR',
];

function makeDecoSlot(): DecoSlotCore {
  return {
    enabled: false,
    source: null,
    sourceType: null,
    parsedShapes: null,
    bbox: null,
    heightmapData: null,
    heightmapResolution: 64,
    mode: 'heightmap',
    w: 60, h: 60, posX: 50, posY: 50, rotation: 0,
    depth: 2, bevel: 0, invert: false, resolution: 64,
    clipToPanel: false,
    lastParseWarning: null,
  };
}

export function createInitialState(): NichoirState {
  const decos = {} as Record<DecoKey, DecoSlotCore>;
  DECO_KEYS.forEach(k => { decos[k] = makeDecoSlot(); });

  return {
    // Paramètres de géométrie (ex-objet `P`)
    params: {
      W: 160, H: 220, D: 160,
      slope: 35, overhang: 30, T: 12,
      mode: 'solid',
      explode: 0,
      floor: 'enclave',
      ridge: 'left',
      taperX: 0,
      door: 'none',
      doorFace: 'front',
      doorW: 38, doorH: 38, doorPX: 50, doorPY: 50, doorVar: 100,
      doorPanel: false, doorFollowTaper: false,
      perch: false, perchDiam: 8, perchLen: 30, perchOff: 15,
      hang: false, hangPosY: 20, hangOffsetX: 15, hangDiam: 5,
      panelW: 1220, panelH: 2440,
      palette: 'wood',
    },

    // Plans de coupe visuels (ex-objet `clip`)
    clip: {
      x: { on: false, pos: 0.5 },
      y: { on: false, pos: 0.5 },
      z: { on: false, pos: 0.5 },
    },

    // Caméra orbitale
    camera: {
      theta: Math.PI * 0.25,
      phi: Math.PI / 3.2,
      dist: 550,
      tx: 0, ty: 0, tz: 0,
    },

    // Décorations par panneau
    decos,
    activeDecoKey: 'front',

    // UI
    lang: 'fr',
    activeTab: 'dim',
  };
}
