import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act, within } from '@testing-library/react';

// Mock viewport (uniformément avec les autres tests qui touchent NichoirApp).
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

import { CalcTab } from '../src/components/tabs/CalcTab.js';
import { useNichoirStore } from '../src/store.js';
import {
  createInitialState,
  computeCalculations,
  computeCutList,
} from '@nichoir/core';
import {
  formatVolume,
  formatArea,
  formatThickness,
} from '../src/utils/calcFormatters.js';

beforeEach(() => {
  cleanup();
  mockCtor.mockClear();
  mockInstances.length = 0;
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('CalcTab (unit)', () => {
  it('rend les 4 sections labels i18n fr par défaut', () => {
    const { getByText } = render(<CalcTab />);
    expect(getByText('▸ VOLUMES')).toBeDefined();
    expect(getByText('▸ SURFACES')).toBeDefined();
    expect(getByText('▸ LISTE DE COUPE')).toBeDefined();
    expect(getByText('▸ MATÉRIAU REQUIS')).toBeDefined();
  });

  it('valeurs volumes/surfaces/thickness matchent computeCalculations formaté', () => {
    const params = createInitialState().params;
    const { volumes, surfaces } = computeCalculations(params);
    const { getByText } = render(<CalcTab />);

    // Volumes (3 valeurs)
    expect(getByText(formatVolume(volumes.ext))).toBeDefined();
    expect(getByText(formatVolume(volumes.int))).toBeDefined();
    expect(getByText(formatVolume(volumes.mat))).toBeDefined();

    // Surfaces (5 valeurs)
    expect(getByText(formatArea(surfaces.total))).toBeDefined();
    expect(getByText(formatArea(surfaces.facades))).toBeDefined();
    expect(getByText(formatArea(surfaces.sides))).toBeDefined();
    expect(getByText(formatArea(surfaces.bottom))).toBeDefined();
    expect(getByText(formatArea(surfaces.roof))).toBeDefined();

    // Thickness (dual mm/inch)
    expect(getByText(formatThickness(params.T))).toBeDefined();
  });

  it('table de coupe : nb de rows = computeCutList(params, derived).cuts.length (dérivé, pas figé)', () => {
    const params = createInitialState().params;
    const { derived } = computeCalculations(params);
    const expected = computeCutList(params, derived);
    const { getAllByRole } = render(<CalcTab />);
    // 1 ligne thead + N lignes tbody → on isole tbody via le nom accessible des rows.
    // Méthode : on lit tous les rows puis on retire celui qui contient du header (thead).
    const allRows = getAllByRole('row');
    // Le header est la 1re ligne (contient les <th>). Les autres sont <td>.
    const bodyRows = allRows.filter((r) => r.querySelector('th') === null);
    expect(bodyRows.length).toBe(expected.cuts.length);
  });

  it('header table : 3 colonnes (piece / qty / dims) avec labels i18n', () => {
    const { getAllByRole } = render(<CalcTab />);
    const columnHeaders = getAllByRole('columnheader');
    expect(columnHeaders.length).toBe(3);
    expect(columnHeaders[0]!.textContent).toBe('Pièce');
    expect(columnHeaders[1]!.textContent).toBe('Qté');
    expect(columnHeaders[2]!.textContent).toBe('Dim. (mm)');
  });

  it('ridge=left (défaut) : rows roofL et roofR séparés', () => {
    // state initial : ridge='left' → computeCutList génère roofL + roofR
    const params = createInitialState().params;
    const { derived } = computeCalculations(params);
    const { cuts } = computeCutList(params, derived);
    const roofKeys = cuts.map((c) => c.nameKey).filter((k) => k.startsWith('calc.cuts.roof'));
    expect(roofKeys).toEqual(['calc.cuts.roofL', 'calc.cuts.roofR']);

    const { getByText } = render(<CalcTab />);
    expect(getByText('Toit G')).toBeDefined();
    expect(getByText('Toit D')).toBeDefined();
  });

  it('ridge=miter : 1 seul row roof (qty 2) au lieu de roofL/roofR', () => {
    act(() => { useNichoirStore.getState().setParam('ridge', 'miter'); });

    const params = useNichoirStore.getState().params;
    const { derived } = computeCalculations(params);
    const { cuts } = computeCutList(params, derived);
    const roofItems = cuts.filter((c) => c.nameKey.startsWith('calc.cuts.roof'));
    expect(roofItems.length).toBe(1);
    expect(roofItems[0]!.nameKey).toBe('calc.cuts.roof');
    expect(roofItems[0]!.qty).toBe(2);

    const { getByText, queryByText } = render(<CalcTab />);
    expect(getByText('Toit')).toBeDefined();
    expect(queryByText('Toit G')).toBeNull();
    expect(queryByText('Toit D')).toBeNull();
  });

  it('door=round + doorPanel=true : row door apparaît (dérivé de cuts)', () => {
    act(() => {
      useNichoirStore.getState().setParam('door', 'round');
      useNichoirStore.getState().setParam('doorPanel', true);
    });

    const params = useNichoirStore.getState().params;
    const { derived } = computeCalculations(params);
    const { cuts } = computeCutList(params, derived);
    const doorItems = cuts.filter((c) => c.nameKey === 'calc.cuts.door');
    expect(doorItems.length).toBe(1);

    const { getByText } = render(<CalcTab />);
    expect(getByText('Porte')).toBeDefined();
    // doorShape.key = 'calc.door.shape.round' → résolu en "ronde"
    // doorVar par défaut = 100 → percent null → pas de suffixe %
    const row = getByText('Porte').closest('tr')!;
    expect(within(row).getByText(/ronde/)).toBeDefined();
  });

  it('perch=true + door=round : row perch apparaît ; perch=true + door=none : pas de row perch', () => {
    // Cas 1 : door='round' + perch=true → 1 row perch
    act(() => {
      useNichoirStore.getState().setParam('door', 'round');
      useNichoirStore.getState().setParam('perch', true);
    });
    let params = useNichoirStore.getState().params;
    let listed = computeCutList(params, computeCalculations(params).derived).cuts;
    expect(listed.some((c) => c.nameKey === 'calc.cuts.perch')).toBe(true);
    const { getByText, rerender, queryByText } = render(<CalcTab />);
    expect(getByText('Perchoir')).toBeDefined();

    // Cas 2 : door='none' + perch=true → 0 row perch
    act(() => { useNichoirStore.getState().setParam('door', 'none'); });
    params = useNichoirStore.getState().params;
    listed = computeCutList(params, computeCalculations(params).derived).cuts;
    expect(listed.some((c) => c.nameKey === 'calc.cuts.perch')).toBe(false);
    rerender(<CalcTab />);
    expect(queryByText('Perchoir')).toBeNull();
  });

  it('piecesCount : dérivé de computeCutList(...).nPieces, i18n', () => {
    // Cas 1 : état initial → nPieces = 7
    const params0 = createInitialState().params;
    const { nPieces: n0 } = computeCutList(params0, computeCalculations(params0).derived);
    const { getByText, rerender, queryByText } = render(<CalcTab />);
    expect(getByText(`${n0} pièces`)).toBeDefined();

    // Cas 2 : door + doorPanel + perch → nPieces = 9
    act(() => {
      useNichoirStore.getState().setParam('door', 'round');
      useNichoirStore.getState().setParam('doorPanel', true);
      useNichoirStore.getState().setParam('perch', true);
    });
    const params1 = useNichoirStore.getState().params;
    const { nPieces: n1 } = computeCutList(params1, computeCalculations(params1).derived);
    rerender(<CalcTab />);
    expect(getByText(`${n1} pièces`)).toBeDefined();
    expect(queryByText(`${n0} pièces`)).toBeNull();
  });

  it('switch lang fr → en : labels et notes traduits', () => {
    // Passer en EN, mettre taperX positif pour produire une note "flared" → "flared trapezoid"
    act(() => {
      useNichoirStore.getState().setLang('en');
      useNichoirStore.getState().setParam('taperX', 10);
    });

    const { getByText } = render(<CalcTab />);
    expect(getByText('▸ VOLUMES')).toBeDefined();       // même clé en EN
    expect(getByText('▸ CUT LIST')).toBeDefined();
    expect(getByText('▸ MATERIAL REQUIRED')).toBeDefined();
    // Row façade : noteKey = 'calc.cuts.note.flared' (taperX > 0) → "flared trapezoid"
    const facadeRow = getByText('Facade').closest('tr')!;
    expect(within(facadeRow).getByText(/flared trapezoid/)).toBeDefined();
  });

  it('note i18n avec paramètres : miter {slope} = "biseau 35°" par défaut', () => {
    act(() => { useNichoirStore.getState().setParam('ridge', 'miter'); });

    const { getByText } = render(<CalcTab />);
    const slope = useNichoirStore.getState().params.slope; // 35 par défaut
    const roofRow = getByText('Toit').closest('tr')!;
    expect(within(roofRow).getByText(new RegExp(`biseau ${slope}°`))).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Intégration réelle : NichoirApp → onglet CALC → mutation DIM → valeur re-render
// (codex guardrail P2.4 : valider state -> compute -> render sans tricher)
// ---------------------------------------------------------------------------

describe('NichoirApp + CalcTab (intégration réelle)', () => {
  it('mutation DIM (W) via slider DIM → CalcTab re-rendu avec nouveau volume', async () => {
    const { NichoirApp } = await import('../src/NichoirApp.js');
    const { getAllByRole, queryByText, getByText, rerender } = render(<NichoirApp />);

    // 1. Sur DIM, récupérer la valeur volume ext initiale (via computeCalculations)
    const params0 = useNichoirStore.getState().params;
    const vol0 = formatVolume(computeCalculations(params0).volumes.ext);

    // 2. Muter le slider W (premier slider dans DimTab) à 250
    const dimSlider = getAllByRole('slider')[0] as HTMLInputElement;
    act(() => { fireEvent.change(dimSlider, { target: { value: '250' } }); });
    rerender(<NichoirApp />);
    expect(useNichoirStore.getState().params.W).toBe(250);

    // 3. Basculer sur l'onglet CALC
    const tabs = getAllByRole('tab');
    act(() => { fireEvent.click(tabs[3]!); }); // index 3 = CALC (dim, vue, deco, calc, plan, export)
    rerender(<NichoirApp />);
    expect(useNichoirStore.getState().activeTab).toBe('calc');

    // 4. Calculer la nouvelle valeur attendue et vérifier qu'elle est rendue,
    //    et que l'ancienne valeur n'est plus là (si elle diffère).
    const params1 = useNichoirStore.getState().params;
    const vol1 = formatVolume(computeCalculations(params1).volumes.ext);
    expect(getByText(vol1)).toBeDefined();
    if (vol0 !== vol1) {
      expect(queryByText(vol0)).toBeNull();
    }
    cleanup();
  });
});
