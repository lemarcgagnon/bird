// src/components/tabs/DimDoorSection.tsx
//
// Section porte : toggle type (none/round/square/pentagon) + contrôles
// conditionnels (unmount si door=none, per codex guardrail).
//
//   - ToggleBar door type
//   - Si door !== 'none' :
//     - ToggleBar doorFace (front/left/right, P3 feature) — routage geometry
//     - 4 sliders : doorW, doorH, doorPX, doorPY
//     - Checkbox doorPanel → conditional : slider doorVar
//     - Pentagon uniquement : checkbox doorFollowTaper

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { Slider } from '../primitives/Slider.js';
import { ToggleBar, type ToggleBarOption } from '../primitives/ToggleBar.js';
import { Checkbox } from '../primitives/Checkbox.js';
import type { DoorType, DoorFace } from '@nichoir/core';
import styles from './DimTab.module.css';

export function DimDoorSection(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const setParam = useNichoirStore((s) => s.setParam);
  const t = useT();

  const doorOptions: ToggleBarOption<DoorType>[] = [
    { value: 'none', label: t('dim.door.none') },
    { value: 'round', label: t('dim.door.round') },
    { value: 'square', label: t('dim.door.square') },
    { value: 'pentagon', label: t('dim.door.pentagon') },
  ];

  const faceOptions: ToggleBarOption<DoorFace>[] = [
    { value: 'front', label: t('dim.door.face.front') },
    { value: 'left', label: t('dim.door.face.left') },
    { value: 'right', label: t('dim.door.face.right') },
  ];

  const hasDoor = params.door !== 'none';

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('dim.door')}</div>
      <ToggleBar
        options={doorOptions}
        value={params.door}
        onChange={(v): void => setParam('door', v)}
        ariaLabel={t('dim.door')}
      />

      {hasDoor && (
        <div className={styles.subPanel}>
          <div className={styles.hint}>{t('dim.door.face')}</div>
          <ToggleBar
            options={faceOptions}
            value={params.doorFace}
            onChange={(v): void => setParam('doorFace', v)}
            ariaLabel={t('dim.door.face')}
          />
          <Slider
            label={t('dim.door.width')}
            value={params.doorW}
            onChange={(v): void => setParam('doorW', v)}
            min={15} max={300} step={1} unit=" mm" dec={0}
          />
          <Slider
            label={t('dim.door.height')}
            value={params.doorH}
            onChange={(v): void => setParam('doorH', v)}
            min={15} max={400} step={1} unit=" mm" dec={0}
          />
          <Slider
            label={t('dim.door.posX')}
            value={params.doorPX}
            onChange={(v): void => setParam('doorPX', v)}
            min={10} max={90} step={1} unit="%" dec={0}
          />
          <Slider
            label={t('dim.door.posY')}
            value={params.doorPY}
            onChange={(v): void => setParam('doorPY', v)}
            min={15} max={85} step={1} unit="%" dec={0}
          />

          <Checkbox
            checked={params.doorPanel}
            onChange={(v): void => setParam('doorPanel', v)}
            label={t('dim.door.createPanel')}
          />

          {params.doorPanel && (
            <div className={styles.subPanel}>
              <Slider
                label={t('dim.door.adjust')}
                value={params.doorVar}
                onChange={(v): void => setParam('doorVar', v)}
                min={85} max={125} step={1} unit="%" dec={0} allowOverflow
              />
              <div className={styles.hint}>{t('dim.door.adjust.hint')}</div>
            </div>
          )}

          {params.door === 'pentagon' && (
            <div className={styles.subPanel}>
              <Checkbox
                checked={params.doorFollowTaper}
                onChange={(v): void => setParam('doorFollowTaper', v)}
                label={t('dim.door.followTaper')}
              />
              <div className={styles.hint}>{t('dim.door.followTaper.hint')}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
