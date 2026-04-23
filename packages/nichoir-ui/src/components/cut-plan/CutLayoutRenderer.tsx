// src/components/cut-plan/CutLayoutRenderer.tsx
//
// Composant racine du rendu d'un CutLayout multi-panneaux. Partagé entre
// PlanTab (shelf-packing) et PlanTab2 (rectangle-packer, branche coupe).
//
// Responsabilité : orchestrer header + overflow banner + liste de PanelCard.
// Zéro logique de calcul — purement présentational.

'use client';

import type { CutLayout, Translator } from '@nichoir/core';
import { OverflowBanner } from './OverflowBanner.js';
import { PanelCard } from './PanelCard.js';
import styles from './CutLayout.module.css';

export interface CutLayoutRendererProps {
  layout: CutLayout;
  t: Translator;
  algoBadge?: string;  // ex: "algo: shelf-packing" (optionnel, utilisé en branche coupe)
}

export function CutLayoutRenderer({ layout, t, algoBadge }: CutLayoutRendererProps): React.JSX.Element {
  const { panels, overflow, meanOccupation } = layout;
  const nPanels = panels.length;
  const meanOccStr = `${Math.round(meanOccupation * 100)}%`;

  const headerText = nPanels === 0
    ? t('plan.noPanels')
    : t('plan.summary', { n: nPanels, occ: meanOccStr });

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        {headerText}
        {algoBadge !== undefined ? ` — ${algoBadge}` : ''}
      </div>
      <OverflowBanner overflow={overflow} t={t} />
      {panels.map((panel, i) => (
        <PanelCard key={`panel-${i}`} panel={panel} panelIndex={i + 1} t={t} />
      ))}
    </div>
  );
}
