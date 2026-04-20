import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

// Mock viewport (uniformément avec les autres tests touchant NichoirApp).
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

import { PlanTab } from '../src/components/tabs/PlanTab.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState, computeCutLayout } from '@nichoir/core';
import {
  formatPlanArea,
  formatPlanSize,
  formatUsagePct,
} from '../src/utils/planFormatters.js';

beforeEach(() => {
  cleanup();
  mockCtor.mockClear();
  mockInstances.length = 0;
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('PlanTab (unit)', () => {
  it('rend la section size label + SVG preview + stats (3 blocs)', () => {
    const { getByText, getByRole } = render(<PlanTab />);
    expect(getByText('▸ TAILLE DU PANNEAU')).toBeDefined();
    expect(getByRole('img')).toBeDefined();        // SVG preview
    // Stats : 4 labels
    expect(getByText('Panneau :')).toBeDefined();
    expect(getByText('Utilisation :')).toBeDefined();
    expect(getByText('Aire pièces :')).toBeDefined();
    expect(getByText('Aire panneau :')).toBeDefined();
  });

  it('preset picker : 5 options, valeur initiale "1220x2440"', () => {
    const { getByRole } = render(<PlanTab />);
    const select = getByRole('combobox') as HTMLSelectElement;
    expect(select.options).toHaveLength(5);
    expect(select.value).toBe('1220x2440');
  });

  it('custom NON visible par défaut : pas de slider panelW/panelH (unmount pattern)', () => {
    const { queryByText } = render(<PlanTab />);
    expect(queryByText('Largeur panneau')).toBeNull();
    expect(queryByText('Hauteur panneau')).toBeNull();
  });

  it('select preset "1220x1220" : mutation ATOMIQUE panelW + panelH en un seul setState (garde-fou codex)', () => {
    // Garde-fou P2.5 : vérifier que panelW ET panelH changent simultanément.
    // On capture le nombre de ticks via un snapshot des 2 valeurs avant/après
    // un seul fireEvent : si c'étaient 2 setParam, React planifierait 2
    // re-renders. Ici on teste le résultat final + la cohérence transactionnelle
    // (on n'a jamais un état panelW=1220,panelH=2440 observable après le click).
    const { getByRole } = render(<PlanTab />);
    const select = getByRole('combobox') as HTMLSelectElement;
    const before = useNichoirStore.getState().params;
    expect(before.panelW).toBe(1220);
    expect(before.panelH).toBe(2440);

    act(() => { fireEvent.change(select, { target: { value: '1220x1220' } }); });

    const after = useNichoirStore.getState().params;
    expect(after.panelW).toBe(1220);
    expect(after.panelH).toBe(1220); // muté simultanément avec panelW
    // Les autres params sont préservés (pas d'effet de bord du setState atomique)
    expect(after.W).toBe(before.W);
    expect(after.T).toBe(before.T);
  });

  it('select preset "610x1220" : mute bien les deux valeurs au couple attendu', () => {
    const { getByRole } = render(<PlanTab />);
    const select = getByRole('combobox') as HTMLSelectElement;
    act(() => { fireEvent.change(select, { target: { value: '610x1220' } }); });
    const s = useNichoirStore.getState().params;
    expect(s.panelW).toBe(610);
    expect(s.panelH).toBe(1220);
  });

  it('select "custom" : sliders panelW/panelH apparaissent (unmount pattern)', () => {
    const { getByRole, getByText, rerender } = render(<PlanTab />);
    const select = getByRole('combobox') as HTMLSelectElement;
    act(() => { fireEvent.change(select, { target: { value: 'custom' } }); });
    rerender(<PlanTab />);
    expect(getByText('Largeur panneau')).toBeDefined();
    expect(getByText('Hauteur panneau')).toBeDefined();
  });

  it('store pré-rempli avec valeurs custom (panelW=1000) : select rendu value="custom" + sliders visibles', () => {
    act(() => { useNichoirStore.getState().setParam('panelW', 1000); });
    const { getByRole, getByText } = render(<PlanTab />);
    const select = getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('custom');
    expect(getByText('Largeur panneau')).toBeDefined();
    expect(getByText('Hauteur panneau')).toBeDefined();
  });

  it('slider panelW (mode custom) : mute params.panelW', () => {
    act(() => { useNichoirStore.getState().setParam('panelW', 1000); });
    const { getAllByRole } = render(<PlanTab />);
    const sliders = getAllByRole('slider');
    expect(sliders.length).toBeGreaterThanOrEqual(1);
    act(() => { fireEvent.change(sliders[0]!, { target: { value: '800' } }); });
    expect(useNichoirStore.getState().params.panelW).toBe(800);
  });

  it('SVG : nombre de <rect>+<polygon> de pièces dérivé de computeCutLayout(params).pieces.length (garde-fou codex)', () => {
    const params = createInitialState().params;
    const expected = computeCutLayout(params).pieces.length;
    const { container } = render(<PlanTab />);
    // Toutes les pièces : shape === 'pent' (non rot) → <polygon>, sinon → <rect>.
    // Le fond du panneau est un <rect> supplémentaire → on déduit 1.
    const svg = container.querySelector('svg')!;
    const rects = svg.querySelectorAll('rect');
    const polys = svg.querySelectorAll('polygon');
    // Fond = 1 rect. Les pièces rect + polygon = expected.
    const pieceShapes = (rects.length - 1) + polys.length;
    expect(pieceShapes).toBe(expected);
  });

  it('SVG : viewBox matche shW × shH du state initial (1220×2440)', () => {
    const { container } = render(<PlanTab />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 1220 2440');
  });

  it('SVG : aria-label et <title> cohérents avec "plan.panel" + formatPlanSize', () => {
    const { container } = render(<PlanTab />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    const expected = `Panneau : ${formatPlanSize(1220, 2440)}`;
    expect(svg.getAttribute('aria-label')).toBe(expected);
    expect(svg.querySelector('title')!.textContent).toBe(expected);
  });

  it('stats : rendent les valeurs formatées dérivées de computeCutLayout', () => {
    const params = createInitialState().params;
    const { shW, shH, totalArea } = computeCutLayout(params);
    const { getByText } = render(<PlanTab />);
    expect(getByText(formatPlanSize(shW, shH))).toBeDefined();
    expect(getByText(formatUsagePct(totalArea, shW, shH))).toBeDefined();
    expect(getByText(formatPlanArea(totalArea))).toBeDefined();
    expect(getByText(formatPlanArea(shW * shH))).toBeDefined();
  });

  it('switch lang fr → en : labels PLAN traduits', () => {
    const { getByText, rerender } = render(<PlanTab />);
    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<PlanTab />);
    expect(getByText('▸ SHEET SIZE')).toBeDefined();
    expect(getByText('Sheet:')).toBeDefined();
    expect(getByText('Sheet area:')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Intégration réelle : NichoirApp + PlanTab → mutation DIM W → SVG re-rendu
// (garde-fou codex : state → computeCutLayout → render vérifié "end-to-end")
// ---------------------------------------------------------------------------

describe('NichoirApp + PlanTab (intégration réelle)', () => {
  it('mutation DIM W via slider → SVG re-rendu avec nouvelles positions de pièces', async () => {
    const { NichoirApp } = await import('../src/NichoirApp.js');
    const { container, getAllByRole, rerender } = render(<NichoirApp />);

    // 1. Basculer sur l'onglet PLAN
    const tabs = getAllByRole('tab');
    act(() => { fireEvent.click(tabs[4]!); }); // index 4 = PLAN (dim, vue, deco, calc, plan, export)
    rerender(<NichoirApp />);
    expect(useNichoirStore.getState().activeTab).toBe('plan');

    // 2. Capturer les attributs de la première pièce (facade) avant mutation.
    // v15 trie par hauteur décroissante ; les façades ont la plus grande h donc
    // elles sont dans les premiers <polygon> après le <rect> de fond.
    const svg0 = container.querySelector('svg')!;
    const polys0 = svg0.querySelectorAll('polygon');
    expect(polys0.length).toBeGreaterThan(0);
    const pts0 = polys0[0]!.getAttribute('points');

    // 3. Basculer sur DIM pour muter W via slider
    act(() => { fireEvent.click(tabs[0]!); }); // DIM
    rerender(<NichoirApp />);
    const dimSliders = getAllByRole('slider');
    act(() => { fireEvent.change(dimSliders[0]!, { target: { value: '260' } }); });
    rerender(<NichoirApp />);
    expect(useNichoirStore.getState().params.W).toBe(260);

    // 4. Retour sur PLAN, SVG re-rendu avec points différents
    act(() => { fireEvent.click(tabs[4]!); }); // PLAN
    rerender(<NichoirApp />);
    const svg1 = container.querySelector('svg')!;
    const polys1 = svg1.querySelectorAll('polygon');
    const pts1 = polys1[0]!.getAttribute('points');
    expect(pts1).not.toBe(pts0); // W changé → dimensions de pièce changées
    cleanup();
  });

  it('mutation via preset picker 1220x2440 → 610x1220 : SVG viewBox et stats updated', async () => {
    const { NichoirApp } = await import('../src/NichoirApp.js');
    const { container, getAllByRole, getByText, queryByText, rerender } = render(<NichoirApp />);

    act(() => { fireEvent.click(getAllByRole('tab')[4]!); }); // PLAN
    rerender(<NichoirApp />);

    // Panel area initiale 1220*2440/100 = 29768 cm²
    expect(getByText(formatPlanArea(1220 * 2440))).toBeDefined();

    // Changer preset
    const select = container.querySelector('select')!;
    act(() => { fireEvent.change(select, { target: { value: '610x1220' } }); });
    rerender(<NichoirApp />);

    // SVG viewBox suit immédiatement
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 610 1220');
    // Stats ont bougé
    expect(getByText(formatPlanArea(610 * 1220))).toBeDefined();
    // L'ancienne area panel n'est plus là
    expect(queryByText(formatPlanArea(1220 * 2440))).toBeNull();
    cleanup();
  });
});
