// src/components/tabs/CalcVolumesSection.tsx
//
// Section "volumes" de CalcTab (read-only). Port v15 index.html:317-320.
// Rend : ext, int, mat (en variant sub).

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { computeCalculations } from '@nichoir/core';
import { formatVolume } from '../../utils/calcFormatters.js';
import styles from './CalcTab.module.css';

export function CalcVolumesSection(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const t = useT();
  const { volumes } = computeCalculations(params);

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('calc.volumes')}</div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('calc.volume.ext')}</span>
        <span className={styles.val}>{formatVolume(volumes.ext)}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('calc.volume.int')}</span>
        <span className={styles.val}>{formatVolume(volumes.int)}</span>
      </div>
      <div className={`${styles.statRow} ${styles.statRowSub}`}>
        <span className={styles.label}>{t('calc.volume.mat')}</span>
        <span className={styles.val}>{formatVolume(volumes.mat)}</span>
      </div>
    </div>
  );
}
