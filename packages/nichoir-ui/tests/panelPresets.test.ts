import { describe, it, expect } from 'vitest';
import {
  PANEL_PRESETS,
  CUSTOM_PRESET_VALUE,
  resolvePreset,
} from '../src/utils/panelPresets.js';

describe('PANEL_PRESETS', () => {
  it('contient exactement 5 entrées (4 presets fixes + custom)', () => {
    expect(PANEL_PRESETS).toHaveLength(5);
  });

  it('le dernier preset est "custom" avec w/h null', () => {
    const last = PANEL_PRESETS[PANEL_PRESETS.length - 1]!;
    expect(last.value).toBe(CUSTOM_PRESET_VALUE);
    expect(last.w).toBeNull();
    expect(last.h).toBeNull();
  });

  it('1525×1525 porte le suffixe i18n "bouleau baltique"', () => {
    const bb = PANEL_PRESETS.find((p) => p.value === '1525x1525');
    expect(bb).toBeDefined();
    expect(bb!.labelSuffixKey).toBe('plan.panelSize.bb');
  });

  it('tous les presets fixes ont w et h strictement positifs', () => {
    for (const p of PANEL_PRESETS) {
      if (p.value === CUSTOM_PRESET_VALUE) continue;
      expect(p.w).not.toBeNull();
      expect(p.h).not.toBeNull();
      expect(p.w!).toBeGreaterThan(0);
      expect(p.h!).toBeGreaterThan(0);
    }
  });
});

describe('resolvePreset', () => {
  it('retourne la valeur du preset matchant pour chaque preset fixe', () => {
    for (const p of PANEL_PRESETS) {
      if (p.value === CUSTOM_PRESET_VALUE) continue;
      expect(resolvePreset(p.w!, p.h!)).toBe(p.value);
    }
  });

  it('retourne "custom" pour un couple hors presets', () => {
    expect(resolvePreset(999, 999)).toBe(CUSTOM_PRESET_VALUE);
    expect(resolvePreset(1220, 2441)).toBe(CUSTOM_PRESET_VALUE);
  });

  it('1220×2440 par défaut (state initial) → "1220x2440"', () => {
    expect(resolvePreset(1220, 2440)).toBe('1220x2440');
  });
});
