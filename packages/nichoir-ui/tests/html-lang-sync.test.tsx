import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// Mock viewport pour ne pas charger Three.js
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
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

beforeEach(() => {
  cleanup();
  document.documentElement.lang = 'fr';
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('html[lang] sync', () => {
  it('au mount, html[lang] est set à store.lang (fr par défaut)', () => {
    render(<NichoirApp />);
    expect(document.documentElement.lang).toBe('fr');
  });

  it('setLang("en") → html[lang]="en"', () => {
    render(<NichoirApp />);
    act(() => { useNichoirStore.getState().setLang('en'); });
    expect(document.documentElement.lang).toBe('en');
  });

  it('setLang("fr") → html[lang]="fr" (retour)', () => {
    render(<NichoirApp />);
    act(() => { useNichoirStore.getState().setLang('en'); });
    act(() => { useNichoirStore.getState().setLang('fr'); });
    expect(document.documentElement.lang).toBe('fr');
  });
});
