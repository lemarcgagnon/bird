// tests/ExportPng3dSection.test.tsx
//
// Tests unitaires pour ExportPng3dSection.
// Mock viewport + DownloadService pour éviter les dépendances DOM canvas en jsdom.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { useRef } from 'react';

// Mock ImperativeThreeViewport (uniforme avec les autres tests de l'app).
const { mockCtor } = vi.hoisted(() => {
  const mockCtor = vi.fn(() => ({
    mount: vi.fn(),
    update: vi.fn(),
    unmount: vi.fn(),
    readCameraState: vi.fn(),
    captureAsPng: vi.fn(async () => new Uint8Array([137, 80, 78, 71])), // magic bytes PNG
  }));
  return { mockCtor };
});
vi.mock('../src/viewports/ImperativeThreeViewport.js', () => ({
  ImperativeThreeViewport: mockCtor,
}));

import { ExportPng3dSection } from '../src/components/tabs/ExportPng3dSection.js';
import { DownloadServiceProvider } from '../src/adapters/DownloadServiceContext.js';
import { ViewportRefProvider } from '../src/viewports/ViewportRefContext.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';
import type { DownloadService } from '@nichoir/adapters';
import type { ViewportAdapter } from '../src/viewports/ViewportAdapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpyService(): { service: DownloadService; trigger: ReturnType<typeof vi.fn> } {
  const trigger = vi.fn();
  trigger.mockImplementation(async () => {});
  const service: DownloadService = {
    trigger: (...args): Promise<void> => trigger(...args) as Promise<void>,
  };
  return { service, trigger };
}

function makeMockViewport(
  opts: { captureResult?: Uint8Array; throwOnCapture?: boolean } = {},
): ViewportAdapter {
  const { captureResult = new Uint8Array([137, 80, 78, 71]), throwOnCapture = false } = opts;
  return {
    mount: vi.fn(),
    update: vi.fn(),
    unmount: vi.fn(),
    readCameraState: vi.fn(),
    captureAsPng: throwOnCapture
      ? vi.fn(async () => { throw new Error('captureAsPng failed'); })
      : vi.fn(async () => captureResult),
  };
}

// Wrapper qui fournit ViewportRefProvider + DownloadServiceProvider.
// `adapter` null = viewport pas encore monté (ref.current = null).
function makeWrapper(
  service: DownloadService,
  adapter: ViewportAdapter | null,
): ({ children }: { children: React.ReactNode }) => React.JSX.Element {
  return function Wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    const ref = useRef<ViewportAdapter | null>(adapter);
    return (
      <ViewportRefProvider viewportRef={ref}>
        <DownloadServiceProvider service={service}>
          {children}
        </DownloadServiceProvider>
      </ViewportRefProvider>
    );
  };
}

beforeEach(() => {
  cleanup();
  mockCtor.mockClear();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExportPng3dSection', () => {
  it('rend le bouton + label (fr)', () => {
    const { service } = makeSpyService();
    const adapter = makeMockViewport();
    const { getByText } = render(<ExportPng3dSection />, {
      wrapper: makeWrapper(service, adapter),
    });
    expect(getByText('▸ EXPORT CAPTURE 3D')).toBeDefined();
    expect(getByText('⬇ Capture 3D (.png)')).toBeDefined();
  });

  it('click → appelle viewport.captureAsPng + declenche le download avec (bytes, filename, "image/png")', async () => {
    const captureResult = new Uint8Array([137, 80, 78, 71, 99]);
    const adapter = makeMockViewport({ captureResult });
    const { service, trigger } = makeSpyService();

    const { getByText } = render(<ExportPng3dSection />, {
      wrapper: makeWrapper(service, adapter),
    });

    await act(async () => {
      fireEvent.click(getByText('⬇ Capture 3D (.png)').closest('button')!);
    });

    await waitFor(() => { expect(trigger).toHaveBeenCalled(); });

    const [bytes, filename, mime] = trigger.mock.calls[0]!;
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes as Uint8Array).toEqual(captureResult);
    // filename : nichoir_3d_<timestamp>.png
    expect(typeof filename).toBe('string');
    expect((filename as string).startsWith('nichoir_3d_')).toBe(true);
    expect((filename as string).endsWith('.png')).toBe(true);
    expect(mime).toBe('image/png');

    // captureAsPng doit avoir été appelée
    expect(adapter.captureAsPng).toHaveBeenCalledTimes(1);
  });

  it('viewport pas prêt (ref.current = null) → affiche role="alert" avec message noViewport', async () => {
    const { service } = makeSpyService();
    // adapter=null : le viewport n'est pas encore monté
    const { getByText, findByRole } = render(<ExportPng3dSection />, {
      wrapper: makeWrapper(service, null),
    });

    await act(async () => {
      fireEvent.click(getByText('⬇ Capture 3D (.png)').closest('button')!);
    });

    const alert = await findByRole('alert');
    // fr default : 'export.error.generic' template → 'Erreur export : <noViewport message>'
    expect(alert.textContent).toContain('Aperçu 3D pas encore prêt');
  });

  it('captureAsPng rejette → affiche role="alert" avec le message d\'erreur', async () => {
    const adapter = makeMockViewport({ throwOnCapture: true });
    const { service } = makeSpyService();

    const { getByText, findByRole } = render(<ExportPng3dSection />, {
      wrapper: makeWrapper(service, adapter),
    });

    await act(async () => {
      fireEvent.click(getByText('⬇ Capture 3D (.png)').closest('button')!);
    });

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('captureAsPng failed');
  });

  it('switch lang fr → en : labels traduits', () => {
    const { service } = makeSpyService();
    const adapter = makeMockViewport();

    const { getByText } = render(<ExportPng3dSection />, {
      wrapper: makeWrapper(service, adapter),
    });

    act(() => { useNichoirStore.getState().setLang('en'); });

    expect(getByText('▸ 3D CAPTURE EXPORT')).toBeDefined();
    expect(getByText('⬇ 3D capture (.png)')).toBeDefined();
  });
});
