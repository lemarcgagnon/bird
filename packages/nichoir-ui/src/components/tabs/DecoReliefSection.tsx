// src/components/tabs/DecoReliefSection.tsx
//
// Section RELIEF pour le slot de décor actif (P2.7c). Port v15
// (index.html:282-302, src/ui/deco-panel.js:112-114).
//
// 4 contrôles :
//   - `depth`       : Slider 0.5..20 mm, step 0.1, dec 1
//   - `bevel`       : Slider 0..100 %, step 1
//     (Bevel n'a d'effet qu'en mode vector ; le hint v15 reste affiché en
//      heightmap. Codex P2.7c : slider actif + hint, pas disabled/hidden.)
//   - `invert`      : Checkbox (actif dans les deux modes ; ignoré par
//     buildDecoGeoVector, consommé par buildDecoGeoHeightmap)
//   - `resolution`  : Slider 32..128, step 8 — déclenche un **resample async**
//     debouncé (200 ms) du heightmap depuis `slot.source`, protégé par un
//     **token de génération par slot** (garde-fou non-négociable codex).
//
// Pattern token de génération (par slot) :
//   generationsRef.current[key] = N   → dernier appel lancé pour CE slot
//   Chaque resample capture son `myGen` au lancement
//   À la résolution (success ou error), vérifie si myGen === current → sinon ignore
//   Protège contre : (a) slides rapides sur le même slot (N resamples concurrents),
//   (b) Supprimer pendant resample (check source === null), (c) nouveau fichier
//   chargé sur même slot pendant resample (check source/sourceType identique à
//   l'instant du start), (d) switch de slot actif pendant resample (capture du
//   key au moment du slide).
//
// Debounce **par slot** (debounceRefs) : un timer séparé par DecoKey. Si l'user
// slide resolution sur front puis switch vers back puis slide resolution sur
// back, les 2 timers coexistent et les 2 resamples partent indépendamment.
// (Correction codex P2.7c : `debounceRef` global aurait tué le timer front au
// moment du slide back.)
//
// En cas d'erreur resample : inline role="alert" + revert du slider resolution
// vers `heightmapResolution` (la valeur stable déjà appliquée côté buffer).
// L'error inline est scopée par slot via useEffect(clear on activeDecoKey).

'use client';

import { useEffect, useRef, useState } from 'react';
import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { Slider } from '../primitives/Slider.js';
import { resampleHeightmapFromSource } from '../../utils/parseDecoFile.js';
import type { DecoKey } from '@nichoir/core';
import styles from './DecoTab.module.css';

const RESAMPLE_DEBOUNCE_MS = 200;

export function DecoReliefSection(): React.JSX.Element {
  const activeDecoKey = useNichoirStore((s) => s.activeDecoKey);
  const slot = useNichoirStore((s) => s.decos[activeDecoKey]);
  const setDecoSlot = useNichoirStore((s) => s.setDecoSlot);
  const t = useT();

  const [error, setError] = useState<string | null>(null);
  const generationsRef = useRef<Partial<Record<DecoKey, number>>>({});
  // Debounce PAR SLOT (correction codex finding P2.7c) : un timer séparé par
  // DecoKey. Un switch de slot actif ne tue plus le resample de l'ancien slot.
  const debounceRefs = useRef<Partial<Record<DecoKey, ReturnType<typeof setTimeout>>>>({});

  // Cleanup complet au unmount : tous les timers par slot.
  useEffect(() => {
    return (): void => {
      for (const timer of Object.values(debounceRefs.current)) {
        if (timer !== undefined) clearTimeout(timer);
      }
    };
  }, []);

  // Clear l'error inline au switch de slot actif (correction codex P2.7c
  // fuite UI locale) : une error de resample sur front ne doit pas rester
  // visible quand on affiche back.
  useEffect(() => {
    setError(null);
  }, [activeDecoKey]);

  const triggerResample = async (key: DecoKey, target: number): Promise<void> => {
    const slotAtStart = useNichoirStore.getState().decos[key];
    if (slotAtStart.source === null || slotAtStart.sourceType === null) return;
    // Capture les identifiants de fichier au start pour détecter un upload
    // d'un autre fichier pendant le resample en vol (correction codex P2.7c).
    const sourceAtStart = slotAtStart.source;
    const sourceTypeAtStart = slotAtStart.sourceType;

    const nextGen = (generationsRef.current[key] ?? 0) + 1;
    generationsRef.current[key] = nextGen;

    try {
      const heightmapData = await resampleHeightmapFromSource(
        sourceAtStart,
        sourceTypeAtStart,
        target,
      );
      // Résultat périmé si :
      //   (a) token invalidé par un resample plus récent sur ce slot
      //   (b) slot vidé (Supprimer) : source === null
      //   (c) fichier remplacé (nouveau upload sur même slot) :
      //       source/sourceType ont changé depuis le start
      if (generationsRef.current[key] !== nextGen) return;
      const slotNow = useNichoirStore.getState().decos[key];
      if (slotNow.source === null) return;
      if (slotNow.source !== sourceAtStart || slotNow.sourceType !== sourceTypeAtStart) return;
      setDecoSlot(key, { heightmapData, heightmapResolution: target });
    } catch (err) {
      if (generationsRef.current[key] !== nextGen) return;
      const slotNow = useNichoirStore.getState().decos[key];
      // Si le slot a été vidé ou rechargé, pas de revert : la nouvelle réalité
      // a déjà écrasé resolution/heightmapResolution, on laisse tel quel.
      if (slotNow.source === null) return;
      if (slotNow.source !== sourceAtStart || slotNow.sourceType !== sourceTypeAtStart) return;
      // Revert le slider resolution vers la dernière valeur stable du buffer.
      setDecoSlot(key, { resolution: slotNow.heightmapResolution });
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('deco.error.resample', { message: msg }));
    }
  };

  const handleResolutionChange = (value: number): void => {
    setError(null);
    // Mute `resolution` immédiatement (feedback UI + state cohérent avec le slider).
    // `heightmapResolution` reste à l'ancienne valeur jusqu'à ce que le resample
    // async finisse — cohérent avec la décision codex : resolution peut être
    // transitoirement différente de heightmapResolution pendant un resample en vol.
    setDecoSlot(activeDecoKey, { resolution: value });
    const keyAtCall = activeDecoKey;
    // Clear uniquement le timer DU SLOT courant, pas les timers des autres slots.
    const existing = debounceRefs.current[keyAtCall];
    if (existing !== undefined) clearTimeout(existing);
    debounceRefs.current[keyAtCall] = setTimeout(() => {
      delete debounceRefs.current[keyAtCall];
      void triggerResample(keyAtCall, value);
    }, RESAMPLE_DEBOUNCE_MS);
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('deco.relief')}</div>
      <Slider
        label={t('deco.relief.depth')}
        value={slot.depth}
        onChange={(v): void => setDecoSlot(activeDecoKey, { depth: v })}
        min={0.5} max={20} step={0.1} unit=" mm" dec={1}
      />
      <Slider
        label={t('deco.relief.bevel')}
        value={slot.bevel}
        onChange={(v): void => setDecoSlot(activeDecoKey, { bevel: v })}
        min={0} max={100} step={1} unit="%" dec={0}
      />
      <div className={styles.hint}>{t('deco.relief.bevel.hint')}</div>
      <label className={styles.enableRow}>
        <input
          type="checkbox"
          checked={slot.invert}
          onChange={(e): void => setDecoSlot(activeDecoKey, { invert: e.target.checked })}
        />
        <span>{t('deco.relief.invert')}</span>
      </label>
      <Slider
        label={t('deco.relief.resolution')}
        value={slot.resolution}
        onChange={handleResolutionChange}
        min={32} max={128} step={8} unit="" dec={0}
      />
      <div className={styles.hint}>{t('deco.relief.resolution.hint')}</div>
      {error !== null && (
        <p role="alert" className={styles.error}>{error}</p>
      )}
    </div>
  );
}
