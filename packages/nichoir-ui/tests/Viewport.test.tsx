import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock hoisté : ImperativeThreeViewport spy.
// On capture les calls mount/update/unmount pour prouver que le wrapper React
// monte bien le viewport avec le state du store.
// ---------------------------------------------------------------------------

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
      mount: vi.fn((el: HTMLElement, state: unknown) => {
        calls.mount.push({ el, state });
      }),
      update: vi.fn((state: unknown) => {
        calls.update.push(state);
      }),
      unmount: vi.fn(() => {
        calls.unmount++;
      }),
      readCameraState: vi.fn(),
    };
  });
  return { mockCtor, mockInstances };
});

vi.mock('../src/viewports/ImperativeThreeViewport.js', () => ({
  ImperativeThreeViewport: mockCtor,
}));

beforeEach(() => {
  mockCtor.mockClear();
  mockInstances.length = 0;
});

// ---------------------------------------------------------------------------
// Imports après vi.mock
// ---------------------------------------------------------------------------

import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { Viewport } from '../src/components/Viewport.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Viewport (React wrapper)', () => {
  it('rend un <div> host et instancie ImperativeThreeViewport', () => {
    const { container } = render(<Viewport />);
    const host = container.querySelector('div');
    expect(host).not.toBeNull();
    expect(mockCtor).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('appelle mount() avec le host ref et le state du store', () => {
    const { container } = render(<Viewport />);
    expect(mockInstances.length).toBe(1);
    const calls = mockInstances[0]!;
    expect(calls.mount.length).toBe(1);
    const mountCall = calls.mount[0]!;
    // L'élément monté est le <div> rendu par le wrapper
    expect(mountCall.el).toBe(container.querySelector('div'));
    // Le state reçu est strictement celui du store (shape NichoirState)
    const initial = createInitialState();
    const received = mountCall.state as Record<string, unknown>;
    expect(received['params']).toBeDefined();
    expect((received['params'] as Record<string, unknown>)['W']).toBe(initial.params.W);
    expect((received['params'] as Record<string, unknown>)['slope']).toBe(initial.params.slope);
    expect(received['lang']).toBe(initial.lang);
    cleanup();
  });

  it('appelle unmount() quand le composant est démonté', () => {
    const { unmount } = render(<Viewport />);
    const calls = mockInstances[0]!;
    expect(calls.unmount).toBe(0);
    unmount();
    expect(calls.unmount).toBe(1);
    cleanup();
  });

  it('appelle update() lors d\'un changement de state', () => {
    render(<Viewport />);
    const calls = mockInstances[0]!;
    const updateCountBefore = calls.update.length;

    // act() flush les effects React après la mutation du store Zustand.
    // Sans act(), le useEffect [state] ne run pas dans le cycle de test.
    act(() => {
      useNichoirStore.getState().setState({ lang: 'en' });
    });

    expect(calls.update.length).toBeGreaterThan(updateCountBefore);
    const lastUpdateState = calls.update[calls.update.length - 1] as Record<string, unknown>;
    expect(lastUpdateState['lang']).toBe('en');
    // Remettre à l'initial pour ne pas polluer les autres tests
    act(() => {
      useNichoirStore.getState().setState({ lang: 'fr' });
    });
    cleanup();
  });
});

// ---------------------------------------------------------------------------
// NichoirApp smoke test
// ---------------------------------------------------------------------------

describe('NichoirApp', () => {
  it('rend un conteneur racine qui embarque le Viewport', async () => {
    const { NichoirApp } = await import('../src/NichoirApp.js');
    const { container } = render(<NichoirApp />);
    // Structure attendue : div racine > div Viewport
    const root = container.firstChild as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.tagName.toLowerCase()).toBe('div');
    // Le Viewport doit avoir été instancié via le wrapper
    expect(mockCtor).toHaveBeenCalled();
    cleanup();
  });

  it('chaîne DIM → store → Viewport.update : slider W muté → adapter.update reçoit params.W mis à jour', async () => {
    const { NichoirApp } = await import('../src/NichoirApp.js');
    const { getAllByRole } = render(<NichoirApp />);

    // DIM est l'onglet actif par défaut. Le premier slider rendu est W (80..400).
    // Les sliders dans le DOM : le range est role="slider", le num input role="spinbutton".
    const rangeInputs = getAllByRole('slider');
    const wRange = rangeInputs[0] as HTMLInputElement;

    const calls = mockInstances[0]!;
    const updateCountBefore = calls.update.length;

    act(() => { fireEvent.change(wRange, { target: { value: '220' } }); });

    // Assert : update a été rappelé avec params.W === 220
    expect(calls.update.length).toBeGreaterThan(updateCountBefore);
    const lastUpdateState = calls.update[calls.update.length - 1] as { params: { W: number } };
    expect(lastUpdateState.params.W).toBe(220);
    cleanup();
  });
});
