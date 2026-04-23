import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

// NichoirApp inclut Viewport → ImperativeThreeViewport → WebGL.
// Pour Sidebar.test.tsx, on mock le viewport pour ne pas charger THREE.
const { mockCtor } = vi.hoisted(() => {
  const mockCtor = vi.fn(() => ({
    mount: vi.fn(),
    update: vi.fn(),
    unmount: vi.fn(),
    readCameraState: vi.fn(),
  }));
  return { mockCtor };
});

vi.mock('../src/viewports/ImperativeThreeViewport.js', () => ({
  ImperativeThreeViewport: mockCtor,
}));

import { useRef } from 'react';
import { Sidebar } from '../src/components/Sidebar.js';
import { useNichoirStore } from '../src/store.js';
import { DownloadServiceProvider } from '../src/adapters/DownloadServiceContext.js';
import { ViewportRefProvider } from '../src/viewports/ViewportRefContext.js';
import { createInitialState } from '@nichoir/core';
import type { ViewportAdapter } from '../src/viewports/ViewportAdapter.js';

beforeEach(() => {
  cleanup();
  mockCtor.mockClear();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('Sidebar', () => {
  it('rend header + tablist + panel + footer (structure complète)', () => {
    const { getByRole, getByText } = render(<Sidebar />);
    // Header
    expect(getByText('⌂ NICHOIR')).toBeDefined();
    // Tablist
    expect(getByRole('tablist')).toBeDefined();
    // Tabpanel
    expect(getByRole('tabpanel')).toBeDefined();
    // Footer : LangSwitcher (aria-label 'Langue') + ThemeToggle
    expect(getByText('Langue')).toBeDefined();
  });

  it('6 onglets visibles avec labels i18n', () => {
    const { getAllByRole } = render(<Sidebar />);
    const tabs = getAllByRole('tab');
    expect(tabs).toHaveLength(6);
    const labels = tabs.map((t) => t.textContent);
    expect(labels).toEqual(['DIM.', 'VUE', 'DÉCOR', 'CALCUL', 'PLAN', 'EXPORT']);
  });

  it('onglet DIM actif par défaut (matches store.activeTab)', () => {
    const { getAllByRole } = render(<Sidebar />);
    const tabs = getAllByRole('tab');
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('false');
  });

  it('click sur un onglet → store.activeTab muté + panel aria-labelledby suit', () => {
    const { getAllByRole, getByRole, rerender } = render(<Sidebar />);
    act(() => { fireEvent.click(getAllByRole('tab')[2]!); }); // DÉCOR
    expect(useNichoirStore.getState().activeTab).toBe('deco');
    rerender(<Sidebar />);
    const panel = getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe('tab-btn-deco');
    expect(panel.id).toBe('nichoir-tab-panel-deco');
  });

  it('onglet DÉCOR rend DecoTab (P2.7a)', () => {
    // P2.7a : DÉCOR branché (target + enable). Le placeholder "construction"
    // reste comme fallback défensif mais n'est plus atteignable depuis un
    // activeTab valide (6/6 tabs livrés).
    act(() => { useNichoirStore.getState().setActiveTab('deco'); });
    const { getByText, queryByText } = render(<Sidebar />);
    expect(getByText('▸ PANNEAU CIBLE')).toBeDefined();
    expect(queryByText(/construction/i)).toBeNull();
  });

  it('onglet DIM rend DimTab (P2.2b)', () => {
    const { getByText, queryByText } = render(<Sidebar />);
    // Label de section CORPS doit être présent, placeholder construction doit être absent
    expect(getByText('▸ CORPS (BOÎTE)')).toBeDefined();
    expect(queryByText(/construction/i)).toBeNull();
  });

  it('onglet VUE rend VueTab (P2.3)', () => {
    act(() => { useNichoirStore.getState().setActiveTab('vue'); });
    const { getByText, queryByText } = render(<Sidebar />);
    expect(getByText('▸ MODE D\'AFFICHAGE')).toBeDefined();
    expect(queryByText(/construction/i)).toBeNull();
  });

  it('onglet CALC rend CalcTab (P2.4)', () => {
    act(() => { useNichoirStore.getState().setActiveTab('calc'); });
    const { getByText, queryByText } = render(<Sidebar />);
    expect(getByText('▸ VOLUMES')).toBeDefined();
    expect(getByText('▸ LISTE DE COUPE')).toBeDefined();
    expect(queryByText(/construction/i)).toBeNull();
  });

  it('onglet PLAN rend PlanTab (P2.5)', () => {
    act(() => { useNichoirStore.getState().setActiveTab('plan'); });
    const { getByText, getByRole, queryByText } = render(<Sidebar />);
    expect(getByText('▸ TAILLE DU PANNEAU')).toBeDefined();
    expect(getByRole('img')).toBeDefined(); // SVG preview
    expect(queryByText(/construction/i)).toBeNull();
  });

  it('onglet EXPORT rend ExportTab (P2.6)', () => {
    // ExportTab consomme useDownloadService + useViewportRef → wraps providers.
    const stub = { trigger: vi.fn(async () => {}) };
    act(() => { useNichoirStore.getState().setActiveTab('export'); });
    function Wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
      const ref = useRef<ViewportAdapter | null>(null);
      return (
        <ViewportRefProvider viewportRef={ref}>
          <DownloadServiceProvider service={stub}>
            {children}
          </DownloadServiceProvider>
        </ViewportRefProvider>
      );
    }
    const { getByText, queryByText } = render(<Sidebar />, { wrapper: Wrapper });
    expect(getByText('▸ EXPORT STL (IMPRESSION 3D)')).toBeDefined();
    expect(getByText('▸ EXPORT PLAN DE COUPE')).toBeDefined();
    expect(getByText('▸ EXPORT CAPTURE 3D')).toBeDefined();
    expect(queryByText(/construction/i)).toBeNull();
  });

  it('switch lang → labels mis à jour partout', () => {
    const { getAllByRole, getByText, rerender } = render(<Sidebar />);
    // FR initial
    expect(getByText('CALCUL')).toBeDefined();
    // Switch to EN via store
    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<Sidebar />);
    expect(getAllByRole('tab').map((t) => t.textContent)).toEqual(
      ['DIM.', 'VIEW', 'DECOR', 'CALC', 'PLAN', 'EXPORT'],
    );
  });
});
