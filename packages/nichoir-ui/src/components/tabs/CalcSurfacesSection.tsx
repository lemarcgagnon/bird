// src/components/tabs/CalcSurfacesSection.tsx
//
// Section "surfaces" de CalcTab (read-only). Port v15 index.html:322-327.
// Rend : total + 4 sub (facades, sides, bottom, roof).

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { computeCalculations } from '@nichoir/core';
import { formatArea } from '../../utils/calcFormatters.js';
import styles from './CalcTab.module.css';

export function CalcSurfacesSection(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const t = useT();
  const { surfaces } = computeCalculations(params);

  const subRows: Array<{ labelKey: string; value: number }> = [
    { labelKey: 'calc.surface.facades', value: surfaces.facades },
    { labelKey: 'calc.surface.sides',   value: surfaces.sides   },
    { labelKey: 'calc.surface.bottom',  value: surfaces.bottom  },
    { labelKey: 'calc.surface.roof',    value: surfaces.roof    },
  ];

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('calc.surfaces')}</div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('calc.surface.total')}</span>
        <span className={styles.val}>{formatArea(surfaces.total)}</span>
      </div>
      {subRows.map((r) => (
        <div key={r.labelKey} className={`${styles.statRow} ${styles.statRowSub}`}>
          <span className={styles.label}>{t(r.labelKey)}</span>
          <span className={styles.val}>{formatArea(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
