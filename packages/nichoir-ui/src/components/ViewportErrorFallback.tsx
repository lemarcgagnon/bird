// src/components/ViewportErrorFallback.tsx
//
// Fallback UI rendu quand ViewportBoundary capture une erreur. Composant
// FONCTIONNEL (pas une classe) pour pouvoir résoudre l'i18n via useT().
// Instancié typiquement une seule fois côté parent et passé en JSX au
// boundary :
//
//   <ViewportBoundary fallback={<ViewportErrorFallback />}>
//     <Viewport />
//   </ViewportBoundary>
//
// a11y : `role="alert"` + `aria-live="assertive"` pour que les technologies
// d'assistance annoncent le problème au moment où le boundary bascule en
// état d'erreur et re-render ce composant.

'use client';

import { useT } from '../i18n/useT.js';
import styles from './ViewportBoundary.module.css';

export function ViewportErrorFallback(): React.JSX.Element {
  const t = useT();
  return (
    <div role="alert" aria-live="assertive" className={styles.fallback}>
      <h2 className={styles.title}>{t('viewport.error.title')}</h2>
      <p className={styles.description}>{t('viewport.error.description')}</p>
      <p className={styles.hint}>{t('viewport.error.hint')}</p>
    </div>
  );
}
