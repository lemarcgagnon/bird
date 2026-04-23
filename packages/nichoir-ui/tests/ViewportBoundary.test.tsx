import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

import { ViewportBoundary } from '../src/components/ViewportBoundary.js';
import { ViewportErrorFallback } from '../src/components/ViewportErrorFallback.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

// ---------------------------------------------------------------------------
// Helpers : <Thrower /> simule un enfant qui throw. Deux variantes :
//   - ThrowerOnRender : throw pendant render (plus simple, déclenche le
//     boundary via getDerivedStateFromError synchrone)
//   - (pas besoin de ThrowerOnEffect : React propage les erreurs de commit/
//     useEffect via le même boundary mechanism)
// ---------------------------------------------------------------------------

function ThrowerOnRender({ message }: { message: string }): React.JSX.Element {
  throw new Error(message);
}

// Helper : wrappe un enfant avec une class minimale qui laisse le boundary
// le bubbling natif de React (pas besoin de hack, juste du JSX standard).
function StubFallback(): React.JSX.Element {
  return <div data-testid="stub-fallback">STUB_FALLBACK</div>;
}

// ---------------------------------------------------------------------------
// Silencieux `console.error` pour la durée des tests qui throw (React 19 log
// l'erreur en test env, on ne veut pas polluer la sortie). On restaure dans
// afterEach.
// ---------------------------------------------------------------------------

// `vi.spyOn` renvoie un type paramétré difficile à annoter en strict mode ;
// on passe par un `ReturnType` laxiste — seul l'usage compte ici.
let consoleSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  cleanup();
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) as unknown as ReturnType<typeof vi.fn>;
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

afterEach(() => {
  consoleSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Boundary générique
// ---------------------------------------------------------------------------

describe('ViewportBoundary (générique)', () => {
  it('enfant normal → children rendus, pas de fallback', () => {
    const { getByText, queryByTestId } = render(
      <ViewportBoundary fallback={<StubFallback />}>
        <div>NORMAL_CHILD</div>
      </ViewportBoundary>,
    );
    expect(getByText('NORMAL_CHILD')).toBeDefined();
    expect(queryByTestId('stub-fallback')).toBeNull();
  });

  it('enfant throw → fallback rendu (children ne sont plus montés)', () => {
    const { getByTestId, queryByText } = render(
      <ViewportBoundary fallback={<StubFallback />}>
        <ThrowerOnRender message="boom" />
      </ViewportBoundary>,
    );
    expect(getByTestId('stub-fallback')).toBeDefined();
    expect(queryByText('boom')).toBeNull();
  });

  it('enfant throw → onError invoqué avec (Error, ErrorInfo) incluant componentStack', () => {
    const onError = vi.fn();
    render(
      <ViewportBoundary fallback={<StubFallback />} onError={onError}>
        <ThrowerOnRender message="boom-onError" />
      </ViewportBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const [err, info] = onError.mock.calls[0]!;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('boom-onError');
    expect(info).toBeDefined();
    expect(typeof (info as { componentStack: unknown }).componentStack).toBe('string');
  });

  it('enfant throw sans onError → fallback par défaut console.error', () => {
    // consoleSpy a été installé dans beforeEach. Le boundary appelle
    // console.error('[ViewportBoundary] Caught error:', err, stack).
    // React appelle aussi console.error pour son propre reporting, donc on
    // cherche un appel qui contient la signature spécifique du boundary.
    render(
      <ViewportBoundary fallback={<StubFallback />}>
        <ThrowerOnRender message="boom-default" />
      </ViewportBoundary>,
    );
    const matchingCall = consoleSpy.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('[ViewportBoundary]'),
    );
    expect(matchingCall).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Fallback i18n (ViewportErrorFallback)
// ---------------------------------------------------------------------------

describe('ViewportErrorFallback (i18n)', () => {
  it('rend title, description, hint avec labels fr par défaut', () => {
    const { getByText, getAllByText, getByRole } = render(<ViewportErrorFallback />);
    expect(getByText('Aperçu 3D indisponible')).toBeDefined();
    // description + hint mentionnent tous les deux WebGL → getAllByText
    const webglMatches = getAllByText(/WebGL/);
    expect(webglMatches.length).toBe(2);
    // role="alert" + aria-live="assertive" pour les technos d'assistance
    const alert = getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
  });

  it('switch lang fr → en : labels traduits', () => {
    const { getByText, rerender } = render(<ViewportErrorFallback />);
    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<ViewportErrorFallback />);
    expect(getByText('3D preview unavailable')).toBeDefined();
    expect(getByText(/The 3D preview could not start/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Intégration : NichoirApp avec Viewport qui throw.
// Prouve que (a) fallback visible, (b) Sidebar reste utilisable,
// (c) click sur un onglet NON-default (CALC, pas DIM) mute le store et
// rend le panel correspondant.
// ---------------------------------------------------------------------------

describe('ViewportBoundary × NichoirApp (intégration réelle)', () => {
  it('mount Viewport qui throw → fallback + Sidebar fonctionnelle + click CALC rend CalcTab', async () => {
    // Override le mock global du Viewport : la factory retourne un adapter
    // dont mount() throw. Le boundary doit capturer.
    vi.doMock('../src/viewports/ImperativeThreeViewport.js', () => ({
      ImperativeThreeViewport: vi.fn(() => ({
        mount: vi.fn(() => { throw new Error('WebGL context unavailable'); }),
        update: vi.fn(),
        unmount: vi.fn(),
        readCameraState: vi.fn(),
      })),
    }));

    // Importer NichoirApp APRÈS le doMock pour que le mock soit effectif
    const { NichoirApp } = await import('../src/NichoirApp.js');

    const { getByRole, getByText, getAllByRole, rerender, queryByText } = render(<NichoirApp />);

    // (a) Fallback visible — title i18n
    expect(getByText('Aperçu 3D indisponible')).toBeDefined();
    // role="alert" présent
    expect(getByRole('alert')).toBeDefined();

    // (b) Sidebar toujours rendue : les 6 tabs sont cliquables
    const tabs = getAllByRole('tab');
    expect(tabs).toHaveLength(6);

    // (c) Click CALC (index 3 : dim, vue, deco, calc, plan, export).
    // Codex P2.5.5 finding #2 : on clique un onglet NON-default (pas DIM)
    // pour prouver que l'interaction mute réellement le store.
    act(() => { fireEvent.click(tabs[3]!); });
    rerender(<NichoirApp />);
    expect(useNichoirStore.getState().activeTab).toBe('calc');

    // Le panel CALC est rendu (section CORPS disparaît, ▸ VOLUMES apparaît)
    expect(getByText('▸ VOLUMES')).toBeDefined();
    expect(queryByText('▸ CORPS (BOÎTE)')).toBeNull();

    // Reset doMock pour ne pas polluer les autres fichiers de test
    vi.doUnmock('../src/viewports/ImperativeThreeViewport.js');
    cleanup();
  });
});
