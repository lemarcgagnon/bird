// src/components/tabs/CalcMaterialSection.tsx
//
// Section "matériau requis" de CalcTab (read-only). Port v15
// index.html:332-334 + src/main.js:83-85.
// Rend : épaisseur (dual mm + inch) + total pièces (via piecesCount).

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { computeCalculations, computeCutList } from '@nichoir/core';
import { formatThickness } from '../../utils/calcFormatters.js';
import styles from './CalcTab.module.css';

export function CalcMaterialSection(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const t = useT();
  const { derived } = computeCalculations(params);
  const { nPieces } = computeCutList(params, derived);

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('calc.material')}</div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('calc.material.thickness')}</span>
        <span className={styles.val}>{formatThickness(params.T)}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('calc.material.pieces')}</span>
        <span className={styles.val}>{t('calc.material.piecesCount', { n: nPieces })}</span>
      </div>
    </div>
  );
}
