// src/components/cut-plan/PanelCard.tsx
//
// Carte d'UN panneau : header (numéro + occupation %) + SVG inline responsive
// des pièces placées. Visuel fidèle v15 (fond sombre, palette accent).

'use client';

import type { Panel, LayoutPiece, Translator } from '@nichoir/core';
import styles from './CutLayout.module.css';

const SHEET_BG    = '#252018';
const SHEET_STROKE = '#4a4030';
const GRID_STROKE = '#302818';
const PIECE_STROKE = '#e8a955';
const LABEL_COLOR = '#fff';
const LABEL_DIM_COLOR = '#bbb';
const LABEL_ROT_COLOR = '#888';
const PIECE_FILL_OPACITY = 0.65;

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
      stroke={stroke} strokeWidth={1}
    />
  );
}

function renderPiece(
  p: LayoutPiece, idx: number, t: Translator, shW: number,
): React.JSX.Element | null {
  if (p.px === undefined || p.py === undefined) return null;
  const { px, py, w, h } = p as Required<Pick<LayoutPiece, 'px' | 'py'>> & LayoutPiece;

  const fill = p.color;
  const stroke = PIECE_STROKE;
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
      <text x={cx} y={cy - fs * 0.3} fontFamily="sans-serif" fontSize={fs} fill={LABEL_COLOR} textAnchor="middle" dominantBaseline="middle">{name}</text>
      <text x={cx} y={cy + fs * 0.75} fontFamily="sans-serif" fontSize={fs * 0.8} fill={LABEL_DIM_COLOR} textAnchor="middle" dominantBaseline="middle">{Math.round(origW)}×{Math.round(origH)}</text>
      {p.rot === true && (
        <text x={cx} y={cy + fs * 1.7} fontFamily="sans-serif" fontSize={fs * 0.65} fill={LABEL_ROT_COLOR} textAnchor="middle" dominantBaseline="middle">{t('plan.rotated')}</text>
      )}
    </g>
  );
}

function renderGrid(shW: number, shH: number): React.JSX.Element[] {
  const lines: React.JSX.Element[] = [];
  for (let g = 200; g < shW; g += 200) {
    lines.push(<line key={`gx-${g}`} x1={g} y1={0} x2={g} y2={shH} stroke={GRID_STROKE} strokeWidth={0.5} />);
  }
  for (let g = 200; g < shH; g += 200) {
    lines.push(<line key={`gy-${g}`} x1={0} y1={g} x2={shW} y2={g} stroke={GRID_STROKE} strokeWidth={0.5} />);
  }
  return lines;
}

export interface PanelCardProps {
  panel: Panel;
  panelIndex: number;    // 1-based pour l'affichage
  t: Translator;
}

export function PanelCard({ panel, panelIndex, t }: PanelCardProps): React.JSX.Element {
  const { pieces, shW, shH, occupation } = panel;
  const title = t('plan.panelN', { n: panelIndex });
  const occupationStr = `${Math.round(occupation * 100)}%`;

  return (
    <div className={styles.panelCard}>
      <div className={styles.panelHeader}>
        <span>{title}</span>
        <span>{t('plan.occupation')}: {occupationStr}</span>
      </div>
      <svg
        className={styles.svgPreview}
        viewBox={`0 0 ${shW} ${shH}`}
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={`${title} ${shW}×${shH} mm`}
        style={{ aspectRatio: `${shW}/${shH}` }}
      >
        <title>{`${title} ${shW}×${shH} mm`}</title>
        <rect x={0} y={0} width={shW} height={shH} fill={SHEET_BG} stroke={SHEET_STROKE} strokeWidth={Math.max(1, shW / 234)} />
        {renderGrid(shW, shH)}
        {pieces.map((p, i) => renderPiece(p, i, t, shW))}
      </svg>
    </div>
  );
}
