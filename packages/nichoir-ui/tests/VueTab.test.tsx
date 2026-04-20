import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

// --- Mock viewport (même pattern que Viewport.test.tsx / Sidebar.test.tsx) ---
// On capture mount/update pour pouvoir prouver la chaîne VueTab → store → adapter
// dans le test d'intégration réel (codex P2.3 G3).
const { mockCtor, mockInstances } = vi.hoisted(() => {
  interface MockCall {
    mount: Array<{ el: HTMLElement; state: unknown }>;
    update: Array<unknown>;
    unmount: number;
  }
  const mockInstances: MockCall[] = [];
  const mockCtor = vi.fn(() => {
    const calls: MockCall = { mount: [], update: [], unmount: 0 };
    mockInstances.push(calls);
    return {
      mount: vi.fn((el: HTMLElement, state: unknown) => { calls.mount.push({ el, state }); }),
      update: vi.fn((state: unknown) => { calls.update.push(state); }),
      unmount: vi.fn(() => { calls.unmount++; }),
      readCameraState: vi.fn(),
    };
  });
  return { mockCtor, mockInstances };
});

vi.mock('../src/viewports/ImperativeThreeViewport.js', () => ({
  ImperativeThreeViewport: mockCtor,
}));

import { VueTab } from '../src/components/tabs/VueTab.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

beforeEach(() => {
  cleanup();
  mockCtor.mockClear();
  mockInstances.length = 0;
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('VueTab (unit)', () => {
  it('rend les 3 sections (mode, explode, clip) avec labels i18n fr par défaut', () => {
    const { getByText } = render(<VueTab />);
    expect(getByText('▸ MODE D\'AFFICHAGE')).toBeDefined();
    expect(getByText('▸ VUE ÉCLATÉE')).toBeDefined();
    expect(getByText('▸ COUPES DE SECTION')).toBeDefined();
  });

  it('mode solid par défaut (radiogroup : solid aria-checked=true)', () => {
    const { getAllByRole } = render(<VueTab />);
    // radiogroup[0] = mode ; 4 boutons solid/wireframe/xray/edges
    const radiogroups = getAllByRole('radiogroup');
    const modeBtns = radiogroups[0]!.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    expect(modeBtns.length).toBe(4);
    expect(modeBtns[0]!.getAttribute('aria-checked')).toBe('true');
  });

  it('click sur mode "wireframe" → store.params.mode = "wireframe"', () => {
    const { getAllByRole } = render(<VueTab />);
    const modeBtns = getAllByRole('radiogroup')[0]!
      .querySelectorAll<HTMLButtonElement>('[role="radio"]');
    act(() => { fireEvent.click(modeBtns[1]!); }); // wireframe
    expect(useNichoirStore.getState().params.mode).toBe('wireframe');
  });

  it('slider explode → store.params.explode muté', () => {
    const { getAllByRole } = render(<VueTab />);
    // explode = premier slider rendu (mode section utilise ToggleBar, pas de slider)
    const explodeRange = getAllByRole('slider')[0] as HTMLInputElement;
    act(() => { fireEvent.change(explodeRange, { target: { value: '40' } }); });
    expect(useNichoirStore.getState().params.explode).toBe(40);
  });

  it('clip X off par défaut : pas de slider clip rendu (unmount pattern)', () => {
    const { getAllByRole } = render(<VueTab />);
    // Seul le slider explode doit être présent
    expect(getAllByRole('slider').length).toBe(1);
  });

  it('checkbox clip X → store.clip.x.on = true + slider apparaît (mount dynamique)', () => {
    const { container, getAllByRole, rerender } = render(<VueTab />);
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes.length).toBe(3); // X, Y, Z
    act(() => { fireEvent.click(checkboxes[0]!); });
    expect(useNichoirStore.getState().clip.x.on).toBe(true);
    rerender(<VueTab />);
    // explode (1) + clip-x (1) = 2 sliders visibles
    expect(getAllByRole('slider').length).toBe(2);
  });

  it('slider clip X → store.clip.x.pos stocké normalisé 0..1 (codex G1)', () => {
    const { container, getAllByRole, rerender } = render(<VueTab />);
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    act(() => { fireEvent.click(checkboxes[0]!); });
    rerender(<VueTab />);
    // slider[0] = explode, slider[1] = clip X
    const clipXRange = getAllByRole('slider')[1] as HTMLInputElement;
    // Valeur initiale : 0.5 * 100 = 50
    expect(clipXRange.value).toBe('50');
    // Muter à 30 % dans la UI → pos = 0.3 dans le store
    act(() => { fireEvent.change(clipXRange, { target: { value: '30' } }); });
    expect(useNichoirStore.getState().clip.x.pos).toBeCloseTo(0.3, 5);
  });

  it('labels en anglais après setLang("en")', () => {
    const { getByText, rerender } = render(<VueTab />);
    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<VueTab />);
    expect(getByText('▸ DISPLAY MODE')).toBeDefined();
    expect(getByText('▸ EXPLODED VIEW')).toBeDefined();
    expect(getByText('▸ SECTION CUTS')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Intégration réelle VueTab → store → ImperativeThreeViewport.update
// (codex P2.3 G3 : "ajouter le test réel VueTab → store → Viewport.update")
// ---------------------------------------------------------------------------

describe('NichoirApp + VUE tab (intégration réelle)', () => {
  it('chaîne : active onglet VUE → toggle clip X → slider muté → adapter.update reçoit clip.x.pos=0.3', async () => {
    const { NichoirApp } = await import('../src/NichoirApp.js');
    const { container, getAllByRole, rerender } = render(<NichoirApp />);

    // 1. Basculer sur l'onglet VUE (activeTab initial = 'dim')
    const tabs = getAllByRole('tab');
    act(() => { fireEvent.click(tabs[1]!); }); // VUE
    rerender(<NichoirApp />);
    expect(useNichoirStore.getState().activeTab).toBe('vue');

    // 2. Cocher clip X (premier checkbox dans VueClipSection)
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    // Le panel VUE expose : checkbox[0]=clip.x, [1]=clip.y, [2]=clip.z
    act(() => { fireEvent.click(checkboxes[0]!); });
    rerender(<NichoirApp />);

    // 3. Capturer le nombre d'update avant mutation du slider
    const calls = mockInstances[0]!;
    const updateCountBefore = calls.update.length;

    // 4. Muter le slider clip X à 30 %
    // Sliders visibles dans le panel VUE : [0]=explode, [1]=clip X
    const clipXRange = getAllByRole('slider')[1] as HTMLInputElement;
    act(() => { fireEvent.change(clipXRange, { target: { value: '30' } }); });

    // 5. Assert : adapter.update a été appelé avec clip.x.pos === 0.3 (normalisé)
    expect(calls.update.length).toBeGreaterThan(updateCountBefore);
    const lastUpdate = calls.update[calls.update.length - 1] as {
      clip: { x: { on: boolean; pos: number } };
    };
    expect(lastUpdate.clip.x.on).toBe(true);
    expect(lastUpdate.clip.x.pos).toBeCloseTo(0.3, 5);
    cleanup();
  });
});
