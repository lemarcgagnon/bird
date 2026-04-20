// src/components/tabs/DecoEnableSection.tsx
//
// Toggle "Activer la décoration sur ce panneau". Port v15
// (index.html:232-235). Reflète `decos[activeDecoKey].enabled` et mute via
// `setDecoSlot(activeDecoKey, { enabled })` — merge partiel qui ne touche QUE
// le champ enabled du slot ciblé.
//
// P2.7b contrat du verrou (codex) :
//   - Checkbox `disabled={source === null}` : tant qu'aucun fichier n'est
//     chargé, la checkbox est inaccessible. Cocher sans source n'a pas de sens
//     (buildPanelDefs ignore les slots sans parsedShapes/heightmapData).
//   - La charge réussie d'un fichier met automatiquement `enabled=true` via
//     `DecoFileSection` (patch unique `{ ...parseResult, enabled: true }`), donc
//     l'utilisateur n'a plus besoin de cocher manuellement.
//   - Supprimer remet `enabled=false` + `source=null` via reset hybride.

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import styles from './DecoTab.module.css';

export function DecoEnableSection(): React.JSX.Element {
  const activeDecoKey = useNichoirStore((s) => s.activeDecoKey);
  const enabled = useNichoirStore((s) => s.decos[activeDecoKey].enabled);
  const source = useNichoirStore((s) => s.decos[activeDecoKey].source);
  const setDecoSlot = useNichoirStore((s) => s.setDecoSlot);
  const t = useT();

  const disabled = source === null;

  return (
    <div className={styles.section}>
      <label className={styles.enableRow}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          onChange={(e): void =>
            setDecoSlot(activeDecoKey, { enabled: e.target.checked })
          }
        />
        <span>{t('deco.enable')}</span>
      </label>
    </div>
  );
}
