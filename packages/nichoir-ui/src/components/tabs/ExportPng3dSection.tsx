// src/components/tabs/ExportPng3dSection.tsx
//
// Capture du viewport Three.js actuel en PNG. La capture prend la vue
// courante (celle que l'utilisateur a orientée avec la souris).
// Requiert que le renderer WebGL soit monté avec preserveDrawingBuffer=true
// (cf. ImperativeThreeViewport.mount).

'use client';

import { useState } from 'react';
import { useT } from '../../i18n/useT.js';
import { useDownloadService } from '../../adapters/DownloadServiceContext.js';
import { useViewportRef } from '../../viewports/ViewportRefContext.js';
import { ExportButton } from '../primitives/ExportButton.js';
import styles from './ExportTab.module.css';

export function ExportPng3dSection(): React.JSX.Element {
  const t = useT();
  const download = useDownloadService();
  const viewportRef = useViewportRef();
  const [error, setError] = useState<string | null>(null);

  const handlePng = async (): Promise<void> => {
    setError(null);
    try {
      const vp = viewportRef.current;
      if (vp === null) {
        throw new Error(t('export.error.noViewport'));
      }
      const bytes = await vp.captureAsPng();
      const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
      const filename = `nichoir_3d_${ts}.png`;
      await download.trigger(bytes, filename, 'image/png');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('export.error.generic', { message: msg }));
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('export.png')}</div>
      <ExportButton
        label={t('png.export.3d')}
        labelBusy={t('export.busy.png.3d')}
        onClick={handlePng}
      />
      {error !== null && (
        <p role="alert" className={styles.error}>{error}</p>
      )}
    </div>
  );
}
