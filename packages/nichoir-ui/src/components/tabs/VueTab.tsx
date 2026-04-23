// src/components/tabs/VueTab.tsx
//
// Orchestrateur de l'onglet VUE. Assemble 3 sections (même pattern que DimTab —
// codex guardrail : ≤ 3 sous-composants pour garder la review lisible).

'use client';

import { VueModeSection } from './VueModeSection.js';
import { VuePaletteSection } from './VuePaletteSection.js';
import { VueExplodeSection } from './VueExplodeSection.js';
import { VueClipSection } from './VueClipSection.js';
import styles from './DimTab.module.css';

export function VueTab(): React.JSX.Element {
  return (
    <div className={styles.root}>
      <VueModeSection />
      <VuePaletteSection />
      <VueExplodeSection />
      <VueClipSection />
    </div>
  );
}
