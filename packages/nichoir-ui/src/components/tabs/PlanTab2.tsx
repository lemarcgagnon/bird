// src/components/tabs/PlanTab2.tsx
//
// Onglet "Plan de coupe 2" : même structure que PlanTab, algorithme différent
// (rectangle-packer au lieu de shelf-packing). Permet une comparaison
// visuelle directe en switchant d'onglet. Réutilise PlanSizeSection et
// PlanStatsSection tels quels.
//
// Note : PlanStatsSection calcule ses stats via computeCutLayout (shelf),
// donc les stats affichés en bas de PlanTab2 reflètent l'algo shelf-packing.
// Inconsistance assumée pour le MVP — la comparaison chiffrée se fait via
// le benchmark CLI (pas l'UI).

'use client';

import { PlanSizeSection } from './PlanSizeSection.js';
import { PlanCanvasSection2 } from './PlanCanvasSection2.js';
import { PlanStatsSection } from './PlanStatsSection.js';
import styles from './PlanTab.module.css';

export function PlanTab2(): React.JSX.Element {
  return (
    <div className={styles.root}>
      <PlanSizeSection />
      <PlanCanvasSection2 />
      <PlanStatsSection />
    </div>
  );
}
