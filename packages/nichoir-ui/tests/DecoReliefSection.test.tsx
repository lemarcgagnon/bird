import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

// Mock resampleHeightmapFromSource pour isoler la UI de la logique DOM/canvas.
vi.mock('../src/utils/parseDecoFile.js', () => ({
  parseDecoFile: vi.fn(),
  resampleHeightmapFromSource: vi.fn(),
  RASTER_SOURCE_SIZE: 256,
}));

import { DecoReliefSection } from '../src/components/tabs/DecoReliefSection.js';
import { resampleHeightmapFromSource } from '../src/utils/parseDecoFile.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

const resampleMock = vi.mocked(resampleHeightmapFromSource);

function loadFront(overrides: Parameters<ReturnType<typeof useNichoirStore.getState>['setDecoSlot']>[1] = {}): void {
  act(() => {
    useNichoirStore.getState().setDecoSlot('front', {
      source: '<svg front/>',
      sourceType: 'svg',
      parsedShapes: null,
      heightmapData: new Uint8ClampedArray(64 * 64 * 4),
      heightmapResolution: 64,
      resolution: 64,
      mode: 'heightmap',
      enabled: true,
      ...overrides,
    });
  });
}

function loadBack(overrides: Parameters<ReturnType<typeof useNichoirStore.getState>['setDecoSlot']>[1] = {}): void {
  act(() => {
    useNichoirStore.getState().setDecoSlot('back', {
      source: '<svg back/>',
      sourceType: 'svg',
      parsedShapes: null,
      heightmapData: new Uint8ClampedArray(64 * 64 * 4),
      heightmapResolution: 64,
      resolution: 64,
      mode: 'heightmap',
      enabled: true,
      ...overrides,
    });
  });
}

beforeEach(() => {
  cleanup();
  resampleMock.mockReset();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DecoReliefSection — rendu + mutations simples', () => {
  it('rend 3 sliders + 2 checkboxes (invert + carveThrough) + hint bevel + hint resolution', () => {
    loadFront();
    const { getByText, getAllByRole } = render(<DecoReliefSection />);
    expect(getByText('▸ RELIEF')).toBeDefined();
    expect(getByText('Profondeur')).toBeDefined();
    expect(getByText('Bevel')).toBeDefined();
    expect(getByText('Inverser (heightmap)')).toBeDefined();
    expect(getByText('Découpe traversante (mode vectoriel)')).toBeDefined();
    expect(getByText('Résolution')).toBeDefined();
    expect(getByText('Bevel actif uniquement en mode vectoriel.')).toBeDefined();
    expect(getByText(/128 = très détaillé/)).toBeDefined();
    const sliders = getAllByRole('slider');
    expect(sliders).toHaveLength(3);   // depth, bevel, resolution
    const checkboxes = getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);   // invert, carveThrough
  });

  it('slide depth → slot.depth muté', () => {
    loadFront();
    const { getAllByRole } = render(<DecoReliefSection />);
    const depth = (getAllByRole('slider') as HTMLInputElement[])[0]!;
    act(() => { fireEvent.change(depth, { target: { value: '5' } }); });
    expect(useNichoirStore.getState().decos.front.depth).toBe(5);
  });

  it('slide bevel → slot.bevel muté', () => {
    loadFront();
    const { getAllByRole } = render(<DecoReliefSection />);
    const bevel = (getAllByRole('slider') as HTMLInputElement[])[1]!;
    act(() => { fireEvent.change(bevel, { target: { value: '50' } }); });
    expect(useNichoirStore.getState().decos.front.bevel).toBe(50);
  });

  it('toggle invert → slot.invert muté', () => {
    loadFront();
    const { getAllByRole } = render(<DecoReliefSection />);
    expect(useNichoirStore.getState().decos.front.invert).toBe(false);
    // Index 0 = invert (rendu avant carveThrough)
    act(() => { fireEvent.click(getAllByRole('checkbox')[0]!); });
    expect(useNichoirStore.getState().decos.front.invert).toBe(true);
  });

  it('toggle carveThrough → slot.carveThrough muté', () => {
    loadFront();
    const { getAllByRole } = render(<DecoReliefSection />);
    expect(useNichoirStore.getState().decos.front.carveThrough).toBe(false);
    // Index 1 = carveThrough (rendu après invert)
    act(() => { fireEvent.click(getAllByRole('checkbox')[1]!); });
    expect(useNichoirStore.getState().decos.front.carveThrough).toBe(true);
  });
});

describe('DecoReliefSection — resolution slider : resample async + debounce + token', () => {
  it('slide resolution → slot.resolution muté immédiatement (feedback UI), resample non encore lancé', () => {
    // Pas de fake timers — on vérifie juste l'état synchrone immédiat après le
    // fireEvent.change, AVANT la fin du debounce (200ms).
    loadFront();
    resampleMock.mockResolvedValue(new Uint8ClampedArray(96 * 96 * 4));
    const { getAllByRole } = render(<DecoReliefSection />);
    const res = (getAllByRole('slider') as HTMLInputElement[])[2]!;

    act(() => { fireEvent.change(res, { target: { value: '96' } }); });

    // Immédiat : resolution muté dans le slot.
    expect(useNichoirStore.getState().decos.front.resolution).toBe(96);
    // heightmapResolution reste à 64 (pas encore resamplé).
    expect(useNichoirStore.getState().decos.front.heightmapResolution).toBe(64);
    // Pas encore d'appel resample (debounce en cours).
    expect(resampleMock).not.toHaveBeenCalled();
  });

  it('après debounce 200ms → resample appelé + heightmapData + heightmapResolution mis à jour', async () => {
    // Real timers : vi.useFakeTimers + await waitFor est incompatible sur ce
    // setup (waitFor utilise real timers en interne pour polling, fake timers
    // bloquerait). Debounce de 200ms → on attend 250ms réels, tolérable.
    loadFront();
    const fakeData = new Uint8ClampedArray(96 * 96 * 4).fill(42);
    resampleMock.mockResolvedValue(fakeData);
    const { getAllByRole } = render(<DecoReliefSection />);
    const res = (getAllByRole('slider') as HTMLInputElement[])[2]!;

    act(() => { fireEvent.change(res, { target: { value: '96' } }); });
    // Attendre le debounce + la promise microtask
    await new Promise((r) => setTimeout(r, 250));

    await waitFor(() => { expect(resampleMock).toHaveBeenCalledWith('<svg front/>', 'svg', 96); });
    await waitFor(() => {
      expect(useNichoirStore.getState().decos.front.heightmapResolution).toBe(96);
    });
    expect(useNichoirStore.getState().decos.front.heightmapData).toBe(fakeData);
  });

  it('token de génération : 2 slides rapides → seul le dernier applique setDecoSlot', async () => {
    loadFront();
    const first = new Uint8ClampedArray(80 * 80 * 4).fill(1);
    const second = new Uint8ClampedArray(96 * 96 * 4).fill(2);
    let resolveFirst: (v: Uint8ClampedArray) => void = () => {};
    resampleMock
      .mockImplementationOnce(() => new Promise<Uint8ClampedArray>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(second);

    const { getAllByRole } = render(<DecoReliefSection />);
    const res = (getAllByRole('slider') as HTMLInputElement[])[2]!;

    // Slide #1 : 80 → lancé après 200ms de debounce
    act(() => { fireEvent.change(res, { target: { value: '80' } }); });
    await new Promise((r) => setTimeout(r, 250));

    expect(resampleMock).toHaveBeenCalledTimes(1);
    // #1 est en vol (pending), pas encore résolu.

    // Slide #2 : 96 → nouveau token + nouveau resample (second)
    act(() => { fireEvent.change(res, { target: { value: '96' } }); });
    await new Promise((r) => setTimeout(r, 250));

    expect(resampleMock).toHaveBeenCalledTimes(2);

    // #2 résolu, applique setDecoSlot
    await waitFor(() => {
      expect(useNichoirStore.getState().decos.front.heightmapResolution).toBe(96);
    });
    expect(useNichoirStore.getState().decos.front.heightmapData).toBe(second);

    // #1 résolu en RETARD (résultat périmé, token invalidé)
    await act(async () => { resolveFirst(first); await Promise.resolve(); });

    // heightmapData reste #2, pas écrasé par #1.
    expect(useNichoirStore.getState().decos.front.heightmapData).toBe(second);
    expect(useNichoirStore.getState().decos.front.heightmapResolution).toBe(96);
  });

  it('erreur resample → role="alert" + revert resolution vers heightmapResolution', async () => {
    loadFront();
    resampleMock.mockRejectedValue(new Error('canvas fail'));
    const { getAllByRole, findByRole } = render(<DecoReliefSection />);
    const res = (getAllByRole('slider') as HTMLInputElement[])[2]!;

    act(() => { fireEvent.change(res, { target: { value: '128' } }); });
    expect(useNichoirStore.getState().decos.front.resolution).toBe(128);

    await new Promise((r) => setTimeout(r, 250));

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('canvas fail');
    // Revert : resolution revient à 64 (heightmapResolution stable)
    expect(useNichoirStore.getState().decos.front.resolution).toBe(64);
  });

  it('Supprimer pendant resample en vol → résultat async ignoré (token + source===null check)', async () => {
    loadFront();
    const fakeData = new Uint8ClampedArray(96 * 96 * 4);
    let resolveResample: (v: Uint8ClampedArray) => void = () => {};
    resampleMock.mockImplementation(() => new Promise<Uint8ClampedArray>((resolve) => { resolveResample = resolve; }));

    const { getAllByRole } = render(<DecoReliefSection />);
    const res = (getAllByRole('slider') as HTMLInputElement[])[2]!;
    act(() => { fireEvent.change(res, { target: { value: '96' } }); });
    await new Promise((r) => setTimeout(r, 250));

    // Simule un Supprimer pendant le resample
    act(() => {
      useNichoirStore.getState().setDecoSlot('front', {
        source: null, sourceType: null, heightmapData: null,
      });
    });

    // Résout le resample APRÈS le Supprimer
    await act(async () => { resolveResample(fakeData); await Promise.resolve(); });

    // heightmapData reste null (pas écrasé par le résultat périmé).
    // Le check source===null dans triggerResample skip le setDecoSlot.
    expect(useNichoirStore.getState().decos.front.heightmapData).toBeNull();
    expect(useNichoirStore.getState().decos.front.source).toBeNull();
  });

  // Correction codex P2.7c finding #2 : upload d'un nouveau fichier sur le
  // même slot pendant un resample en vol. Sans la capture de sourceAtStart,
  // le résultat périmé du resample écraserait heightmapData du nouveau fichier.
  it('Upload nouveau fichier pendant resample → résultat async ignoré (source changée depuis start)', async () => {
    loadFront();
    const staleData = new Uint8ClampedArray(96 * 96 * 4).fill(1);  // résultat périmé
    const freshData = new Uint8ClampedArray(128 * 128 * 4).fill(2);  // nouveau upload
    let resolveStale: (v: Uint8ClampedArray) => void = () => {};
    resampleMock.mockImplementation(
      () => new Promise<Uint8ClampedArray>((resolve) => { resolveStale = resolve; }),
    );

    const { getAllByRole } = render(<DecoReliefSection />);
    const res = (getAllByRole('slider') as HTMLInputElement[])[2]!;
    // Slide resolution → resample A en vol sur source='<svg front/>'
    act(() => { fireEvent.change(res, { target: { value: '96' } }); });
    await new Promise((r) => setTimeout(r, 250));

    // Simule un upload d'un nouveau fichier sur le même slot : source change.
    act(() => {
      useNichoirStore.getState().setDecoSlot('front', {
        source: 'data:image/png;base64,NEWFILE',
        sourceType: 'image',
        parsedShapes: null,
        heightmapData: freshData,
        heightmapResolution: 128,
        resolution: 128,
        mode: 'heightmap',
        lastParseWarning: null,
        enabled: true,
      });
    });

    // Résout le resample A APRÈS l'upload (résultat périmé pour l'ancien source)
    await act(async () => { resolveStale(staleData); await Promise.resolve(); });

    // heightmapData reste `freshData` (pas écrasé par staleData).
    // Le check source/sourceType !== start dans triggerResample skip le setDecoSlot.
    expect(useNichoirStore.getState().decos.front.heightmapData).toBe(freshData);
    expect(useNichoirStore.getState().decos.front.source).toBe('data:image/png;base64,NEWFILE');
  });

  // Correction codex P2.7c finding #1 : debounce PAR SLOT. Sans fix, le switch
  // de slot active tuerait le timer de l'ancien slot via le `debounceRef` global.
  it('Debounce par slot : slide front + switch back + slide back → 2 resamples partent indépendamment', async () => {
    loadFront({ source: '<svg F/>', heightmapResolution: 64, resolution: 64 });
    loadBack({ source: '<svg B/>', heightmapResolution: 64, resolution: 64 });
    const frontResult = new Uint8ClampedArray(96 * 96 * 4).fill(11);
    const backResult = new Uint8ClampedArray(80 * 80 * 4).fill(22);
    resampleMock.mockImplementation((src: string) => {
      if (src === '<svg F/>') return Promise.resolve(frontResult);
      if (src === '<svg B/>') return Promise.resolve(backResult);
      return Promise.reject(new Error('unexpected src'));
    });

    const { getAllByRole, rerender } = render(<DecoReliefSection />);
    // Slide #1 : front à 96 (démarre timer pour front)
    const resFront = (getAllByRole('slider') as HTMLInputElement[])[2]!;
    expect(resFront.value).toBe('64');
    await act(async () => { fireEvent.change(resFront, { target: { value: '96' } }); });

    // ÉTAPE 1 — avant le switch, switch pendant le debounce (T<200ms)
    await act(async () => { useNichoirStore.getState().setActiveDecoKey('back'); });
    rerender(<DecoReliefSection />);
    const resAfterSwitch = (getAllByRole('slider') as HTMLInputElement[])[2]!;
    expect(resAfterSwitch.value).toBe('64'); // back.resolution au start

    // Slide #2 : back à 80
    await act(async () => { fireEvent.change(resAfterSwitch, { target: { value: '80' } }); });
    expect(useNichoirStore.getState().decos.back.resolution).toBe(80);

    // ÉTAPE 2 — attendre que les DEUX timers fire (>200ms pour le plus tardif)
    await new Promise((r) => setTimeout(r, 500));

    // Les 2 resamples ont été appelés indépendamment
    await waitFor(
      () => { expect(resampleMock).toHaveBeenCalledTimes(2); },
      { timeout: 2000 },
    );
    // Inspection des calls : doit contenir front et back
    const calls = resampleMock.mock.calls.map((c) => c[0]);
    expect(calls).toContain('<svg F/>');
    expect(calls).toContain('<svg B/>');

    // ÉTAPE 3 — les 2 slots ont leur heightmapData mis à jour
    await waitFor(() => {
      expect(useNichoirStore.getState().decos.front.heightmapData).toBe(frontResult);
    }, { timeout: 2000 });
    await waitFor(() => {
      expect(useNichoirStore.getState().decos.back.heightmapData).toBe(backResult);
    }, { timeout: 2000 });
    expect(useNichoirStore.getState().decos.front.heightmapResolution).toBe(96);
    expect(useNichoirStore.getState().decos.back.heightmapResolution).toBe(80);
  });

  // Correction codex P2.7c finding #3 (fuite UI) : error inline scopé par slot
  // via useEffect cleanup sur activeDecoKey.
  it('switch activeDecoKey → error de resample clear (pas de fuite visuelle entre slots)', async () => {
    loadFront();
    resampleMock.mockRejectedValue(new Error('boom'));
    const { getAllByRole, findByRole, queryByRole, rerender } = render(<DecoReliefSection />);
    const res = (getAllByRole('slider') as HTMLInputElement[])[2]!;
    act(() => { fireEvent.change(res, { target: { value: '128' } }); });
    await new Promise((r) => setTimeout(r, 250));

    // Error visible sur front
    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('boom');

    // Switch vers back (qui n'a pas de source → la section ne devrait pas render,
    // mais pour tester le cleanup même sur un back chargé, on load back aussi)
    loadBack();
    act(() => { useNichoirStore.getState().setActiveDecoKey('back'); });
    rerender(<DecoReliefSection />);

    // L'error de front ne fuit pas sur back
    expect(queryByRole('alert')).toBeNull();
  });
});
