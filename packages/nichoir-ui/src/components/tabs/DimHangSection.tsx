// src/components/tabs/DimHangSection.tsx
//
// Section trous de suspension : toggle hang + 3 sliders conditionnels.
// Suit le même patron que DimPerchSection : sliders UNMOUNTED (pas hidden)
// quand hang=false.

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { Slider } from '../primitives/Slider.js';
import { Checkbox } from '../primitives/Checkbox.js';
import styles from './DimTab.module.css';

export function DimHangSection(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const setParam = useNichoirStore((s) => s.setParam);
  const t = useT();

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('dim.hang')}</div>
      <Checkbox
        checked={params.hang}
        onChange={(v): void => setParam('hang', v)}
        label={t('dim.hang.add')}
      />

      {params.hang && (
        <div className={styles.subPanel}>
          <Slider
            label={t('dim.hang.posY')}
            value={params.hangPosY}
            onChange={(v): void => setParam('hangPosY', v)}
            min={0} max={100} step={1} unit=" mm" dec={0}
          />
          <Slider
            label={t('dim.hang.offsetX')}
            value={params.hangOffsetX}
            onChange={(v): void => setParam('hangOffsetX', v)}
            min={0} max={100} step={1} unit=" mm" dec={0}
          />
          <Slider
            label={t('dim.hang.diameter')}
            value={params.hangDiam}
            onChange={(v): void => setParam('hangDiam', v)}
            min={3} max={20} step={0.5} unit=" mm" dec={1}
          />
        </div>
      )}
    </div>
  );
}
