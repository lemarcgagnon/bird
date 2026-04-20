import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

// Mock le helper parseDecoFile pour isoler la UI de la logique DOM-bound.
// Pattern : les tests UI valident le wiring (handler → helper → setDecoSlot)
// et l'error handling. La logique de parse/raster est couverte séparément
// dans tests/parseDecoFile.test.ts.
vi.mock('../src/utils/parseDecoFile.js', () => ({
  parseDecoFile: vi.fn(),
  RASTER_SOURCE_SIZE: 256,
}));

import { DecoFileSection } from '../src/components/tabs/DecoFileSection.js';
import { parseDecoFile } from '../src/utils/parseDecoFile.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';
import type { DecoParseResult } from '../src/utils/parseDecoFile.js';

// Cast explicite pour accès aux API mock
const parseDecoFileMock = vi.mocked(parseDecoFile);

function makeFakeSvgResult(overrides: Partial<DecoParseResult> = {}): DecoParseResult {
  return {
    source: '<svg/>',
    sourceType: 'svg',
    parsedShapes: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 0 }]],
    bbox: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    heightmapData: new Uint8ClampedArray(64 * 64 * 4).fill(128),
    heightmapResolution: 64,
    mode: 'vector',
    lastParseWarning: null,
    ...overrides,
  };
}

beforeEach(() => {
  cleanup();
  parseDecoFileMock.mockReset();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('DecoFileSection — rendu initial', () => {
  it('rend section label + bouton Charger + bouton Supprimer (disabled si source=null)', () => {
    const { getByText, getByRole } = render(<DecoFileSection />);
    expect(getByText('▸ FICHIER')).toBeDefined();
    expect(getByText('Charger SVG / PNG / JPG')).toBeDefined();
    const deleteBtn = getByRole('button', { name: 'Supprimer' });
    expect((deleteBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('attribut accept sur input file : .svg + svg+xml + png + jpeg', () => {
    const { container } = render(<DecoFileSection />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('.svg,image/svg+xml,image/png,image/jpeg');
  });
});

describe('DecoFileSection — upload happy path', () => {
  it('upload SVG → parseDecoFile appelé + slot peuplé avec enabled=true', async () => {
    parseDecoFileMock.mockResolvedValueOnce(makeFakeSvgResult());
    const { container } = render(<DecoFileSection />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['<svg/>'], 'test.svg', { type: 'image/svg+xml' });

    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await waitFor(() => { expect(parseDecoFileMock).toHaveBeenCalledTimes(1); });

    // Signature vérifiée : file, slot.resolution (64 default), t
    const [calledFile, calledRes] = parseDecoFileMock.mock.calls[0]!;
    expect(calledFile).toBe(file);
    expect(calledRes).toBe(64); // slot.front.resolution default (state.ts:28)

    const slot = useNichoirStore.getState().decos.front;
    expect(slot.source).toBe('<svg/>');
    expect(slot.sourceType).toBe('svg');
    expect(slot.parsedShapes?.length).toBe(1);
    expect(slot.mode).toBe('vector');
    expect(slot.enabled).toBe(true); // enabled=true forcé à toute charge réussie (codex)
    expect(slot.heightmapResolution).toBe(64);
    expect(slot.heightmapData?.length).toBe(64 * 64 * 4);
  });

  it('upload image → mode="heightmap", parsedShapes=null, enabled=true', async () => {
    parseDecoFileMock.mockResolvedValueOnce(makeFakeSvgResult({
      sourceType: 'image',
      source: 'data:image/png;base64,xxx',
      parsedShapes: null,
      bbox: null,
      mode: 'heightmap',
    }));
    const { container } = render(<DecoFileSection />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0x89])], 'test.png', { type: 'image/png' });

    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await waitFor(() => { expect(parseDecoFileMock).toHaveBeenCalled(); });

    const slot = useNichoirStore.getState().decos.front;
    expect(slot.sourceType).toBe('image');
    expect(slot.parsedShapes).toBeNull();
    expect(slot.mode).toBe('heightmap');
    expect(slot.enabled).toBe(true);
  });

  it('charge réussie avec SVG dégradé (warning) → enabled=true même avec warning', async () => {
    parseDecoFileMock.mockResolvedValueOnce(makeFakeSvgResult({
      parsedShapes: null,
      bbox: null,
      mode: 'heightmap',
      lastParseWarning: { key: 'deco.svg.noShapes' },
    }));
    const { container } = render(<DecoFileSection />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['<svg/>'], 'empty.svg');

    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await waitFor(() => { expect(parseDecoFileMock).toHaveBeenCalled(); });

    const slot = useNichoirStore.getState().decos.front;
    expect(slot.enabled).toBe(true); // codex : enabled=true à toute charge réussie
    expect(slot.lastParseWarning).toEqual({ key: 'deco.svg.noShapes' });
    expect(slot.mode).toBe('heightmap');
  });
});

describe('DecoFileSection — erreur runtime', () => {
  it('parseDecoFile rejects → role="alert" avec t("deco.error.load") + slot inchangé', async () => {
    parseDecoFileMock.mockRejectedValueOnce(new Error('boom'));
    const { container, findByRole } = render(<DecoFileSection />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['garbage'], 'test.svg', { type: 'image/svg+xml' });

    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });

    const alert = await findByRole('alert');
    expect(alert.textContent).toBe('Erreur de chargement : boom');

    // Slot inchangé (codex : patch partiel seulement en cas de succès)
    const slot = useNichoirStore.getState().decos.front;
    expect(slot.source).toBeNull();
    expect(slot.enabled).toBe(false);
  });
});

describe('DecoFileSection — bouton Supprimer + reset hybride', () => {
  it('bouton Supprimer activé après charge', async () => {
    parseDecoFileMock.mockResolvedValueOnce(makeFakeSvgResult());
    const { container, getByRole } = render(<DecoFileSection />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['<svg/>'], 'test.svg');
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await waitFor(() => { expect(useNichoirStore.getState().decos.front.source).not.toBeNull(); });

    const deleteBtn = getByRole('button', { name: 'Supprimer' }) as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(false);
  });

  it('click Supprimer → reset hybride (enabled=false, source/parsing=null, dims/relief conservés)', () => {
    // Pré-peuple le slot avec valeurs customisées à conserver + bloc source à clear
    act(() => {
      useNichoirStore.getState().setDecoSlot('front', {
        source: '<svg/>',
        sourceType: 'svg',
        parsedShapes: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 0 }]],
        bbox: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        heightmapData: new Uint8ClampedArray(64 * 64 * 4),
        lastParseWarning: { key: 'deco.svg.malformed' },
        enabled: true,
        // Réglages à conserver :
        mode: 'vector',
        w: 80, h: 90,
        posX: 30, posY: 40,
        rotation: 15,
        depth: 3.5,
        bevel: 50,
        invert: true,
        resolution: 96,
        clipToPanel: true,
      });
    });

    const { getByRole } = render(<DecoFileSection />);
    act(() => { fireEvent.click(getByRole('button', { name: 'Supprimer' })); });

    const slot = useNichoirStore.getState().decos.front;
    // Bloc source/parsing réinitialisé
    expect(slot.enabled).toBe(false);
    expect(slot.source).toBeNull();
    expect(slot.sourceType).toBeNull();
    expect(slot.parsedShapes).toBeNull();
    expect(slot.bbox).toBeNull();
    expect(slot.heightmapData).toBeNull();
    expect(slot.lastParseWarning).toBeNull();
    // Réglages conservés (hybride v15 — codex)
    expect(slot.mode).toBe('vector');
    expect(slot.w).toBe(80);
    expect(slot.h).toBe(90);
    expect(slot.posX).toBe(30);
    expect(slot.posY).toBe(40);
    expect(slot.rotation).toBe(15);
    expect(slot.depth).toBe(3.5);
    expect(slot.bevel).toBe(50);
    expect(slot.invert).toBe(true);
    expect(slot.resolution).toBe(96);
    expect(slot.clipToPanel).toBe(true);
  });

  it('isolation : Supprimer sur slot front ne touche pas slot back', () => {
    act(() => {
      useNichoirStore.getState().setDecoSlot('front', {
        source: '<svg/>', sourceType: 'svg', enabled: true,
      });
      useNichoirStore.getState().setDecoSlot('back', {
        source: 'data:image/png;...', sourceType: 'image', enabled: true,
      });
    });

    const { getByRole } = render(<DecoFileSection />);
    act(() => { fireEvent.click(getByRole('button', { name: 'Supprimer' })); });

    // front reset
    expect(useNichoirStore.getState().decos.front.source).toBeNull();
    expect(useNichoirStore.getState().decos.front.enabled).toBe(false);
    // back intact
    expect(useNichoirStore.getState().decos.back.source).toBe('data:image/png;...');
    expect(useNichoirStore.getState().decos.back.enabled).toBe(true);
  });
});

describe('DecoFileSection — i18n en', () => {
  it('lang=en : labels traduits', () => {
    act(() => { useNichoirStore.getState().setLang('en'); });
    const { getByText, getByRole } = render(<DecoFileSection />);
    expect(getByText('▸ FILE')).toBeDefined();
    expect(getByText('Load SVG / PNG / JPG')).toBeDefined();
    expect(getByRole('button', { name: 'Delete' })).toBeDefined();
  });
});
