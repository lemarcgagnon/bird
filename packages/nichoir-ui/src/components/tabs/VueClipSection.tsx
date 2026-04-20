// src/components/tabs/VueClipSection.tsx
//
// Section "coupes de section" de VueTab. 3 axes X/Y/Z, chacun :
//   - une Checkbox (clip[axis].on)
//   - un Slider 0..100 % conditionnel (unmount si .on === false, codex P2.3 G4)
//
// Convention de normalisation (codex P2.3 G1) :
//   - Le store stocke `clip[axis].pos` dans [0..1] (contrat `@nichoir/core`
//     type `ClipAxis`, initialisé à 0.5 par `createInitialState`).
//   - La UI travaille en 0..100 % : `value = pos * 100`, `pos = v / 100`.
//   - La conversion est explicite à chaque bord (pas de mixage dans le store).
//
// Port fidèle v15 : nichoir_v15.html:274-276 et src/main.js:275-292.

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { Checkbox } from '../primitives/Checkbox.js';
import { Slider } from '../primitives/Slider.js';
import type { ClipAxisKey } from '@nichoir/core';
import styles from './DimTab.module.css';

const AXES: readonly ClipAxisKey[] = ['x', 'y', 'z'];

export function VueClipSection(): React.JSX.Element {
  const clip = useNichoirStore((s) => s.clip);
  const setClipAxis = useNichoirStore((s) => s.setClipAxis);
  const t = useT();

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('vue.clip')}</div>
      {AXES.map((axis) => {
        const axisState = clip[axis];
        return (
          <div key={axis} className={styles.section}>
            <Checkbox
              checked={axisState.on}
              onChange={(v): void => setClipAxis(axis, { on: v })}
              label={t(`vue.clip.${axis}`)}
            />
            {axisState.on && (
              <div className={styles.subPanel}>
                <Slider
                  label={t(`vue.clip.${axis}`)}
                  value={axisState.pos * 100}
                  onChange={(v): void => setClipAxis(axis, { pos: v / 100 })}
                  min={0} max={100} step={1} unit="%" dec={0}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
