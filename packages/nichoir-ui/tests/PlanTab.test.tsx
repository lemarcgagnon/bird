import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

// Mock viewport (unchanged from prior test, uniform with other suites).
const { mockCtor, mockInstances } = vi.hoisted(() => {
  interface MockCall { mount: Array<{ el: HTMLElement; state: unknown }>; update: Array<unknown>; unmount: number; }
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
import { formatPlanArea, formatPlanSize } from '../src/utils/planFormatters.js';

beforeEach(() => {
  cleanup();
  mockCtor.mockClear();
  mockInstances.length = 0;
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('PlanTab (unit, multi-bin)', () => {
  it('rend : size picker + canvas section + stats (3 blocs)', () => {
    const { getByText, getAllByRole } = render(<PlanTab />);
    expect(getByText('▸ TAILLE DU PANNEAU')).toBeDefined();
    // Canvas section expose au moins un <svg role="img"> (1 panneau sur default preset)
    expect(getAllByRole('img').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Panneau :')).toBeDefined();
    expect(getByText('Nombre de panneaux :')).toBeDefined();
    expect(getByText('Occupation moyenne :')).toBeDefined();
    expect(getByText('Aire pièces totale :')).toBeDefined();
    expect(getByText('Aire panneaux totale :')).toBeDefined();
  });

  it('preset picker : 5 options, valeur initiale "1220x2440"', () => {
    const { getByRole } = render(<PlanTab />);
    const select = getByRole('combobox') as HTMLSelectElement;
    expect(select.options).toHaveLength(5);
    expect(select.value).toBe('1220x2440');
  });

  it('custom NON visible par défaut', () => {
    const { queryByText } = render(<PlanTab />);
    expect(queryByText('Largeur panneau')).toBeNull();
    expect(queryByText('Hauteur panneau')).toBeNull();
  });

  it('select preset "1220x1220" : mutation ATOMIQUE panelW + panelH', () => {
    const { getByRole } = render(<PlanTab />);
    const select = getByRole('combobox') as HTMLSelectElement;
    act(() => { fireEvent.change(select, { target: { value: '1220x1220' } }); });
    const after = useNichoirStore.getState().params;
    expect(after.panelW).toBe(1220);
    expect(after.panelH).toBe(1220);
  });

  it('default preset → 1 panneau rendu', () => {
    const { container } = render(<PlanTab />);
    const layout = computeCutLayout(createInitialState().params);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(layout.panels.length);
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it('panneau étroit → multi-panneaux rendus', () => {
    act(() => {
      useNichoirStore.getState().setParam('panelW', 200);
      useNichoirStore.getState().setParam('panelH', 300);
    });
    const { container } = render(<PlanTab />);
    const expected = computeCutLayout(useNichoirStore.getState().params).panels.length;
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(expected);
    expect(expected).toBeGreaterThan(1);
  });

  it('pièce surdimensionnée (panneau 100x100) → bannière overflow rendue', () => {
    act(() => {
      useNichoirStore.getState().setParam('panelW', 100);
      useNichoirStore.getState().setParam('panelH', 100);
    });
    const { getByRole, getByText } = render(<PlanTab />);
    // role="alert" sur OverflowBanner
    expect(getByRole('alert')).toBeDefined();
    expect(getByText('⚠ Pièces plus grandes que le panneau')).toBeDefined();
  });

  it('stats : totalUsedArea rendue', () => {
    const layout = computeCutLayout(createInitialState().params);
    const { getByText } = render(<PlanTab />);
    expect(getByText(formatPlanArea(layout.totalUsedArea))).toBeDefined();
    expect(getByText(formatPlanSize(1220, 2440))).toBeDefined();
  });

  it('stats : overflowCount masqué quand overflow = 0', () => {
    const { queryByText } = render(<PlanTab />);
    expect(queryByText('Pièces hors panneau :')).toBeNull();
  });

  it('switch lang fr → en : labels traduits', () => {
    const { getByText, rerender } = render(<PlanTab />);
    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<PlanTab />);
    expect(getByText('▸ SHEET SIZE')).toBeDefined();
    expect(getByText('Sheet:')).toBeDefined();
    expect(getByText('Sheet count:')).toBeDefined();
    expect(getByText('Mean occupation:')).toBeDefined();
  });
});
