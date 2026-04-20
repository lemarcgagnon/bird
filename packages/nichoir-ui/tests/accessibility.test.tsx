import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import axe from 'axe-core';

// Mock viewport pour ne pas charger Three.js / WebGL
const { mockCtor } = vi.hoisted(() => {
  const mockCtor = vi.fn(() => ({
    mount: vi.fn(), update: vi.fn(), unmount: vi.fn(), readCameraState: vi.fn(),
  }));
  return { mockCtor };
});
vi.mock('../src/viewports/ImperativeThreeViewport.js', () => ({
  ImperativeThreeViewport: mockCtor,
}));

import { NichoirApp } from '../src/NichoirApp.js';
import { Sidebar } from '../src/components/Sidebar.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

beforeEach(() => {
  cleanup();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

/**
 * Exécute axe-core sur un element et retourne les violations serious/critical.
 * Filtre les issues moins importantes (moderate/minor) — on garde le bar
 * bas pour P2.2a, on pourra durcir plus tard.
 */
async function runAxe(el: Element): Promise<axe.Result[]> {
  const results = await axe.run(el, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
  });
  return results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
}

describe('Accessibility (axe-core)', () => {
  it('Sidebar seul : 0 violation serious/critical', async () => {
    const { container } = render(<Sidebar />);
    const violations = await runAxe(container);
    if (violations.length > 0) {
      console.error('axe violations:', JSON.stringify(violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      })), null, 2));
    }
    expect(violations).toHaveLength(0);
  });

  it('NichoirApp complet (DIM actif, défaut) : 0 violation serious/critical', async () => {
    const { container } = render(<NichoirApp />);
    const violations = await runAxe(container);
    if (violations.length > 0) {
      console.error('axe violations:', JSON.stringify(violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      })), null, 2));
    }
    expect(violations).toHaveLength(0);
  });

  it('NichoirApp avec VueTab actif + clip X coché : 0 violation serious/critical', async () => {
    // Bascule activeTab='vue' AVANT render pour que le DOM initial embarque VueTab,
    // puis active clip.x.on afin que le slider clip X conditionnel soit monté
    // (couvre la branche unmount-pattern via axe sur le slider réellement rendu).
    act(() => {
      useNichoirStore.getState().setActiveTab('vue');
      useNichoirStore.getState().setClipAxis('x', { on: true });
    });
    const { container } = render(<NichoirApp />);
    const violations = await runAxe(container);
    if (violations.length > 0) {
      console.error('axe VueTab violations:', JSON.stringify(violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      })), null, 2));
    }
    expect(violations).toHaveLength(0);
  });

  it('NichoirApp avec CalcTab actif : 0 violation serious/critical (couvre <table>)', async () => {
    // Bascule activeTab='calc' AVANT render pour que axe audite le vrai DOM
    // contenant CalcTab (<table>, <thead>, <tbody>, <th scope="col">).
    act(() => { useNichoirStore.getState().setActiveTab('calc'); });
    const { container } = render(<NichoirApp />);
    const violations = await runAxe(container);
    if (violations.length > 0) {
      console.error('axe CalcTab violations:', JSON.stringify(violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      })), null, 2));
    }
    expect(violations).toHaveLength(0);
  });

  it('NichoirApp avec Viewport qui throw : fallback a11y conforme (role=alert + Sidebar intacte)', async () => {
    // Override le mock global pour que ImperativeThreeViewport.mount throw.
    // Permet à axe d'auditer le DOM réel avec ViewportErrorFallback monté.
    vi.doMock('../src/viewports/ImperativeThreeViewport.js', () => ({
      ImperativeThreeViewport: vi.fn(() => ({
        mount: vi.fn(() => { throw new Error('WebGL context unavailable'); }),
        update: vi.fn(),
        unmount: vi.fn(),
        readCameraState: vi.fn(),
      })),
    }));
    // Silencer le console.error du boundary pendant le test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { NichoirApp: FreshApp } = await import('../src/NichoirApp.js');
    const { container } = render(<FreshApp />);
    const violations = await runAxe(container);
    if (violations.length > 0) {
      console.warn('axe ViewportBoundary fallback violations:', JSON.stringify(violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      })), null, 2));
    }
    expect(violations).toHaveLength(0);
    consoleSpy.mockRestore();
    vi.doUnmock('../src/viewports/ImperativeThreeViewport.js');
  });

  it('NichoirApp avec PlanTab actif : 0 violation serious/critical (couvre <svg role="img"> + <select>)', async () => {
    // Bascule activeTab='plan' AVANT render pour que axe audite le vrai DOM
    // contenant PlanTab (SVG avec role="img" + title + aria-label, select natif
    // avec aria-label, unmount pattern sliders custom).
    act(() => { useNichoirStore.getState().setActiveTab('plan'); });
    const { container } = render(<NichoirApp />);
    const violations = await runAxe(container);
    if (violations.length > 0) {
      console.error('axe PlanTab violations:', JSON.stringify(violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      })), null, 2));
    }
    expect(violations).toHaveLength(0);
  });

  it('NichoirApp avec ExportTab actif : 0 violation serious/critical (couvre 4 boutons + disabled + aria)', async () => {
    // Bascule activeTab='export' AVANT render pour que axe audite le vrai DOM
    // contenant ExportTab (4 boutons, dont "Porte seule" en état disabled
    // par défaut, liste de hints, provider DownloadService).
    act(() => { useNichoirStore.getState().setActiveTab('export'); });
    const { container } = render(<NichoirApp />);
    const violations = await runAxe(container);
    if (violations.length > 0) {
      console.error('axe ExportTab violations:', JSON.stringify(violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      })), null, 2));
    }
    expect(violations).toHaveLength(0);
  });

  it('NichoirApp avec DecoTab actif : 0 violation serious/critical (couvre select + checkbox label)', async () => {
    // Bascule activeTab='deco' AVANT render pour que axe audite le vrai DOM
    // contenant DecoTab (select avec aria-label, checkbox dans <label>
    // associé — pattern label wrap-around).
    act(() => { useNichoirStore.getState().setActiveTab('deco'); });
    const { container } = render(<NichoirApp />);
    const violations = await runAxe(container);
    if (violations.length > 0) {
      console.error('axe DecoTab violations:', JSON.stringify(violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      })), null, 2));
    }
    expect(violations).toHaveLength(0);
  });

  it('NichoirApp avec DecoTab actif + slot chargé : 0 violation serious/critical (couvre file input + Supprimer actif + status + sections P2.7c)', async () => {
    // Bascule activeTab='deco' ET pré-peuple le slot front pour que axe audite
    // le DOM réel incluant : file input, status "chargé", bouton Supprimer
    // activé, checkbox enable activée + cochée, ET les 4 sections P2.7c
    // (ToggleBar mode + 5 sliders dims + 2 sliders relief + checkbox invert +
    //  slider resolution + checkbox clipToPanel + hints).
    act(() => {
      useNichoirStore.getState().setActiveTab('deco');
      useNichoirStore.getState().setDecoSlot('front', {
        source: '<svg/>',
        sourceType: 'svg',
        parsedShapes: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 0 }]],
        heightmapData: new Uint8ClampedArray(64 * 64 * 4),
        enabled: true,
      });
    });
    const { container } = render(<NichoirApp />);
    const violations = await runAxe(container);
    if (violations.length > 0) {
      console.error('axe DecoTab loaded violations:', JSON.stringify(violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
      })), null, 2));
    }
    expect(violations).toHaveLength(0);
  });
});
