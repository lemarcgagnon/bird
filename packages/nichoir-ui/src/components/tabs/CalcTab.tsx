// src/components/tabs/CalcTab.tsx
//
// Orchestrateur de l'onglet CALC (read-only). 4 sections verticales fidèles
// à v15 index.html:316-335. Exception au guardrail codex "≤3 sous-composants
// par tab" : validée pour P2.4 car les 4 sections correspondent à la structure
// fonctionnelle v15 et sont plus lisibles non-fusionnées.

'use client';

import { CalcVolumesSection } from './CalcVolumesSection.js';
import { CalcSurfacesSection } from './CalcSurfacesSection.js';
import { CalcCutsSection } from './CalcCutsSection.js';
import { CalcMaterialSection } from './CalcMaterialSection.js';
import styles from './CalcTab.module.css';

export function CalcTab(): React.JSX.Element {
  return (
    <div className={styles.root}>
      <CalcVolumesSection />
      <CalcSurfacesSection />
      <CalcCutsSection />
      <CalcMaterialSection />
    </div>
  );
}
