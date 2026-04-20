// src/components/tabs/DecoClipSection.tsx
//
// Checkbox "Clipper par la forme du panneau" (P2.7c). Port v15
// (index.html:304-309). Mute `slot.clipToPanel`.
//
// Le hint v15 utilisait `<br>` via `data-i18n-html` — on aplatit en une seule
// ligne avec " ⚠ " comme séparateur (messages.ts:deco.clip.hint). Pas besoin
// de dangerouslySetInnerHTML.

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import styles from './DecoTab.module.css';

export function DecoClipSection(): React.JSX.Element {
  const activeDecoKey = useNichoirStore((s) => s.activeDecoKey);
  const clipToPanel = useNichoirStore((s) => s.decos[activeDecoKey].clipToPanel);
  const setDecoSlot = useNichoirStore((s) => s.setDecoSlot);
  const t = useT();

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('deco.clip')}</div>
      <label className={styles.enableRow}>
        <input
          type="checkbox"
          checked={clipToPanel}
          onChange={(e): void => setDecoSlot(activeDecoKey, { clipToPanel: e.target.checked })}
        />
        <span>{t('deco.clip.enable')}</span>
      </label>
      <div className={styles.hint}>{t('deco.clip.hint')}</div>
    </div>
  );
}
