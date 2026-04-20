// src/cut-plan.ts
// Layout 2D (shelf-packing).
// Port fidèle de src/cut-plan.js — computeCutLayout uniquement.
// Divergence : drawCutPlan est exclu (dépend de CanvasRenderingContext2D → nichoir-ui).

import type { Params, CutLayout, LayoutPiece } from './types.js';

const D2R = Math.PI / 180;

// Retourne { pieces, shW, shH, totalArea } — layout prêt à exporter.
export function computeCutLayout(params: Params): CutLayout {
  const { W, D, slope, overhang, T, floor, ridge, taperX, door, doorPanel, doorW, doorH, doorVar, panelW, panelH } = params;
  const ang = slope * D2R;
  const isPose = floor === 'pose';
  const H = params.H;
  const wallH = isPose ? H - T : H;
  const rH = (W / 2) * Math.tan(ang);
  const sL = (W / 2 + overhang) / Math.cos(ang);
  const rL = D + 2 * overhang;
  const bev = T * Math.tan(ang);
  const sL_L = ridge === 'left' ? sL + T : ridge === 'miter' ? sL : sL;
  const sL_R = ridge === 'right' ? sL + T : ridge === 'miter' ? sL : sL;
  const Wtop = W;
  const Wbot = W + 2 * taperX;
  const wallHreal = Math.sqrt(wallH * wallH + taperX * taperX);
  const floorW = isPose ? Wbot : Wbot - 2 * T;
  const floorD = isPose ? D : D - 2 * T;
  const sideD = D - 2 * T;

  const Wmax = Math.max(Wtop, Wbot);
  const pieces: LayoutPiece[] = [
    { nameKey: 'calc.cuts.facade', suffix: ' 1', w: Wmax, h: wallH + rH, color: '#d4a574', shape: 'pent', rH, wallH, Wtop, Wbot },
    { nameKey: 'calc.cuts.facade', suffix: ' 2', w: Wmax, h: wallH + rH, color: '#d4a574', shape: 'pent', rH, wallH, Wtop, Wbot },
    { nameKey: 'calc.cuts.side',   suffix: ' G', w: sideD, h: wallHreal, color: '#c49464', shape: 'rect' },
    { nameKey: 'calc.cuts.side',   suffix: ' D', w: sideD, h: wallHreal, color: '#c49464', shape: 'rect' },
    { nameKey: 'calc.cuts.bottom', w: floorW, h: floorD, color: '#b48454', shape: 'rect' },
    { nameKey: 'calc.cuts.roofL',  w: sL_L + (ridge === 'miter' ? bev : 0), h: rL, color: '#9e7044', shape: 'rect' },
    { nameKey: 'calc.cuts.roofR',  w: sL_R + (ridge === 'miter' ? bev : 0), h: rL, color: '#9e7044', shape: 'rect' },
  ];
  if (door !== 'none' && doorPanel) {
    const v = doorVar / 100;
    pieces.push({ nameKey: 'calc.cuts.door', w: doorW * v, h: doorH * v, color: '#e8c088', shape: 'rect' });
  }

  const shW = panelW, shH = panelH, gap = 5;
  const sorted = pieces.map((p, i) => ({ ...p, idx: i })).sort((a, b) => b.h - a.h);
  let shelfY = gap, shelfH = 0, curX = gap;
  let totalArea = 0;

  sorted.forEach(p => {
    const pw0 = p.w, ph0 = p.h;
    if (curX + pw0 + gap <= shW && shelfY + ph0 + gap <= shH) {
      p.px = curX; p.py = shelfY; p.rot = false;
      curX += pw0 + gap; shelfH = Math.max(shelfH, ph0);
    } else if (curX + ph0 + gap <= shW && shelfY + pw0 + gap <= shH) {
      p.px = curX; p.py = shelfY; p.rot = true;
      p.w = ph0; p.h = pw0;
      curX += p.w + gap; shelfH = Math.max(shelfH, p.h);
    } else if (pw0 + gap <= shW) {
      shelfY += shelfH + gap; curX = gap; shelfH = ph0;
      p.px = gap; p.py = shelfY; p.rot = false;
      curX = pw0 + gap + gap;
      if (shelfY + ph0 > shH) p.overflow = true;
    } else {
      shelfY += shelfH + gap; curX = gap; shelfH = pw0;
      p.px = gap; p.py = shelfY; p.rot = true;
      p.w = ph0; p.h = pw0;
      curX = p.w + gap + gap;
      if (shelfY + p.h > shH) p.overflow = true;
      if (p.w + gap > shW) p.overflow = true;
    }
    totalArea += (p.rot ? pw0 * ph0 : p.w * p.h);
  });

  return { pieces: sorted, shW, shH, totalArea };
}
