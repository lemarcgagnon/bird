// src/components/tabs/VuePaletteSection.tsx
//
// Radio group pour choisir la palette de couleurs des panneaux (4 options :
// Bois naturel, Bois contrasté, Couleurs distinctes, Monochrome).
// Appliqué en temps réel aux panneaux 3D ET aux pièces du plan de coupe 2D.

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { ToggleBar, type ToggleBarOption } from '../primitives/ToggleBar.js';
import type { PaletteKey } from '@nichoir/core';
import styles from './DimTab.module.css';

const PALETTE_KEYS: readonly PaletteKey[] = ['wood', 'wood-contrast', 'colorful', 'mono'];

export function VuePaletteSection(): React.JSX.Element {
  const palette = useNichoirStore((s) => s.params.palette);
  const setParam = useNichoirStore((s) => s.setParam);
  const t = useT();

  const options: ToggleBarOption<PaletteKey>[] = PALETTE_KEYS.map((k) => ({
    value: k,
    label: t(`vue.palette.${k}`),
  }));

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('vue.palette')}</div>
      <ToggleBar
        options={options}
        value={palette}
        onChange={(v): void => setParam('palette', v)}
        ariaLabel={t('vue.palette')}
      />
    </div>
  );
}
