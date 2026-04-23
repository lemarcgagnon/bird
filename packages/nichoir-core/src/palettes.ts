// src/palettes.ts
//
// Palettes de couleurs pour les panneaux du nichoir. Appliquées à la fois
// en 3D (BufferGeometry material color via PanelDef.color) et en 2D
// (LayoutPiece.color dans le SVG du plan de coupe).
//
// La palette 'wood' REPRODUIT BIT-À-BIT les valeurs historiques (fixtures
// pré-feature palette). Les autres palettes introduisent de la teinte pour
// mieux distinguer les parties en rendu 3D.

export type PaletteKey = 'wood' | 'wood-contrast' | 'colorful' | 'mono';

export interface Palette {
  /** Façade avant + arrière (mêmes pièces logiquement). */
  facade: string;   // hex '#RRGGBB'
  /** Côtés gauche + droit. */
  side: string;
  /** Plancher. */
  bottom: string;
  /** Toit (roofL + roofR). */
  roof: string;
  /** Panneau de porte physique (quand doorPanel=true). */
  door: string;
}

export const PALETTES: Record<PaletteKey, Palette> = {
  wood: {
    facade: '#d4a574',
    side:   '#c49464',
    bottom: '#b48454',
    roof:   '#9e7044',
    door:   '#e8c088',
  },
  'wood-contrast': {
    facade: '#e8c088',  // light golden birch
    side:   '#8b5a2b',  // medium walnut
    bottom: '#4a2e18',  // dark espresso
    roof:   '#a8352a',  // sienna / terracotta
    door:   '#d97936',  // amber
  },
  colorful: {
    facade: '#f5deb3',  // cream / wheat
    side:   '#8fbc8f',  // sage green
    bottom: '#708090',  // slate gray
    roof:   '#d2691e',  // terracotta
    door:   '#daa520',  // mustard / goldenrod
  },
  mono: {
    facade: '#d0d0d0',  // light gray
    side:   '#909090',  // medium gray
    bottom: '#505050',  // dark gray
    roof:   '#303030',  // very dark gray
    door:   '#e0e0e0',  // very light gray
  },
};

/**
 * Convertit un string hex '#RRGGBB' en number hex 0xRRGGBB.
 * Utilisé par `buildPanelDefs` qui attend un number pour PanelDef.color.
 */
export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
