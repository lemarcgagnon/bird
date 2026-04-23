// src/components/cut-plan/OverflowBanner.tsx
//
// Bannière rouge affichée quand au moins une pièce est plus grande que le
// panneau lui-même. La pièce n'est dessinée dans aucun panneau ; on signale
// à l'utilisateur qu'il doit augmenter panelW/panelH.

'use client';

import type { LayoutPiece, Translator } from '@nichoir/core';
import styles from './CutLayout.module.css';

export interface OverflowBannerProps {
  overflow: LayoutPiece[];
  t: Translator;
}

export function OverflowBanner({ overflow, t }: OverflowBannerProps): React.JSX.Element | null {
  if (overflow.length === 0) return null;
  return (
    <div className={styles.banner} role="alert">
      <span className={styles.bannerTitle}>{t('plan.overflow.title')}</span>
      <ul className={styles.bannerList}>
        {overflow.map((p, i) => (
          <li key={`overflow-${i}`}>
            {t(p.nameKey) + (p.suffix ?? '')} — {Math.round(p.w)}×{Math.round(p.h)} mm
          </li>
        ))}
      </ul>
    </div>
  );
}
