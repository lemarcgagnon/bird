// src/components/tabs/DimPerchSection.tsx
//
// Section perchoir : uniquement visible si une porte est définie (v15 :
// le perchoir se met sous la porte ; sans porte, pas de perchoir possible).
//
// Checkbox perch → conditionnel : 3 sliders perchDiam/Len/Off.

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { Slider } from '../primitives/Slider.js';
import { Checkbox } from '../primitives/Checkbox.js';
import styles from './DimTab.module.css';

export function DimPerchSection(): React.JSX.Element | null {
  const params = useNichoirStore((s) => s.params);
  const setParam = useNichoirStore((s) => s.setParam);
  const t = useT();

  // Pas de section perchoir si pas de porte (v15 : le perch vit sous la porte).
  if (params.door === 'none') return null;

  return (
    <div className={styles.section}>
      <Checkbox
        checked={params.perch}
        onChange={(v): void => setParam('perch', v)}
        label={t('dim.perch.add')}
      />

      {params.perch && (
        <div className={styles.subPanel}>
          <Slider
            label={t('dim.perch.diameter')}
            value={params.perchDiam}
            onChange={(v): void => setParam('perchDiam', v)}
            min={3} max={20} step={0.5} unit=" mm" dec={1}
          />
          <Slider
            label={t('dim.perch.length')}
            value={params.perchLen}
            onChange={(v): void => setParam('perchLen', v)}
            min={10} max={80} step={1} unit=" mm" dec={0}
          />
          <Slider
            label={t('dim.perch.offset')}
            value={params.perchOff}
            onChange={(v): void => setParam('perchOff', v)}
            min={5} max={60} step={1} unit=" mm" dec={0}
          />
        </div>
      )}
    </div>
  );
}
