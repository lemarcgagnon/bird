// src/components/tabs/DecoDimensionsSection.tsx
//
// 5 sliders dimensions pour le slot de décor actif (P2.7c). Port v15
// (index.html:260-280, src/ui/deco-panel.js:107-111).
//
// Ranges alignés 1:1 sur v15 :
//   - w, h       : 10..400 mm, step 1
//   - posX, posY : 0..100 %, step 1
//   - rotation   : 0..360°, step 1

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { Slider } from '../primitives/Slider.js';
import styles from './DecoTab.module.css';

export function DecoDimensionsSection(): React.JSX.Element {
  const activeDecoKey = useNichoirStore((s) => s.activeDecoKey);
  const slot = useNichoirStore((s) => s.decos[activeDecoKey]);
  const setDecoSlot = useNichoirStore((s) => s.setDecoSlot);
  const t = useT();

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('deco.dims')}</div>
      <Slider
        label={t('deco.dim.width')}
        value={slot.w}
        onChange={(v): void => setDecoSlot(activeDecoKey, { w: v })}
        min={10} max={400} step={1} unit=" mm" dec={0}
      />
      <Slider
        label={t('deco.dim.height')}
        value={slot.h}
        onChange={(v): void => setDecoSlot(activeDecoKey, { h: v })}
        min={10} max={400} step={1} unit=" mm" dec={0}
      />
      <Slider
        label={t('deco.dim.posX')}
        value={slot.posX}
        onChange={(v): void => setDecoSlot(activeDecoKey, { posX: v })}
        min={0} max={100} step={1} unit="%" dec={0}
      />
      <Slider
        label={t('deco.dim.posY')}
        value={slot.posY}
        onChange={(v): void => setDecoSlot(activeDecoKey, { posY: v })}
        min={0} max={100} step={1} unit="%" dec={0}
      />
      <Slider
        label={t('deco.dim.rotation')}
        value={slot.rotation}
        onChange={(v): void => setDecoSlot(activeDecoKey, { rotation: v })}
        min={0} max={360} step={1} unit="°" dec={0}
      />
    </div>
  );
}
