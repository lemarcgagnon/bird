// src/state.js
// Schéma d'état initial. Organisé en slices par domaine.
// Les actions qui mutent ces slices vivent dans actions.js.

export const DECO_KEYS = ['front', 'back', 'left', 'right', 'roofL', 'roofR'];

function makeDecoSlot() {
  return {
    enabled: false,
    source: null,
    sourceType: null,       // 'svg' | 'image'
    shapes: null,           // tableau de THREE.Shape pour le mode vectoriel
    bbox: null,             // {minX, minY, maxX, maxY}
    rasterCanvas: null,     // canvas offscreen pour heightmap
    mode: 'heightmap',      // 'vector' | 'heightmap'
    w: 60, h: 60, posX: 50, posY: 50, rotation: 0,
    depth: 2, bevel: 0, invert: false, resolution: 64,
    clipToPanel: false,
    lastParseWarning: null,
  };
}

export function createInitialState() {
  const decos = {};
  DECO_KEYS.forEach(k => { decos[k] = makeDecoSlot(); });

  return {
    // Paramètres de géométrie (ex-objet `P`)
    params: {
      W: 160, H: 220, D: 160,
      slope: 35, overhang: 30, T: 12,
      mode: 'solid',            // affichage: solid | wireframe | xray | edges
      explode: 0,
      floor: 'enclave',         // enclave | pose
      ridge: 'left',            // left | right | miter
      taperX: 0,
      door: 'none',             // none | round | square | pentagon
      doorW: 38, doorH: 38, doorPX: 50, doorPY: 50, doorVar: 100,
      doorPanel: false, doorFollowTaper: false,
      perch: false, perchDiam: 8, perchLen: 30, perchOff: 15,
      panelW: 1220, panelH: 2440,
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
    lang: 'fr',                 // 'fr' | 'en'
    activeTab: 'dim',           // dim | vue | deco | calc | plan | export
  };
}
