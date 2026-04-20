import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

import { DecoModeSection } from '../src/components/tabs/DecoModeSection.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

function loadFront(overrides: Parameters<ReturnType<typeof useNichoirStore.getState>['setDecoSlot']>[1] = {}): void {
  act(() => {
    useNichoirStore.getState().setDecoSlot('front', {
      source: '<svg/>',
      sourceType: 'svg',
      parsedShapes: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 0 }]],
      heightmapData: new Uint8ClampedArray(64 * 64 * 4),
      heightmapResolution: 64,
      mode: 'heightmap',
      lastParseWarning: null,
      enabled: true,
      ...overrides,
    });
  });
}

beforeEach(() => {
  cleanup();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DecoModeSection — rendu et switch valide', () => {
  it('rend section label + 2 options toggle avec labels composés fr', () => {
    loadFront();
    const { getByText, getAllByRole } = render(<DecoModeSection />);
    expect(getByText('▸ MODE DE RENDU')).toBeDefined();
    const radios = getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(getByText('Vectoriel · extrusion + bevel')).toBeDefined();
    expect(getByText('Heightmap · relief depuis image')).toBeDefined();
  });

  it('switch vers vector avec shapes → slot.mode muté', () => {
    loadFront();
    const { getByText } = render(<DecoModeSection />);
    act(() => { fireEvent.click(getByText('Vectoriel · extrusion + bevel').closest('button')!); });
    expect(useNichoirStore.getState().decos.front.mode).toBe('vector');
  });

  it('switch vers heightmap depuis vector → slot.mode muté', () => {
    loadFront({ mode: 'vector' });
    const { getByText } = render(<DecoModeSection />);
    act(() => { fireEvent.click(getByText('Heightmap · relief depuis image').closest('button')!); });
    expect(useNichoirStore.getState().decos.front.mode).toBe('heightmap');
  });
});

describe('DecoModeSection — warning transient 4s (tentative vector sans shapes)', () => {
  it('sourceType="image" + vector → warning deco.warn.imageNoVector (role="alert")', () => {
    loadFront({ sourceType: 'image', parsedShapes: null });
    const { getByText, getByRole } = render(<DecoModeSection />);
    act(() => { fireEvent.click(getByText('Vectoriel · extrusion + bevel').closest('button')!); });
    const alert = getByRole('alert');
    expect(alert.textContent).toContain('PNG/JPG ne supportent que le mode heightmap');
    // Mutation refusée : mode reste heightmap
    expect(useNichoirStore.getState().decos.front.mode).toBe('heightmap');
  });

  it('SVG avec lastParseWarning + vector → warning deco.warn.svgInvalid avec reason traduit au render', () => {
    loadFront({
      parsedShapes: null,
      lastParseWarning: { key: 'deco.svg.parseError', params: { message: 'bad path d' } },
    });
    const { getByText, getByRole } = render(<DecoModeSection />);
    act(() => { fireEvent.click(getByText('Vectoriel · extrusion + bevel').closest('button')!); });
    const alert = getByRole('alert');
    // reason = t('deco.svg.parseError', {message:'bad path d'}) = 'Erreur parsing : bad path d'
    // puis injecté dans deco.warn.svgInvalid = 'SVG invalide ({reason}) — ...'
    expect(alert.textContent).toContain('SVG invalide (Erreur parsing : bad path d)');
  });

  it('SVG sans shapes + pas de warning + vector → warning deco.warn.vectorNoShapes (défaut)', () => {
    loadFront({ parsedShapes: null, lastParseWarning: null });
    const { getByText, getByRole } = render(<DecoModeSection />);
    act(() => { fireEvent.click(getByText('Vectoriel · extrusion + bevel').closest('button')!); });
    const alert = getByRole('alert');
    expect(alert.textContent).toContain('mode vectoriel nécessite un SVG');
  });

  it('warning auto-hide après 4s (fake timers)', () => {
    vi.useFakeTimers();
    loadFront({ parsedShapes: null });
    const { getByText, queryByRole } = render(<DecoModeSection />);
    act(() => { fireEvent.click(getByText('Vectoriel · extrusion + bevel').closest('button')!); });
    expect(queryByRole('alert')).not.toBeNull();
    // Avancer 3999ms : warning encore présent
    act(() => { vi.advanceTimersByTime(3999); });
    expect(queryByRole('alert')).not.toBeNull();
    // Avancer jusqu'à 4001ms total : warning caché
    act(() => { vi.advanceTimersByTime(2); });
    expect(queryByRole('alert')).toBeNull();
  });
});

describe('DecoModeSection — warning permanent parseFallback (role="status")', () => {
  it('mode="vector" + lastParseWarning !== null → warning permanent role="status" avec warning traduit au render', () => {
    loadFront({
      mode: 'vector',
      parsedShapes: null,
      lastParseWarning: { key: 'deco.svg.malformed' },
    });
    const { getByRole } = render(<DecoModeSection />);
    const status = getByRole('status');
    // warning = t('deco.svg.malformed') = 'SVG mal formé'
    // puis injecté dans deco.warn.parseFallback = '{warning} — vectoriel indisponible, bascule en heightmap.'
    expect(status.textContent).toContain('SVG mal formé');
    expect(status.textContent).toContain('bascule en heightmap');
  });

  it('mode="heightmap" + lastParseWarning → aucun warning status (inactif)', () => {
    loadFront({ mode: 'heightmap', lastParseWarning: { key: 'deco.svg.malformed' } });
    const { queryByRole } = render(<DecoModeSection />);
    expect(queryByRole('status')).toBeNull();
  });

  it('mode="vector" + lastParseWarning=null → aucun warning', () => {
    loadFront({ mode: 'vector' });
    const { queryByRole } = render(<DecoModeSection />);
    expect(queryByRole('status')).toBeNull();
  });
});

describe('DecoModeSection — i18n en', () => {
  it('lang=en : labels traduits', () => {
    loadFront();
    act(() => { useNichoirStore.getState().setLang('en'); });
    const { getByText } = render(<DecoModeSection />);
    expect(getByText('▸ RENDER MODE')).toBeDefined();
    expect(getByText('Vector · extrude + bevel')).toBeDefined();
    expect(getByText('Heightmap · relief from image')).toBeDefined();
  });

  it('warning parseFallback suit le switch de langue (P3 fix langue figée)', () => {
    // Charge un slot avec warning structuré + mode vector → le warning permanent
    // est rendu. Puis switch lang fr→en et vérifie que le texte du warning a
    // migré à la nouvelle langue SANS re-parser le fichier. C'est la preuve
    // matérielle que le warning n'est plus stocké traduit (bug v15 "langue figée").
    loadFront({
      mode: 'vector',
      parsedShapes: null,
      lastParseWarning: { key: 'deco.svg.malformed' },
    });
    const { getByRole, rerender } = render(<DecoModeSection />);
    expect(getByRole('status').textContent).toContain('SVG mal formé');
    expect(getByRole('status').textContent).toContain('bascule en heightmap');

    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<DecoModeSection />);
    expect(getByRole('status').textContent).toContain('Malformed SVG');
    expect(getByRole('status').textContent).toContain('falling back to heightmap');
  });
});

// Correction codex P2.7c finding #3 (fuite UI) : transient warning scopé par
// slot via useEffect cleanup sur activeDecoKey. Sans le fix, un warning 4s
// déclenché sur front resterait visible quand on switch vers back.
describe('DecoModeSection — switch slot clear transient warning (P2.7c correction)', () => {
  it('warning déclenché sur front → switch vers back → warning clear (ne fuit pas)', () => {
    // front : SVG sans shapes → déclencher le warning vector
    loadFront({ parsedShapes: null, lastParseWarning: null });
    // back : SVG chargé aussi pour que la section reste montée après switch
    act(() => {
      useNichoirStore.getState().setDecoSlot('back', {
        source: '<svg/>',
        sourceType: 'svg',
        parsedShapes: null,
        heightmapData: new Uint8ClampedArray(64 * 64 * 4),
        enabled: true,
      });
    });
    const { getByText, queryByRole, rerender } = render(<DecoModeSection />);
    // Déclenche warning sur front
    act(() => { fireEvent.click(getByText('Vectoriel · extrusion + bevel').closest('button')!); });
    expect(queryByRole('alert')).not.toBeNull();

    // Switch vers back
    act(() => { useNichoirStore.getState().setActiveDecoKey('back'); });
    rerender(<DecoModeSection />);

    // Le warning de front ne fuit pas sur back
    expect(queryByRole('alert')).toBeNull();
  });
});
