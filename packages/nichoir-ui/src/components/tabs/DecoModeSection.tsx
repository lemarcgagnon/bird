// src/components/tabs/DecoModeSection.tsx
//
// Toggle mode vector/heightmap pour le slot de décor actif (P2.7c). Port v15
// (index.html:247-258, src/ui/deco-panel.js:67-93, 212-216).
//
// Deux types de warnings distincts :
//   1. **Transient** (auto-hide 4s, `role="alert"`) — tentative d'activer
//      `mode='vector'` alors que le slot n'a pas de shapes exploitables.
//      Variantes (v15 deco-panel.js:72-77) :
//        - sourceType='image'         → deco.warn.imageNoVector
//        - lastParseWarning !== null  → deco.warn.svgInvalid {reason}
//        - sinon                      → deco.warn.vectorNoShapes
//      Dans ce cas la mutation est **refusée** (mode reste sur heightmap).
//
//   2. **Permanent** (`role="status"`) — slot déjà en `mode='vector'` et
//      `lastParseWarning !== null` : affiché tant que la condition est vraie
//      (v15 deco-panel.js:212-216). Sous le toggle.
//
// Label ToggleBar composé "Vectoriel · extrusion + bevel" via
// `${t('mode.X')} · ${t('mode.X.note')}` — pattern établi dans DimBodySection
// pour floor/ridge (codex P2.7c : pas de refactor de la primitive ToggleBar).

'use client';

import { useEffect, useRef, useState } from 'react';
import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { ToggleBar, type ToggleBarOption } from '../primitives/ToggleBar.js';
import type { DecoMode } from '@nichoir/core';
import styles from './DecoTab.module.css';

const WARNING_AUTO_HIDE_MS = 4000;

export function DecoModeSection(): React.JSX.Element {
  const activeDecoKey = useNichoirStore((s) => s.activeDecoKey);
  const slot = useNichoirStore((s) => s.decos[activeDecoKey]);
  const setDecoSlot = useNichoirStore((s) => s.setDecoSlot);
  const t = useT();

  const [transientWarning, setTransientWarning] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup au unmount : évite setState post-unmount si un timer est en vol.
  useEffect(() => {
    return (): void => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Clear le transient warning au switch de slot actif (correction codex P2.7c
  // fuite UI locale) : un warning 4s déclenché sur front ne doit pas rester
  // visible quand on affiche back.
  useEffect(() => {
    setTransientWarning(null);
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [activeDecoKey]);

  const options: ToggleBarOption<DecoMode>[] = [
    {
      value: 'vector',
      label: `${t('deco.mode.vector')} · ${t('deco.mode.vector.note')}`,
    },
    {
      value: 'heightmap',
      label: `${t('deco.mode.heightmap')} · ${t('deco.mode.heightmap.note')}`,
    },
  ];

  const handleChange = (next: DecoMode): void => {
    // Demande `vector` alors que le slot n'a pas de shapes → refuse + warning
    if (next === 'vector' && (slot.parsedShapes === null || slot.parsedShapes.length === 0)) {
      let msg: string;
      if (slot.sourceType === 'image') {
        msg = t('deco.warn.imageNoVector');
      } else if (slot.lastParseWarning !== null) {
        const reason = t(slot.lastParseWarning.key, slot.lastParseWarning.params);
        msg = t('deco.warn.svgInvalid', { reason });
      } else {
        msg = t('deco.warn.vectorNoShapes');
      }
      setTransientWarning(msg);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setTransientWarning(null);
        timeoutRef.current = null;
      }, WARNING_AUTO_HIDE_MS);
      return; // pas de mutation
    }
    setDecoSlot(activeDecoKey, { mode: next });
  };

  const parseFallbackWarning =
    slot.mode === 'vector' && slot.lastParseWarning !== null
      ? t('deco.warn.parseFallback', {
          warning: t(slot.lastParseWarning.key, slot.lastParseWarning.params),
        })
      : null;

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('deco.mode')}</div>
      <ToggleBar
        options={options}
        value={slot.mode}
        onChange={handleChange}
        ariaLabel={t('deco.mode')}
      />
      {transientWarning !== null && (
        <div role="alert" className={styles.warn}>⚠ {transientWarning}</div>
      )}
      {parseFallbackWarning !== null && transientWarning === null && (
        <div role="status" className={styles.warn}>⚠ {parseFallbackWarning}</div>
      )}
    </div>
  );
}
