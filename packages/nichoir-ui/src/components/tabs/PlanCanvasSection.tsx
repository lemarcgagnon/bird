// src/components/tabs/PlanCanvasSection.tsx
//
// Preview SVG inline du layout de découpe. Port **sémantique** du canvas
// v15 (src/cut-plan.js:77-151 `drawCutPlan`) — DIVERGENCE structurelle :
// canvas 2D → SVG inline. Visuel fidèle v15 conservé (fond sombre, stroke
// accent, fill alpha, rouge overflow).
//
// Implémentation AUTONOME (garde-fou codex P2.5) :
//   - Ne réutilise PAS `generatePlanSVG()` de @nichoir/core/exporters/svg.ts.
//     Celui-ci est pensé pour l'export (prolog XML, fond blanc, dimensions en
//     mm sur <svg width/height>). Il ne correspond pas au rendu preview
//     sidebar v15 (fond sombre, stroke orange).
//   - Produit un rendu JSX déclaratif directement depuis `CutLayout`.
//
// Accessibilité :
//   - role="img" + <title> + aria-label sur le <svg> pour que les
//     technologies d'assistance puissent annoncer "Plan de coupe 1220×2440 mm"
//     plutôt que "image".

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { computeCutLayout } from '@nichoir/core';
import type { CutLayout, LayoutPiece, Translator } from '@nichoir/core';
import { formatPlanSize } from '../../utils/planFormatters.js';
import styles from './PlanTab.module.css';

// Palette fidèle v15 (src/cut-plan.js:87-148)
const SHEET_BG    = '#252018';
const SHEET_STROKE = '#4a4030';
const GRID_STROKE = '#302818';
const PIECE_STROKE = '#e8a955';
const OVERFLOW_FILL = '#661a1a';
const OVERFLOW_STROKE = '#ff4444';
const LABEL_COLOR = '#fff';
const LABEL_DIM_COLOR = '#bbb';
const LABEL_ROT_COLOR = '#888';
const PIECE_FILL_OPACITY = 0.65;

function renderPiece(
  p: LayoutPiece,
  idx: number,
  t: Translator,
  shW: number,
): React.JSX.Element | null {
  if (p.px === undefined || p.py === undefined) return null;

  const { px, py, w, h } = p as Required<Pick<LayoutPiece, 'px' | 'py'>> & LayoutPiece;
  const isOverflow = p.overflow === true;
  const fill = isOverflow ? OVERFLOW_FILL : p.color;
  const stroke = isOverflow ? OVERFLOW_STROKE : PIECE_STROKE;

  // Taille de font équivalente à v15 canvas `Math.max(7, Math.min(10, w*0.15))`
  // translatée en unités viewBox (mm). Sur un viewBox mm, fs en mm doit rester
  // lisible à l'échelle rendu. v15 utilisait des pixels canvas, on approxime
  // par une échelle équivalente en mm.
  const fs = Math.max(shW * 0.025, Math.min(shW * 0.04, w * 0.12));

  const origW = p.rot === true ? p.h : p.w;
  const origH = p.rot === true ? p.w : p.h;
  const name = t(p.nameKey) + (p.suffix ?? '');
  const cx = px + w / 2;
  const cy = py + h / 2;

  const shapeElement =
    p.shape === 'pent' && p.rot !== true
      ? renderPentagon(p, px, py, w, h, fill, stroke)
      : (
        <rect
          x={px} y={py} width={w} height={h}
          fill={fill} fillOpacity={PIECE_FILL_OPACITY}
          stroke={stroke} strokeWidth={Math.max(0.3, shW * 0.0008)}
        />
      );

  return (
    <g key={`piece-${idx}`}>
      {shapeElement}
      <text
        x={cx} y={cy - fs * 0.3}
        fontFamily="sans-serif" fontSize={fs}
        fill={LABEL_COLOR}
        textAnchor="middle" dominantBaseline="middle"
      >
        {name}
      </text>
      <text
        x={cx} y={cy + fs * 0.75}
        fontFamily="sans-serif" fontSize={fs * 0.8}
        fill={LABEL_DIM_COLOR}
        textAnchor="middle" dominantBaseline="middle"
      >
        {Math.round(origW)}×{Math.round(origH)}
      </text>
      {p.rot === true && (
        <text
          x={cx} y={cy + fs * 1.7}
          fontFamily="sans-serif" fontSize={fs * 0.65}
          fill={LABEL_ROT_COLOR}
          textAnchor="middle" dominantBaseline="middle"
        >
          {t('plan.rotated')}
        </text>
      )}
    </g>
  );
}

function renderPentagon(
  p: LayoutPiece, x: number, y: number, w: number, h: number,
  fill: string, stroke: string,
): React.JSX.Element {
  const wHs = p.wallH ?? 0;
  const Wb = p.Wbot ?? w;
  const Wt = p.Wtop ?? w;
  const Wmax = Math.max(Wb, Wt);
  const bottomInset = (Wmax - Wb) / 2;
  const topInset = (Wmax - Wt) / 2;
  const pts: Array<[number, number]> = [
    [x + bottomInset,       y + h],
    [x + bottomInset + Wb,  y + h],
    [x + topInset + Wt,     y + h - wHs],
    [x + Wmax / 2,          y],
    [x + topInset,          y + h - wHs],
  ];
  return (
    <polygon
      points={pts.map((pt) => pt.join(',')).join(' ')}
      fill={fill} fillOpacity={PIECE_FILL_OPACITY}
      stroke={stroke} strokeWidth={Math.max(0.3, x * 0 + 1)}
    />
  );
}

function renderGrid(shW: number, shH: number): React.JSX.Element[] {
  const lines: React.JSX.Element[] = [];
  for (let g = 200; g < shW; g += 200) {
    lines.push(
      <line
        key={`gx-${g}`}
        x1={g} y1={0} x2={g} y2={shH}
        stroke={GRID_STROKE} strokeWidth={0.5}
      />,
    );
  }
  for (let g = 200; g < shH; g += 200) {
    lines.push(
      <line
        key={`gy-${g}`}
        x1={0} y1={g} x2={shW} y2={g}
        stroke={GRID_STROKE} strokeWidth={0.5}
      />,
    );
  }
  return lines;
}

export function PlanCanvasSection(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const t = useT();
  const layout: CutLayout = computeCutLayout(params);
  const { pieces, shW, shH } = layout;

  const title = `${t('plan.panel')} ${formatPlanSize(shW, shH)}`;

  return (
    <svg
      className={styles.svgPreview}
      viewBox={`0 0 ${shW} ${shH}`}
      preserveAspectRatio="xMinYMin meet"
      role="img"
      aria-label={title}
      style={{ aspectRatio: `${shW}/${shH}` }}
    >
      <title>{title}</title>
      <rect
        x={0} y={0} width={shW} height={shH}
        fill={SHEET_BG} stroke={SHEET_STROKE} strokeWidth={Math.max(1, shW / 234)}
      />
      {renderGrid(shW, shH)}
      {pieces.map((p, i) => renderPiece(p, i, t, shW))}
    </svg>
  );
}
