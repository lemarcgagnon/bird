// src/components/tabs/ExportPlanSection.tsx
//
// Section PLAN de ExportTab. Port v15 (src/exporters/plan.js:exportPlanSVG)
// avec divergence structurelle documentée : le bouton plan SVG vivait dans
// l'onglet PLAN en v15, il est déplacé ici pour centraliser les exports
// sous un seul DownloadService (codex P2.6 validation).
//
// PNG reporté à P3 (rasterization browser, pas prioritaire — SVG reste
// l'export vectoriel de référence pour découpe laser/CNC).

'use client';

import { useState } from 'react';
import { computeCutLayout, generatePlanSVG } from '@nichoir/core';
import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { useDownloadService } from '../../adapters/DownloadServiceContext.js';
import { ExportButton } from '../primitives/ExportButton.js';
import styles from './ExportTab.module.css';

export function ExportPlanSection(): React.JSX.Element {
  const t = useT();
  const download = useDownloadService();
  const [error, setError] = useState<string | null>(null);

  const handleSvg = async (): Promise<void> => {
    setError(null);
    try {
      const state = useNichoirStore.getState();
      const layout = computeCutLayout(state.params);
      const svg = generatePlanSVG(layout, t);
      const filename = `nichoir_plan_${layout.shW}x${layout.shH}.svg`;
      await download.trigger(svg, filename, 'image/svg+xml');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('export.error.generic', { message: msg }));
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('export.plan')}</div>
      <ExportButton
        label={t('plan.export.svg')}
        labelBusy={t('export.busy.svg')}
        onClick={handleSvg}
      />
      {error !== null && (
        <p role="alert" className={styles.error}>{error}</p>
      )}
    </div>
  );
}
