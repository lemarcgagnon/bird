// src/components/tabs/DecoTargetSection.tsx
//
// Sélecteur du panneau cible pour l'édition du décor. Port v15
// (index.html:221-229). Les options sont DÉRIVÉES de `DECO_KEYS` importé
// depuis `@nichoir/core` (garde-fou codex P2.7a : pas de liste hardcodée
// côté UI). Labels via `t('deco.target.<key>')`.
//
// Divergences temporaires P2.7a (validées codex, retirées en P2.7b) :
//   - Pas d'affichage du status "Aucun fichier chargé" — reporté à P2.7b
//     avec le file flow (source / sourceType / lastParseWarning).

'use client';

import { DECO_KEYS } from '@nichoir/core';
import type { DecoKey } from '@nichoir/core';
import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import styles from './DecoTab.module.css';

export function DecoTargetSection(): React.JSX.Element {
  const activeDecoKey = useNichoirStore((s) => s.activeDecoKey);
  const setActiveDecoKey = useNichoirStore((s) => s.setActiveDecoKey);
  const t = useT();

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('deco.target')}</div>
      <select
        className={styles.select}
        value={activeDecoKey}
        onChange={(e): void => setActiveDecoKey(e.target.value as DecoKey)}
        aria-label={t('deco.target')}
      >
        {DECO_KEYS.map((k) => (
          <option key={k} value={k}>
            {t(`deco.target.${k}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
