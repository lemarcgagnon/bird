// src/components/tabs/DecoTab.tsx
//
// Orchestrateur de l'onglet DÉCOR. Pattern 1:1 de DimTab : le parent assemble,
// les sous-sections gèrent la logique.
//
// Scope cumulé (P2.7a + P2.7b + P2.7c). Structure rendue :
//   - DecoTargetSection (a) : sélecteur du panneau cible parmi DECO_KEYS
//   - DecoFileSection (b)   : input file Charger + bouton Supprimer
//   - DecoStatusSection (b) : status texte vide/SVG/image + panel
//   - DecoEnableSection (a+b) : toggle enabled avec verrou source===null
//   - Sections conditionnelles `source !== null` (pattern unmount, garde-fou codex) :
//       - DecoModeSection       : ToggleBar vector/heightmap + warnings
//       - DecoDimensionsSection : 5 sliders w/h/posX/posY/rotation
//       - DecoReliefSection     : depth/bevel/invert/resolution (resample async)
//       - DecoClipSection       : checkbox clipToPanel + hint
//
// Divergence UX assumée vs v15 : l'ordre v15 est
// Target → Status → Enable → File → Params (index.html:220). On place ici
// File avant Status/Enable pour regrouper Actions (sélecteur cible + bouton
// Charger) avant l'état (status + toggle enable). Pas bloquant métier — les
// 4 sections mode/dims/relief/clip restent bien sous File comme en v15.
// Correction codex P2.7c : claim initiale "ordre port v15" était fausse.
//
// DÉCOR complet côté UI : plus rien de reporté aux phases suivantes.

'use client';

import { useNichoirStore } from '../../store.js';
import { DecoTargetSection } from './DecoTargetSection.js';
import { DecoFileSection } from './DecoFileSection.js';
import { DecoStatusSection } from './DecoStatusSection.js';
import { DecoEnableSection } from './DecoEnableSection.js';
import { DecoModeSection } from './DecoModeSection.js';
import { DecoDimensionsSection } from './DecoDimensionsSection.js';
import { DecoReliefSection } from './DecoReliefSection.js';
import { DecoClipSection } from './DecoClipSection.js';
import styles from './DecoTab.module.css';

export function DecoTab(): React.JSX.Element {
  const hasSource = useNichoirStore(
    (s) => s.decos[s.activeDecoKey].source !== null,
  );

  return (
    <div className={styles.root}>
      <DecoTargetSection />
      <DecoFileSection />
      <DecoStatusSection />
      <DecoEnableSection />
      {hasSource && (
        <>
          <DecoModeSection />
          <DecoDimensionsSection />
          <DecoReliefSection />
          <DecoClipSection />
        </>
      )}
    </div>
  );
}
