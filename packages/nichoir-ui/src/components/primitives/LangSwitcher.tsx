// src/components/primitives/LangSwitcher.tsx
//
// Deux boutons fr/en reliés au store (store.lang / setLang).
// aria-pressed pour l'état toggle, aria-label sur le groupe.

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import type { Lang } from '../../i18n/messages.js';
import styles from './LangSwitcher.module.css';

const LANGS: readonly Lang[] = ['fr', 'en'];

export function LangSwitcher(): React.JSX.Element {
  const current = useNichoirStore((s) => s.lang);
  const setLang = useNichoirStore((s) => s.setLang);
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t('lang.label')}
      className={styles.group}
    >
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          aria-pressed={current === lang}
          onClick={(): void => setLang(lang)}
          className={styles.btn}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
