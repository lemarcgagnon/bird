// src/cut-plan.js
// Layout 2D (shelf-packing) et dessin sur canvas.
// L'export SVG/PNG vit dans exporters/plan.js.

import { t } from './i18n.js';

const D2R = Math.PI / 180;

// Retourne { pieces, shW, shH, totalArea } — layout prêt à dessiner ou exporter.
export function computeCutLayout(params) {
  const { W, D, slope, overhang, T, floor, ridge, taperX, door, doorPanel, doorW, doorH, doorVar, panelW, panelH } = params;
  const ang = slope * D2R;
  const isPose = floor === 'pose';
  const H = params.H;
  const wallH = isPose ? H - T : H;
  const rH = (W/2) * Math.tan(ang);
  const sL = (W/2 + overhang) / Math.cos(ang);
  const rL = D + 2*overhang;
  const bev = T * Math.tan(ang);
  const sL_L = ridge === 'left' ? sL + T : ridge === 'miter' ? sL : sL;
  const sL_R = ridge === 'right' ? sL + T : ridge === 'miter' ? sL : sL;
  const Wtop = W;
  const Wbot = W + 2 * taperX;
  const wallHreal = Math.sqrt(wallH*wallH + taperX*taperX);
  const floorW = isPose ? Wbot : Wbot - 2*T;
  const floorD = isPose ? D : D - 2*T;
  const sideD = D - 2*T;

  const Wmax = Math.max(Wtop, Wbot);
  const pieces = [
    { nameKey: 'calc.cuts.facade', suffix: ' 1', w: Wmax, h: wallH+rH, color: '#d4a574', shape: 'pent', rH, wallH, Wtop, Wbot },
    { nameKey: 'calc.cuts.facade', suffix: ' 2', w: Wmax, h: wallH+rH, color: '#d4a574', shape: 'pent', rH, wallH, Wtop, Wbot },
    { nameKey: 'calc.cuts.side',   suffix: ' G', w: sideD, h: wallHreal, color: '#c49464', shape: 'rect' },
    { nameKey: 'calc.cuts.side',   suffix: ' D', w: sideD, h: wallHreal, color: '#c49464', shape: 'rect' },
    { nameKey: 'calc.cuts.bottom', w: floorW, h: floorD, color: '#b48454', shape: 'rect' },
    { nameKey: 'calc.cuts.roofL',  w: sL_L + (ridge === 'miter' ? bev : 0), h: rL, color: '#9e7044', shape: 'rect' },
    { nameKey: 'calc.cuts.roofR',  w: sL_R + (ridge === 'miter' ? bev : 0), h: rL, color: '#9e7044', shape: 'rect' },
  ];
  if (door !== 'none' && doorPanel) {
    const v = doorVar / 100;
    pieces.push({ nameKey: 'calc.cuts.door', w: doorW*v, h: doorH*v, color: '#e8c088', shape: 'rect' });
  }

  const shW = panelW, shH = panelH, gap = 5;
  const sorted = pieces.map((p, i) => ({ ...p, idx: i })).sort((a, b) => b.h - a.h);
  let shelfY = gap, shelfH = 0, curX = gap, totalArea = 0;

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

// Dessine le layout sur le canvas (aperçu sidebar).
export function drawCutPlan(cv, layout) {
  const { pieces, shW, shH } = layout;
  const cvW = 234;
  cv.width = cvW;
  cv.height = Math.round(cvW * shH / shW);
  const scale = cvW / shW;

  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);

  ctx.fillStyle = '#252018';
  ctx.fillRect(0, 0, shW*scale, shH*scale);
  ctx.strokeStyle = '#4a4030';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, shW*scale, shH*scale);

  ctx.strokeStyle = '#302818';
  ctx.lineWidth = 0.5;
  for (let g = 200; g < shW; g += 200) { ctx.beginPath(); ctx.moveTo(g*scale, 0); ctx.lineTo(g*scale, shH*scale); ctx.stroke(); }
  for (let g = 200; g < shH; g += 200) { ctx.beginPath(); ctx.moveTo(0, g*scale); ctx.lineTo(shW*scale, g*scale); ctx.stroke(); }

  pieces.forEach(p => {
    if (p.px === undefined) return;
    const x = p.px*scale, y = p.py*scale, w = p.w*scale, h = p.h*scale;

    ctx.fillStyle = p.overflow ? '#661a1a' : p.color;
    ctx.globalAlpha = 0.65;

    if (p.shape === 'pent' && !p.rot) {
      const wHs = p.wallH * scale;
      const Wbs = (p.Wbot || p.w) * scale;
      const Wts = (p.Wtop || p.w) * scale;
      const Wmaxs = Math.max(Wbs, Wts);
      const bottomInset = (Wmaxs - Wbs) / 2;
      const topInset = (Wmaxs - Wts) / 2;
      ctx.beginPath();
      ctx.moveTo(x + bottomInset,        y + h);
      ctx.lineTo(x + bottomInset + Wbs,  y + h);
      ctx.lineTo(x + topInset + Wts,     y + h - wHs);
      ctx.lineTo(x + Wmaxs/2,            y);
      ctx.lineTo(x + topInset,           y + h - wHs);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = p.overflow ? '#ff4444' : '#e8a955';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = p.overflow ? '#ff4444' : '#e8a955';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    const fs = Math.max(7, Math.min(10, w*0.15));
    ctx.font = fs + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const name = t(p.nameKey) + (p.suffix || '');
    ctx.fillText(name, x + w/2, y + h/2 - fs*0.6);
    ctx.font = (fs-1) + 'px sans-serif';
    ctx.fillStyle = '#bbb';
    const origW = p.rot ? p.h : p.w;
    const origH = p.rot ? p.w : p.h;
    ctx.fillText(Math.round(origW) + '×' + Math.round(origH), x + w/2, y + h/2 + fs*0.6);
    if (p.rot) {
      ctx.font = (fs-2) + 'px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText(t('plan.rotated'), x + w/2, y + h/2 + fs*1.6);
    }
  });
}
