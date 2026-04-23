// src/cut-plan.ts
// Layout 2D multi-bin (shelf-packing).
// Multi-bin : quand une pièce ne rentre pas sur le panneau courant,
// on ferme ce panneau et on en ouvre un nouveau. Une pièce plus grande
// que le panneau lui-même atterrit dans `overflow`, jamais dans un panneau.

import { PALETTES } from './palettes.js';
import type { Params, CutLayout, LayoutPiece, Panel } from './types.js';

const D2R = Math.PI / 180;
const GAP = 5;

export interface WorkingPiece extends LayoutPiece {
  _w0: number;  // largeur originale
  _h0: number;  // hauteur originale
}

/**
 * Construit la cut list des 7 pièces (+ 1 optionnelle porte) depuis `params`.
 * Exporté : partagé avec `cut-plan-rectpack.ts` (branche `coupe`) pour
 * garantir une comparaison d'algos à armes strictement égales.
 */
export function buildCutList(params: Params): WorkingPiece[] {
  const { W, D, slope, overhang, T, floor, ridge, taperX, door, doorPanel, doorW, doorH, doorVar } = params;
  const ang = slope * D2R;
  const isPose = floor === 'pose';
  const H = params.H;
  const wallH = isPose ? H - T : H;
  const rH = (W / 2) * Math.tan(ang);
  const sL = (W / 2 + overhang) / Math.cos(ang);
  const rL = D + 2 * overhang;
  const bev = T * Math.tan(ang);
  const sL_L = ridge === 'left' ? sL + T : sL;
  const sL_R = ridge === 'right' ? sL + T : sL;
  const Wtop = W;
  const Wbot = W + 2 * taperX;
  const wallHreal = Math.sqrt(wallH * wallH + taperX * taperX);
  const floorW = isPose ? Wbot : Wbot - 2 * T;
  const floorD = isPose ? D : D - 2 * T;
  const sideD = D - 2 * T;
  const Wmax = Math.max(Wtop, Wbot);

  const pal = PALETTES[params.palette];

  const pieces: WorkingPiece[] = [
    { nameKey: 'calc.cuts.facade', suffix: ' 1', w: Wmax, h: wallH + rH, color: pal.facade, shape: 'pent', rH, wallH, Wtop, Wbot, _w0: Wmax, _h0: wallH + rH },
    { nameKey: 'calc.cuts.facade', suffix: ' 2', w: Wmax, h: wallH + rH, color: pal.facade, shape: 'pent', rH, wallH, Wtop, Wbot, _w0: Wmax, _h0: wallH + rH },
    { nameKey: 'calc.cuts.side',   suffix: ' G', w: sideD, h: wallHreal, color: pal.side, shape: 'rect', _w0: sideD, _h0: wallHreal },
    { nameKey: 'calc.cuts.side',   suffix: ' D', w: sideD, h: wallHreal, color: pal.side, shape: 'rect', _w0: sideD, _h0: wallHreal },
    { nameKey: 'calc.cuts.bottom', w: floorW, h: floorD, color: pal.bottom, shape: 'rect', _w0: floorW, _h0: floorD },
    { nameKey: 'calc.cuts.roofL',  w: sL_L + (ridge === 'miter' ? bev : 0), h: rL, color: pal.roof, shape: 'rect', _w0: sL_L + (ridge === 'miter' ? bev : 0), _h0: rL },
    { nameKey: 'calc.cuts.roofR',  w: sL_R + (ridge === 'miter' ? bev : 0), h: rL, color: pal.roof, shape: 'rect', _w0: sL_R + (ridge === 'miter' ? bev : 0), _h0: rL },
  ];
  if (door !== 'none' && doorPanel) {
    const v = doorVar / 100;
    const w = doorW * v, h = doorH * v;
    pieces.push({ nameKey: 'calc.cuts.door', w, h, color: pal.door, shape: 'rect', _w0: w, _h0: h });
  }
  return pieces;
}

/** Vrai si la pièce est plus grande que le panneau, même en rotation. */
function isPieceTooBig(p: WorkingPiece, shW: number, shH: number): boolean {
  const fitsNormal = p._w0 + 2 * GAP <= shW && p._h0 + 2 * GAP <= shH;
  const fitsRotated = p._h0 + 2 * GAP <= shW && p._w0 + 2 * GAP <= shH;
  return !fitsNormal && !fitsRotated;
}

interface PanelState {
  pieces: LayoutPiece[];
  shelfY: number;
  shelfH: number;
  curX: number;
}

function emptyPanelState(): PanelState {
  return { pieces: [], shelfY: GAP, shelfH: 0, curX: GAP };
}

/** Essaie de placer `p` dans l'état panel courant. Muter `p` et `ps` si succès. Retourne `true` si placé. */
function tryPlace(p: WorkingPiece, ps: PanelState, shW: number, shH: number): boolean {
  const pw0 = p._w0, ph0 = p._h0;

  // Même ligne, orientation normale
  if (ps.curX + pw0 + GAP <= shW && ps.shelfY + ph0 + GAP <= shH) {
    p.px = ps.curX; p.py = ps.shelfY; p.rot = false;
    p.w = pw0; p.h = ph0;
    ps.curX += pw0 + GAP;
    ps.shelfH = Math.max(ps.shelfH, ph0);
    ps.pieces.push(p);
    return true;
  }
  // Même ligne, orientation pivotée
  if (ps.curX + ph0 + GAP <= shW && ps.shelfY + pw0 + GAP <= shH) {
    p.px = ps.curX; p.py = ps.shelfY; p.rot = true;
    p.w = ph0; p.h = pw0;
    ps.curX += ph0 + GAP;
    ps.shelfH = Math.max(ps.shelfH, pw0);
    ps.pieces.push(p);
    return true;
  }
  // Nouvelle ligne, orientation normale
  const nextY = ps.shelfY + ps.shelfH + GAP;
  if (pw0 + 2 * GAP <= shW && nextY + ph0 + GAP <= shH) {
    ps.shelfY = nextY;
    ps.shelfH = ph0;
    ps.curX = pw0 + 2 * GAP;
    p.px = GAP; p.py = ps.shelfY; p.rot = false;
    p.w = pw0; p.h = ph0;
    ps.pieces.push(p);
    return true;
  }
  // Nouvelle ligne, orientation pivotée
  if (ph0 + 2 * GAP <= shW && nextY + pw0 + GAP <= shH) {
    ps.shelfY = nextY;
    ps.shelfH = pw0;
    ps.curX = ph0 + 2 * GAP;
    p.px = GAP; p.py = ps.shelfY; p.rot = true;
    p.w = ph0; p.h = pw0;
    ps.pieces.push(p);
    return true;
  }
  return false;
}

function panelFromState(ps: PanelState, shW: number, shH: number): Panel {
  const usedArea = ps.pieces.reduce((acc, p) => acc + p.w * p.h, 0);
  return {
    pieces: ps.pieces,
    shW,
    shH,
    usedArea,
    occupation: shW * shH > 0 ? usedArea / (shW * shH) : 0,
  };
}

export function computeCutLayout(params: Params): CutLayout {
  const shW = params.panelW;
  const shH = params.panelH;
  const allPieces = buildCutList(params);

  // Tri par hauteur desc (conserve l'ordre historique du shelf-packing).
  const sorted = allPieces
    .map((p, i) => ({ ...p, idx: i }))
    .sort((a, b) => b._h0 - a._h0);

  const overflow: LayoutPiece[] = [];
  const panels: Panel[] = [];
  let current: PanelState | null = null;

  for (const p of sorted) {
    if (isPieceTooBig(p, shW, shH)) {
      // Strip working fields before returning
      const { _w0, _h0, ...clean } = p;
      void _w0; void _h0;
      overflow.push(clean);
      continue;
    }
    if (current === null) {
      current = emptyPanelState();
    }
    if (!tryPlace(p, current, shW, shH)) {
      // Close current, open a new one. A piece that is NOT too big must fit on an empty panel.
      panels.push(panelFromState(current, shW, shH));
      current = emptyPanelState();
      const placed = tryPlace(p, current, shW, shH);
      if (!placed) {
        // Defense in depth — should not happen since isPieceTooBig returned false.
        const { _w0, _h0, ...clean } = p;
        void _w0; void _h0;
        overflow.push(clean);
      }
    }
  }
  if (current !== null && current.pieces.length > 0) {
    panels.push(panelFromState(current, shW, shH));
  }

  // Strip working fields from all placed pieces.
  for (const panel of panels) {
    panel.pieces = panel.pieces.map(p => {
      const q = p as unknown as WorkingPiece;
      const { _w0, _h0, ...clean } = q;
      void _w0; void _h0;
      return clean;
    });
  }

  const totalUsedArea = panels.reduce((acc, p) => acc + p.usedArea, 0);
  const meanOccupation = panels.length === 0
    ? 0
    : panels.reduce((acc, p) => acc + p.occupation, 0) / panels.length;

  return { panels, overflow, totalUsedArea, meanOccupation };
}
