// src/components/tabs/VueExplodeSection.tsx
//
// Section "vue éclatée" de VueTab. Unique slider 0..100 (%) qui mute
// `params.explode`. Port fidèle v15 (nichoir_v15.html:263 → src/main.js:194
// `bindSlider('sg-explode', ..., { unit: '%', dec: 0, onChange: setParam('explode') })`).

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { Slider } from '../primitives/Slider.js';
import styles from './DimTab.module.css';

export function VueExplodeSection(): React.JSX.Element {
  const explode = useNichoirStore((s) => s.params.explode);
  const setParam = useNichoirStore((s) => s.setParam);
  const t = useT();

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('vue.explode')}</div>
      <Slider
        label={t('vue.explode.label')}
        value={explode}
        onChange={(v): void => setParam('explode', v)}
        min={0} max={100} step={1} unit="%" dec={0}
      />
    </div>
  );
}
