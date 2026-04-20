// src/components/tabs/DimBodySection.tsx
//
// Section "corps + toiture + matériau" de DimTab. Regroupe :
//   - 4 sliders : W, H, D, taperX
//   - ToggleBar floor (enclave/pose)
//   - 2 sliders : slope, overhang
//   - ToggleBar ridge (left/right/miter)
//   - 1 slider : T

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { Slider } from '../primitives/Slider.js';
import { ToggleBar, type ToggleBarOption } from '../primitives/ToggleBar.js';
import type { FloorType, RidgeType } from '@nichoir/core';
import styles from './DimTab.module.css';

export function DimBodySection(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const setParam = useNichoirStore((s) => s.setParam);
  const t = useT();

  const floorOptions: ToggleBarOption<FloorType>[] = [
    {
      value: 'enclave',
      label: `${t('dim.floor.enclave')} · ${t('dim.floor.enclave.note')}`,
    },
    {
      value: 'pose',
      label: `${t('dim.floor.pose')} · ${t('dim.floor.pose.note')}`,
    },
  ];

  const ridgeOptions: ToggleBarOption<RidgeType>[] = [
    {
      value: 'left',
      label: `${t('dim.ridge.left')} · ${t('dim.ridge.left.note')}`,
    },
    {
      value: 'right',
      label: `${t('dim.ridge.right')} · ${t('dim.ridge.right.note')}`,
    },
    {
      value: 'miter',
      label: `${t('dim.ridge.miter')} · ${t('dim.ridge.miter.note')}`,
    },
  ];

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t('dim.body')}</div>
        <Slider
          label={t('dim.width')}
          value={params.W}
          onChange={(v): void => setParam('W', v)}
          min={80} max={400} step={1} unit=" mm" dec={0} allowOverflow
        />
        <Slider
          label={t('dim.height')}
          value={params.H}
          onChange={(v): void => setParam('H', v)}
          min={80} max={500} step={1} unit=" mm" dec={0} allowOverflow
        />
        <Slider
          label={t('dim.depth')}
          value={params.D}
          onChange={(v): void => setParam('D', v)}
          min={80} max={400} step={1} unit=" mm" dec={0} allowOverflow
        />
        <Slider
          label={t('dim.taperX')}
          value={params.taperX}
          onChange={(v): void => setParam('taperX', v)}
          min={-60} max={60} step={1} unit=" mm" dec={0}
        />
        <div className={styles.hint}>{t('dim.taperHint')}</div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t('dim.floor')}</div>
        <ToggleBar
          options={floorOptions}
          value={params.floor}
          onChange={(v): void => setParam('floor', v)}
          ariaLabel={t('dim.floor')}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t('dim.roof')}</div>
        <Slider
          label={t('dim.slope')}
          value={params.slope}
          onChange={(v): void => setParam('slope', v)}
          min={10} max={60} step={1} unit="°" dec={0}
        />
        <Slider
          label={t('dim.overhang')}
          value={params.overhang}
          onChange={(v): void => setParam('overhang', v)}
          min={0} max={80} step={1} unit=" mm" dec={0}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t('dim.ridge')}</div>
        <ToggleBar
          options={ridgeOptions}
          value={params.ridge}
          onChange={(v): void => setParam('ridge', v)}
          ariaLabel={t('dim.ridge')}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t('dim.material')}</div>
        <Slider
          label={t('dim.thickness')}
          value={params.T}
          onChange={(v): void => setParam('T', v)}
          min={3} max={25} step={0.5} unit=" mm" dec={1}
        />
      </div>
    </>
  );
}
