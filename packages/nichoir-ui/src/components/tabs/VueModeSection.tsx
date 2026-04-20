// src/components/tabs/VueModeSection.tsx
//
// Section "mode d'affichage" de VueTab. ToggleBar à 4 options qui mute
// `params.mode` (solid/wireframe/xray/edges). Port fidèle v15
// (nichoir_v15.html:258+ → src/main.js:222 .mode-btn handler).

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { ToggleBar, type ToggleBarOption } from '../primitives/ToggleBar.js';
import type { DisplayMode } from '@nichoir/core';
import styles from './DimTab.module.css';

export function VueModeSection(): React.JSX.Element {
  const mode = useNichoirStore((s) => s.params.mode);
  const setParam = useNichoirStore((s) => s.setParam);
  const t = useT();

  const options: ToggleBarOption<DisplayMode>[] = [
    { value: 'solid',     label: t('vue.mode.solid') },
    { value: 'wireframe', label: t('vue.mode.wireframe') },
    { value: 'xray',      label: t('vue.mode.xray') },
    { value: 'edges',     label: t('vue.mode.edges') },
  ];

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('vue.mode')}</div>
      <ToggleBar
        options={options}
        value={mode}
        onChange={(v): void => setParam('mode', v)}
        ariaLabel={t('vue.mode')}
      />
    </div>
  );
}
