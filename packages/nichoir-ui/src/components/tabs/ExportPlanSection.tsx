// src/components/tabs/ExportPlanSection.tsx
//
// Export ZIP multi-panneaux du plan de coupe. Un SVG par panneau (nommage
// panel-1.svg, panel-2.svg, ...). Déclenche via DownloadService.

'use client';

import { useState } from 'react';
import { computeCutLayout, generatePlanZIP } from '@nichoir/core';
import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { useDownloadService } from '../../adapters/DownloadServiceContext.js';
import { ExportButton } from '../primitives/ExportButton.js';
import styles from './ExportTab.module.css';

export function ExportPlanSection(): React.JSX.Element {
  const t = useT();
  const download = useDownloadService();
  const [error, setError] = useState<string | null>(null);

  const handleZip = async (): Promise<void> => {
    setError(null);
    try {
      const state = useNichoirStore.getState();
      const layout = computeCutLayout(state.params);
      const zipBytes = await generatePlanZIP(layout, t);
      const filename = `nichoir_plan_${state.params.panelW}x${state.params.panelH}.zip`;
      await download.trigger(zipBytes, filename, 'application/zip');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('export.error.generic', { message: msg }));
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('export.plan')}</div>
      <ExportButton
        label={t('plan.export.zip')}
        labelBusy={t('export.busy.zip.plan')}
        onClick={handleZip}
      />
      {error !== null && (
        <p role="alert" className={styles.error}>{error}</p>
      )}
    </div>
  );
}
