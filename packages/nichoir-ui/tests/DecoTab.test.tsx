import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

// Mock viewport (uniformément avec les autres tests touchant NichoirApp).
const { mockCtor } = vi.hoisted(() => {
  const mockCtor = vi.fn(() => ({
    mount: vi.fn(), update: vi.fn(), unmount: vi.fn(), readCameraState: vi.fn(),
  }));
  return { mockCtor };
});
vi.mock('../src/viewports/ImperativeThreeViewport.js', () => ({
  ImperativeThreeViewport: mockCtor,
}));

import { DecoTab } from '../src/components/tabs/DecoTab.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState, DECO_KEYS } from '@nichoir/core';

beforeEach(() => {
  cleanup();
  mockCtor.mockClear();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

// ---------------------------------------------------------------------------
// Unit : rendu direct de <DecoTab />
// ---------------------------------------------------------------------------

describe('DecoTab (unit)', () => {
  it('rend 2 sections : target label + select + checkbox avec label i18n fr par défaut', () => {
    const { getByText, getByRole } = render(<DecoTab />);
    expect(getByText('▸ PANNEAU CIBLE')).toBeDefined();
    expect(getByRole('combobox')).toBeDefined();
    expect(getByText('Activer la décoration sur ce panneau')).toBeDefined();
    expect(getByRole('checkbox')).toBeDefined();
  });

  it('select : 6 options dérivées de DECO_KEYS (pas de liste hardcodée UI)', () => {
    const { getByRole } = render(<DecoTab />);
    const select = getByRole('combobox') as HTMLSelectElement;
    expect(select.options).toHaveLength(DECO_KEYS.length);
    expect(select.options).toHaveLength(6);
    // Valeurs et ordre strictement alignés sur DECO_KEYS (core/state.ts:13).
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual([...DECO_KEYS]);
  });

  it('select : labels fr résolus via t("deco.target.<key>")', () => {
    const { getByRole } = render(<DecoTab />);
    const select = getByRole('combobox') as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toEqual([
      'Façade avant',    // front
      'Façade arrière',  // back
      'Côté gauche',     // left
      'Côté droit',      // right
      'Toit gauche',     // roofL
      'Toit droit',      // roofR
    ]);
  });

  it('default selection === activeDecoKey initial ("front" — state.ts:72)', () => {
    const { getByRole } = render(<DecoTab />);
    const select = getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('front');
    expect(useNichoirStore.getState().activeDecoKey).toBe('front');
  });

  it('default checkbox : decos.front.enabled === false (unchecked au montage)', () => {
    const { getByRole } = render(<DecoTab />);
    const checkbox = getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(useNichoirStore.getState().decos.front.enabled).toBe(false);
  });

  it('switch lang fr → en : section label, options et label checkbox traduits', () => {
    const { getByText, getByRole, rerender } = render(<DecoTab />);
    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<DecoTab />);
    expect(getByText('▸ TARGET PANEL')).toBeDefined();
    expect(getByText('Enable decoration on this panel')).toBeDefined();
    const select = getByRole('combobox') as HTMLSelectElement;
    expect(select.options[0]!.textContent).toBe('Front');
    expect(select.options[4]!.textContent).toBe('Left roof');
  });
});

// ---------------------------------------------------------------------------
// Intégration store : mutations via events DOM → store cohérent
// ---------------------------------------------------------------------------

describe('DecoTab (intégration store)', () => {
  it('fireEvent.change select vers "roofL" → store.activeDecoKey muté', () => {
    const { getByRole } = render(<DecoTab />);
    const select = getByRole('combobox') as HTMLSelectElement;
    act(() => { fireEvent.change(select, { target: { value: 'roofL' } }); });
    expect(useNichoirStore.getState().activeDecoKey).toBe('roofL');
  });

  it('toggle checkbox → store.decos[activeDecoKey].enabled muté', () => {
    const { getByRole } = render(<DecoTab />);
    const checkbox = getByRole('checkbox') as HTMLInputElement;
    expect(useNichoirStore.getState().decos.front.enabled).toBe(false);
    act(() => { fireEvent.click(checkbox); });
    expect(useNichoirStore.getState().decos.front.enabled).toBe(true);
    expect(checkbox.checked).toBe(true);
  });

  // Tests d'isolation par slot — validés codex comme NÉCESSAIRES, pas défensifs
  // (setDecoSlot générique est facile à boguer sur la clé ciblée).

  it('isolation #1 : enable front → switch back → checkbox reflète back.enabled (false), pas hérité', () => {
    const { getByRole, rerender } = render(<DecoTab />);
    // Active front
    act(() => { fireEvent.click(getByRole('checkbox')); });
    expect(useNichoirStore.getState().decos.front.enabled).toBe(true);

    // Switch target vers back
    act(() => { fireEvent.change(getByRole('combobox'), { target: { value: 'back' } }); });
    rerender(<DecoTab />);

    // La checkbox reflète decos.back.enabled (false), pas front.enabled (true)
    expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect(useNichoirStore.getState().decos.back.enabled).toBe(false);
    // Et front reste à true (mutation non perdue)
    expect(useNichoirStore.getState().decos.front.enabled).toBe(true);
  });

  it('isolation #2 : mutations cumulatives sur 2 slots ne créent aucun crossover', () => {
    const { getByRole, rerender } = render(<DecoTab />);
    // Active front
    act(() => { fireEvent.click(getByRole('checkbox')); });
    // Switch vers back
    act(() => { fireEvent.change(getByRole('combobox'), { target: { value: 'back' } }); });
    rerender(<DecoTab />);
    // Active back
    act(() => { fireEvent.click(getByRole('checkbox')); });
    // Retour vers front
    act(() => { fireEvent.change(getByRole('combobox'), { target: { value: 'front' } }); });
    rerender(<DecoTab />);

    const { decos } = useNichoirStore.getState();
    expect(decos.front.enabled).toBe(true);
    expect(decos.back.enabled).toBe(true);
    expect(decos.left.enabled).toBe(false);
    expect(decos.right.enabled).toBe(false);
    expect(decos.roofL.enabled).toBe(false);
    expect(decos.roofR.enabled).toBe(false);
    // La checkbox visible (active = front) est cochée
    expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Intégration réelle : NichoirApp + click tab DÉCOR + events utilisateur
// (garde-fou codex : valider la branche Sidebar.tsx:58-70 end-to-end)
// ---------------------------------------------------------------------------

describe('NichoirApp + DecoTab (intégration réelle)', () => {
  it('click tab DÉCOR → DecoTab rendu + switch target propagé au store', async () => {
    const { NichoirApp } = await import('../src/NichoirApp.js');
    const { container, getAllByRole, rerender } = render(<NichoirApp />);

    // 1. Basculer sur l'onglet DÉCOR (index 2 dans TAB_ORDER: dim, vue, deco, calc, plan, export)
    const tabs = getAllByRole('tab');
    act(() => { fireEvent.click(tabs[2]!); });
    rerender(<NichoirApp />);
    expect(useNichoirStore.getState().activeTab).toBe('deco');

    // 2. DecoTab rendu avec ses 4 sections P2.7a+b : target select, file input,
    //    status, enable checkbox (disabled par défaut, verrou source===null).
    const select = container.querySelector('select')!;
    expect(select).not.toBeNull();
    expect(select.options).toHaveLength(6);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    const enableCheckbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(enableCheckbox.disabled).toBe(true); // verrou P2.7b

    // 3. Changer target via UI réelle
    act(() => { fireEvent.change(select, { target: { value: 'right' } }); });
    rerender(<NichoirApp />);
    expect(useNichoirStore.getState().activeDecoKey).toBe('right');
    cleanup();
  });
});

// ---------------------------------------------------------------------------
// Verrou source===null sur checkbox enable (P2.7b, garde-fou codex)
// ---------------------------------------------------------------------------

describe('DecoTab (verrou checkbox enable, P2.7b)', () => {
  it('source === null par défaut → checkbox enable disabled', () => {
    const { getByRole } = render(<DecoTab />);
    const checkbox = getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
  });

  it('setDecoSlot(source non-null) → checkbox enable disabled=false (ré-activée)', () => {
    const { getByRole, rerender } = render(<DecoTab />);
    // Avant source : une seule checkbox dans le DOM (enable). Sélecteur large.
    expect((getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);

    // Simule une charge réussie (comme le ferait parseDecoFile + setDecoSlot)
    act(() => {
      useNichoirStore.getState().setDecoSlot('front', {
        source: '<svg/>',
        sourceType: 'svg',
        enabled: true,
      });
    });
    rerender(<DecoTab />);

    // Après source : les 4 sections P2.7c montent, ajoutant 2 checkboxes
    // (invert + clipToPanel). Cibler par nom accessible pour rester sur enable.
    const enableCheckbox = getByRole('checkbox', { name: /Activer la décoration/ }) as HTMLInputElement;
    expect(enableCheckbox.disabled).toBe(false);
    expect(enableCheckbox.checked).toBe(true);
  });

  it('switch target vers un slot sans source → checkbox redevient disabled', () => {
    // Active front avec source chargée
    act(() => {
      useNichoirStore.getState().setDecoSlot('front', {
        source: '<svg/>', sourceType: 'svg', enabled: true,
      });
    });

    const { getByRole, rerender } = render(<DecoTab />);
    // front avec source → 3 checkboxes au total. Cibler par nom.
    const enableAtStart = getByRole('checkbox', { name: /Activer la décoration/ }) as HTMLInputElement;
    expect(enableAtStart.disabled).toBe(false);

    // Switch vers back (source=null par défaut) → sections P2.7c démontées
    act(() => {
      fireEvent.change(getByRole('combobox'), { target: { value: 'back' } });
    });
    rerender(<DecoTab />);

    // Plus qu'une checkbox (enable). Sélecteur large OK.
    const checkbox = getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.checked).toBe(false);
  });
});
