// src/components/tabs/PlanSizeSection.tsx
//
// Section "taille du panneau" de PlanTab. Port fidèle v15
// (index.html:341-358, src/main.js:295-306).
//
// Contrats P2.5 (garde-fous codex) :
//   - Preset ≠ 'custom' : mutation ATOMIQUE de panelW + panelH en un seul
//     `setState({ params: { ..., panelW, panelH } })`. Pas deux `setParam`
//     séparés (qui déclencheraient 2 re-renders et laisseraient un état
//     intermédiaire incohérent).
//   - Preset === 'custom' : sliders panelW/panelH rendus en UNMOUNT pattern
//     (même pattern que DimDoorSection/VueClipSection). Les sliders ne sont
//     pas juste cachés via CSS : ils sont absents du DOM quand non-utilisés.
//
// Le <select> utilise un state local `selectedPreset` dérivé du store via
// `resolvePreset(panelW, panelH)` pour rester cohérent avec le state, même
// si l'utilisateur arrive sur l'onglet avec des valeurs custom pré-saisies
// (ex: panelW=1000, panelH=500 → le select montre 'Personnalisé…').

'use client';

import { useState } from 'react';
import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { Slider } from '../primitives/Slider.js';
import {
  PANEL_PRESETS,
  CUSTOM_PRESET_VALUE,
  resolvePreset,
} from '../../utils/panelPresets.js';
import styles from './PlanTab.module.css';

export function PlanSizeSection(): React.JSX.Element {
  const panelW = useNichoirStore((s) => s.params.panelW);
  const panelH = useNichoirStore((s) => s.params.panelH);
  const setParam = useNichoirStore((s) => s.setParam);
  const setState = useNichoirStore((s) => s.setState);
  const storeState = useNichoirStore;
  const t = useT();

  // Flag local : l'utilisateur a explicitement choisi "custom" dans le select.
  // Nécessaire car si (panelW, panelH) matche un preset fixe (ex: 1220×2440),
  // `resolvePreset` retournerait ce preset et l'UI ne saurait pas distinguer
  // "preset choisi" de "custom avec valeurs qui happen to match". L'alternative
  // serait de forcer une micro-mutation au clic custom (hacky) ou stocker ce
  // flag côté store (pollution). Le state local suffit pour cet UX.
  const [forcedCustom, setForcedCustom] = useState(false);

  const resolved = resolvePreset(panelW, panelH);
  const selected = forcedCustom ? CUSTOM_PRESET_VALUE : resolved;
  const isCustom = selected === CUSTOM_PRESET_VALUE;

  const handlePresetChange = (value: string): void => {
    if (value === CUSTOM_PRESET_VALUE) {
      // Pas de mutation du store — on entre en mode custom, sliders locaux
      // prennent le relais. Le flag local garantit que le select reste sur
      // "custom" même si panelW/panelH happen à matcher un preset.
      setForcedCustom(true);
      return;
    }
    setForcedCustom(false);
    const preset = PANEL_PRESETS.find((p) => p.value === value);
    if (!preset || preset.w === null || preset.h === null) return;
    // Mutation atomique : un seul `set`, lecture fraîche via getState() afin
    // de ne pas écraser les autres params (garde-fou codex P2.5).
    const current = storeState.getState().params;
    setState({
      params: { ...current, panelW: preset.w, panelH: preset.h },
    });
  };

  const presetLabel = (value: string, label: string): string => {
    if (value === CUSTOM_PRESET_VALUE) return t('plan.panelSize.custom');
    const preset = PANEL_PRESETS.find((p) => p.value === value);
    if (preset?.labelSuffixKey) {
      return `${label} (${t(preset.labelSuffixKey)})`;
    }
    return label;
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('plan.panelSize')}</div>
      <select
        className={styles.presetSelect}
        value={selected}
        onChange={(e): void => handlePresetChange(e.target.value)}
        aria-label={t('plan.panelSize')}
      >
        {PANEL_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {presetLabel(p.value, p.label)}
          </option>
        ))}
      </select>

      {isCustom && (
        <div className={styles.customPanel}>
          <Slider
            label={t('plan.panelWidth')}
            value={panelW}
            onChange={(v): void => setParam('panelW', v)}
            min={300} max={3000} step={10} unit=" mm" dec={0}
          />
          <Slider
            label={t('plan.panelHeight')}
            value={panelH}
            onChange={(v): void => setParam('panelH', v)}
            min={300} max={3000} step={10} unit=" mm" dec={0}
          />
        </div>
      )}
    </div>
  );
}
