// src/components/tabs/PlanStatsSection.tsx
//
// Section "stats" de PlanTab. Port fidèle v15 (index.html:362-365,
// src/main.js:169-174). 4 lignes : panel size, usage %, pieces area,
// panel area. Divergence d'arrondi avec CalcTab (toFixed(0) ici vs
// toFixed(1) pour les surfaces, port fidèle v15 dans les deux cas).

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { computeCutLayout } from '@nichoir/core';
import {
  formatPlanArea,
  formatPlanSize,
  formatUsagePct,
} from '../../utils/planFormatters.js';
import styles from './PlanTab.module.css';

export function PlanStatsSection(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const t = useT();
  const { shW, shH, totalArea } = computeCutLayout(params);

  return (
    <div className={styles.section}>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.panel')}</span>
        <span className={styles.val}>{formatPlanSize(shW, shH)}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.usage')}</span>
        <span className={styles.val}>{formatUsagePct(totalArea, shW, shH)}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.area')}</span>
        <span className={styles.val}>{formatPlanArea(totalArea)}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.panelArea')}</span>
        <span className={styles.val}>{formatPlanArea(shW * shH)}</span>
      </div>
    </div>
  );
}
