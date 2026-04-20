import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

import { DecoStatusSection } from '../src/components/tabs/DecoStatusSection.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';
import type { ParsedShape } from '@nichoir/core';

beforeEach(() => {
  cleanup();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

function makeFakeShapes(n: number): ParsedShape[] {
  return Array.from({ length: n }, () => [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 },
  ]);
}

describe('DecoStatusSection — slot vide', () => {
  it('source=null par défaut → "Aucun fichier chargé — Façade avant"', () => {
    const { getByText } = render(<DecoStatusSection />);
    expect(getByText('Aucun fichier chargé — Façade avant')).toBeDefined();
  });

  it('switch activeDecoKey → {panel} interpolé change', () => {
    act(() => { useNichoirStore.getState().setActiveDecoKey('roofL'); });
    const { getByText } = render(<DecoStatusSection />);
    expect(getByText('Aucun fichier chargé — Toit gauche')).toBeDefined();
  });
});

describe('DecoStatusSection — slot chargé SVG', () => {
  it('SVG avec 1 shape (singulier) → "SVG · 1 forme · raster 256×256 — Façade avant"', () => {
    act(() => {
      useNichoirStore.getState().setDecoSlot('front', {
        source: '<svg/>',
        sourceType: 'svg',
        parsedShapes: makeFakeShapes(1),
        heightmapData: new Uint8ClampedArray(64 * 64 * 4),
      });
    });
    const { getByText } = render(<DecoStatusSection />);
    expect(getByText('SVG · 1 forme · raster 256×256 — Façade avant')).toBeDefined();
  });

  it('SVG avec 3 shapes (pluriel) → "SVG · 3 formes · raster 256×256 — Façade avant"', () => {
    act(() => {
      useNichoirStore.getState().setDecoSlot('front', {
        source: '<svg/>',
        sourceType: 'svg',
        parsedShapes: makeFakeShapes(3),
        heightmapData: new Uint8ClampedArray(64 * 64 * 4),
      });
    });
    const { getByText } = render(<DecoStatusSection />);
    expect(getByText('SVG · 3 formes · raster 256×256 — Façade avant')).toBeDefined();
  });

  it('SVG dégradé (sans shapes) → "SVG · raster 256×256 — Façade avant" (pas de segment forme)', () => {
    act(() => {
      useNichoirStore.getState().setDecoSlot('front', {
        source: '<svg/>',
        sourceType: 'svg',
        parsedShapes: null,
        heightmapData: new Uint8ClampedArray(64 * 64 * 4),
      });
    });
    const { getByText } = render(<DecoStatusSection />);
    expect(getByText('SVG · raster 256×256 — Façade avant')).toBeDefined();
  });
});

describe('DecoStatusSection — slot chargé image', () => {
  it('PNG/JPG → "Image · raster 256×256 — Façade avant"', () => {
    act(() => {
      useNichoirStore.getState().setDecoSlot('front', {
        source: 'data:image/png;base64,xxx',
        sourceType: 'image',
        parsedShapes: null,
        heightmapData: new Uint8ClampedArray(64 * 64 * 4),
      });
    });
    const { getByText } = render(<DecoStatusSection />);
    expect(getByText('Image · raster 256×256 — Façade avant')).toBeDefined();
  });
});

describe('DecoStatusSection — raster 256×256 découplé de heightmapData.length', () => {
  // Codex P2.7b : le status doit afficher "raster 256×256" via la constante
  // RASTER_SOURCE_SIZE, pas dérivée de heightmapData.length (qui peut être à
  // target² × 4 après downsample).
  it.each([
    [16, '256×256'],
    [32, '256×256'],
    [64, '256×256'],
    [128, '256×256'],
  ])('heightmapResolution=%i → status affiche toujours "%s" (constante UI)', (res, expected) => {
    act(() => {
      useNichoirStore.getState().setDecoSlot('front', {
        source: 'data:image/png;base64,xxx',
        sourceType: 'image',
        parsedShapes: null,
        heightmapResolution: res,
        heightmapData: new Uint8ClampedArray(res * res * 4),
      });
    });
    const { getByText } = render(<DecoStatusSection />);
    expect(getByText(new RegExp(`raster ${expected}`))).toBeDefined();
  });
});

describe('DecoStatusSection — i18n en', () => {
  it('lang=en + slot vide → "No file loaded — Front"', () => {
    act(() => { useNichoirStore.getState().setLang('en'); });
    const { getByText } = render(<DecoStatusSection />);
    expect(getByText('No file loaded — Front')).toBeDefined();
  });

  it('lang=en + SVG 2 shapes → "SVG · 2 shapes · raster 256×256 — Front"', () => {
    act(() => {
      useNichoirStore.getState().setLang('en');
      useNichoirStore.getState().setDecoSlot('front', {
        source: '<svg/>',
        sourceType: 'svg',
        parsedShapes: makeFakeShapes(2),
        heightmapData: new Uint8ClampedArray(64 * 64 * 4),
      });
    });
    const { getByText } = render(<DecoStatusSection />);
    expect(getByText('SVG · 2 shapes · raster 256×256 — Front')).toBeDefined();
  });
});
