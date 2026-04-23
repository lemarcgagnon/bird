// src/components/tabs/DimTab.tsx
//
// Orchestrateur de l'onglet DIM. Assemble 3 sections (codex guardrail — pas
// plus de 3 sous-composants à ce stade pour garder la review lisible).

'use client';

import { DimBodySection } from './DimBodySection.js';
import { DimDoorSection } from './DimDoorSection.js';
import { DimPerchSection } from './DimPerchSection.js';
import { DimHangSection } from './DimHangSection.js';
import { useT } from '../../i18n/useT.js';
import styles from './DimTab.module.css';

export function DimTab(): React.JSX.Element {
  const t = useT();
  return (
    <div className={styles.root}>
      <DimBodySection />
      <DimDoorSection />
      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t('dim.accessories')}</div>
      </div>
      <DimPerchSection />
      <DimHangSection />
    </div>
  );
}
