// src/components/primitives/ThemeToggle.tsx
//
// Toggle light/dark qui mute directement `document.documentElement.dataset.theme`
// ET écrit le cookie `nichoir-theme`. Pas de state React — per codex, évite la
// divergence entre DOM et React state.
//
// P3 fix B2 : le cookie est la **source d'autorité server-side** (lue par
// `apps/demo/app/layout.tsx` via `cookies()` pour rendre directement
// `<html data-theme={...}>` en SSR). Plus de script anti-FOUC, plus de
// `suppressHydrationWarning`, plus de hydration mismatch.
//
// Initial render : lit le dataset déjà set côté serveur via SSR. Aucun flash.
// useSyncExternalStore permet de re-render quand l'utilisateur change le
// thème (MutationObserver sur data-theme).

'use client';

import { useSyncExternalStore } from 'react';
import { useT } from '../../i18n/useT.js';
import styles from './ThemeToggle.module.css';

type Theme = 'light' | 'dark';

/**
 * Nom du cookie. DOIT rester synchronisé avec
 * `apps/demo/app/theme-resolver.ts:THEME_COOKIE_NAME`.
 * `grep -r "nichoir-theme"` localise les 2 sites.
 */
const THEME_COOKIE_NAME = 'nichoir-theme';

function getTheme(): Theme {
  if (typeof document === 'undefined') return 'light'; // SSR fallback
  const t = document.documentElement.dataset.theme;
  return t === 'dark' ? 'dark' : 'light';
}

function setTheme(t: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = t;
  try {
    // Cookie 1 an, path root (disponible sur toutes les routes), SameSite=Lax
    // (défaut raisonnable pour un thème — pas de contexte cross-site).
    document.cookie = `${THEME_COOKIE_NAME}=${t}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Écriture cookie peut throw dans certains contextes extrêmes (extension,
    // sandbox strict). dataset.theme reste muté côté client ; la valeur sera
    // juste perdue au prochain reload.
  }
}

/**
 * Subscribe aux changements de `document.documentElement.dataset.theme` via
 * MutationObserver. Permet à React de re-render si le thème est changé par
 * une autre source (ex: un autre onglet via storage event, ou une extension).
 */
function subscribe(onChange: () => void): () => void {
  if (typeof document === 'undefined') return () => { /* no-op */ };
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return (): void => obs.disconnect();
}

export function ThemeToggle(): React.JSX.Element {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'light');
  const t = useT();
  const ariaLabel = theme === 'dark' ? t('lang.theme.toLight') : t('lang.theme.toDark');
  const symbol = theme === 'dark' ? '☀' : '🌙';

  return (
    <button
      type="button"
      className={styles.btn}
      onClick={(): void => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {symbol}
    </button>
  );
}
