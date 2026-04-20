// src/components/tabs/PlanTab.tsx
//
// Orchestrateur de l'onglet PLAN. 3 sections : size picker (read+write),
// canvas SVG preview, stats (read-only).
//
// DIVERGENCES vs v15 (documentées ici pour review) :
//   1. <canvas> → <svg> inline (P2.5 décision validée). Visuel fidèle mais
//      testable + a11y natif. Voir PlanCanvasSection.tsx.
//   2. Boutons export PNG/SVG reportés à P2.6 EXPORT. En v15 ils vivaient
//      dans cet onglet (index.html:367-369). La consolidation sous
//      DownloadService dans EXPORT évite de disperser les exports.
//   3. plan.legend reportée (HTML inline avec <br>, même politique que
//      vue.controls.hint en P2.3).

'use client';

import { PlanSizeSection } from './PlanSizeSection.js';
import { PlanCanvasSection } from './PlanCanvasSection.js';
import { PlanStatsSection } from './PlanStatsSection.js';
import styles from './PlanTab.module.css';

export function PlanTab(): React.JSX.Element {
  return (
    <div className={styles.root}>
      <PlanSizeSection />
      <PlanCanvasSection />
      <PlanStatsSection />
    </div>
  );
}
