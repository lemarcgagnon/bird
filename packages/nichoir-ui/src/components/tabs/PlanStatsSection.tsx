// src/components/tabs/PlanStatsSection.tsx
//
// Stats agrégées multi-bin : taille panneau, nb panneaux, occupation moyenne,
// aire totale pièces, aire totale panneaux, pièces overflow (si applicable).

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { computeCutLayout } from '@nichoir/core';
import { formatPlanArea, formatPlanSize } from '../../utils/planFormatters.js';
import styles from './PlanTab.module.css';

export function PlanStatsSection(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const t = useT();
  const layout = computeCutLayout(params);
  const nPanels = layout.panels.length;
  const totalPanelArea = nPanels * params.panelW * params.panelH;
  const meanOccPct = `${Math.round(layout.meanOccupation * 100)}%`;

  return (
    <div className={styles.section}>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.panel')}</span>
        <span className={styles.val}>{formatPlanSize(params.panelW, params.panelH)}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.panelCount')}</span>
        <span className={styles.val}>{nPanels}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.meanOccupation')}</span>
        <span className={styles.val}>{meanOccPct}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.area')}</span>
        <span className={styles.val}>{formatPlanArea(layout.totalUsedArea)}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.totalPanelArea')}</span>
        <span className={styles.val}>{formatPlanArea(totalPanelArea)}</span>
      </div>
      {layout.overflow.length > 0 && (
        <div className={styles.statRow}>
          <span className={styles.label}>{t('plan.overflowCount')}</span>
          <span className={styles.val}>{layout.overflow.length}</span>
        </div>
      )}
    </div>
  );
}
