// src/components/tabs/DecoStatusSection.tsx
//
// Status du fichier chargé dans DecoTab (P2.7b). Port fidèle v15
// (src/ui/deco-panel.js:186-207).
//
// Formats produits :
//   - Slot vide : "Aucun fichier chargé — Façade avant"
//     (deco.status.emptyFor + panel interpolé)
//   - SVG avec shapes : "SVG · 3 formes · raster 256×256 — Façade avant"
//   - SVG dégradé sans shapes : "SVG · raster 256×256 — Façade avant"
//     (segment ' · N forme(s)' omis quand parsedShapes est null ou vide)
//   - Image PNG/JPG : "Image · raster 256×256 — Façade avant"
//
// Divergences v15 assumées :
//   - Tokens 'SVG' et 'Image' hardcodés (fidélité v15, identiques fr/en).
//   - Constante `RASTER_SOURCE_SIZE` (256) importée du helper plutôt que
//     dérivée de `heightmapData.length` — le heightmap vit à
//     `heightmapResolution`, pas 256 (codex P2.7b : status découplé du buffer).

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { RASTER_SOURCE_SIZE } from '../../utils/parseDecoFile.js';
import styles from './DecoTab.module.css';

export function DecoStatusSection(): React.JSX.Element {
  const activeDecoKey = useNichoirStore((s) => s.activeDecoKey);
  const slot = useNichoirStore((s) => s.decos[activeDecoKey]);
  const t = useT();

  const panelLabel = t(`deco.target.${activeDecoKey}`);

  let text: string;
  if (slot.source === null) {
    text = t('deco.status.emptyFor', { panel: panelLabel });
  } else {
    const kind = slot.sourceType === 'svg' ? 'SVG' : 'Image';
    let detail = '';
    if (slot.sourceType === 'svg' && slot.parsedShapes !== null && slot.parsedShapes.length > 0) {
      const n = slot.parsedShapes.length;
      const shapeStr = n > 1
        ? t('deco.svg.shapesCountPlural', { n })
        : t('deco.svg.shapesCount', { n });
      detail += ` · ${shapeStr}`;
    }
    detail += ` · ${t('deco.raster.size', { w: RASTER_SOURCE_SIZE, h: RASTER_SOURCE_SIZE })}`;
    text = `${kind}${detail} — ${panelLabel}`;
  }

  return (
    <div className={styles.statusSection}>
      <div className={styles.statusText}>{text}</div>
    </div>
  );
}
