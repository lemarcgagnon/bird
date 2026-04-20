// src/exporters/plan.js
// Export du plan de coupe en PNG (haute résolution) et SVG (vectoriel, mm réels).

import { t } from '../i18n.js';

export function exportPlanPNG(canvas, layout) {
  const { shW, shH } = layout;
  const tmp = document.createElement('canvas');
  const highScale = 2;
  tmp.width = canvas.width * highScale;
  tmp.height = canvas.height * highScale;
  const tctx = tmp.getContext('2d');
  tctx.scale(highScale, highScale);
  tctx.drawImage(canvas, 0, 0);
  tmp.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'nichoir_plan_' + shW + 'x' + shH + '.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}

export function exportPlanSVG(layout) {
  const { pieces, shW, shH } = layout;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${shW}mm" height="${shH}mm" viewBox="0 0 ${shW} ${shH}">\n`;
  svg += `<title>Nichoir - Plan de coupe ${shW} x ${shH} mm</title>\n`;
  svg += `<rect x="0" y="0" width="${shW}" height="${shH}" fill="none" stroke="#000" stroke-width="1"/>\n`;

  for (let g = 200; g < shW; g += 200) svg += `<line x1="${g}" y1="0" x2="${g}" y2="${shH}" stroke="#ddd" stroke-width="0.3"/>\n`;
  for (let g = 200; g < shH; g += 200) svg += `<line x1="0" y1="${g}" x2="${shW}" y2="${g}" stroke="#ddd" stroke-width="0.3"/>\n`;

  pieces.forEach(p => {
    if (p.px === undefined) return;
    const x = p.px, y = p.py, w = p.w, h = p.h;
    const stroke = p.overflow ? '#e04040' : '#000';
    const fill = p.overflow ? '#fadede' : p.color + '40';

    if (p.shape === 'pent' && !p.rot) {
      const wHs = p.wallH;
      const Wb = p.Wbot || p.w;
      const Wt = p.Wtop || p.w;
      const inset = (Wb - Wt) / 2;
      const pts = [
        [x,              y + h],
        [x + Wb,         y + h],
        [x + Wb - inset, y + h - wHs],
        [x + Wb/2,       y],
        [x + inset,      y + h - wHs],
      ];
      svg += `<polygon points="${pts.map(pt => pt.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>\n`;
    } else {
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>\n`;
    }

    const origW = p.rot ? p.h : p.w;
    const origH = p.rot ? p.w : p.h;
    const cx = x + w/2, cy = y + h/2;
    const fs = Math.min(20, Math.max(8, w*0.08));
    const name = t(p.nameKey) + (p.suffix || '');
    svg += `<text x="${cx}" y="${cy - fs*0.5}" font-family="sans-serif" font-size="${fs}" text-anchor="middle" fill="#000">${name}</text>\n`;
    svg += `<text x="${cx}" y="${cy + fs*0.8}" font-family="sans-serif" font-size="${fs*0.8}" text-anchor="middle" fill="#555">${Math.round(origW)}×${Math.round(origH)} mm</text>\n`;
    if (p.rot) svg += `<text x="${cx}" y="${cy + fs*2}" font-family="sans-serif" font-size="${fs*0.7}" text-anchor="middle" fill="#888">${t('plan.rotated')}</text>\n`;
  });

  svg += '</svg>\n';

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nichoir_plan_' + shW + 'x' + shH + '.svg';
  a.click();
  URL.revokeObjectURL(a.href);
}
