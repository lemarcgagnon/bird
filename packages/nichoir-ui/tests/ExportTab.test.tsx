import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import JSZip from 'jszip';
import type { DownloadService } from '@nichoir/adapters';

// Mock ImperativeThreeViewport (uniformément avec les autres tests NichoirApp)
const { mockCtor } = vi.hoisted(() => {
  const mockCtor = vi.fn(() => ({
    mount: vi.fn(), update: vi.fn(), unmount: vi.fn(), readCameraState: vi.fn(),
  }));
  return { mockCtor };
});
vi.mock('../src/viewports/ImperativeThreeViewport.js', () => ({
  ImperativeThreeViewport: mockCtor,
}));

import { useRef } from 'react';
import { ExportTab } from '../src/components/tabs/ExportTab.js';
import { DownloadServiceProvider } from '../src/adapters/DownloadServiceContext.js';
import { ViewportRefProvider } from '../src/viewports/ViewportRefContext.js';
import { useNichoirStore } from '../src/store.js';
import {
  createInitialState,
  buildPanelDefs,
  generateHouseSTL,
  generateDoorSTL,
  generatePlanSVG,
  computeCutLayout,
} from '@nichoir/core';
import type { ViewportAdapter } from '../src/viewports/ViewportAdapter.js';

// Stub DownloadService qui capture tous les triggers. Le type laxiste évite
// un désalignement entre Mock<[], Promise<void>> et la signature publique.
function makeSpyService(): { service: DownloadService; trigger: ReturnType<typeof vi.fn> } {
  const trigger = vi.fn();
  trigger.mockImplementation(async () => {});
  const service: DownloadService = {
    trigger: (...args): Promise<void> => trigger(...args) as Promise<void>,
  };
  return { service, trigger };
}

function renderWithService(
  ui: React.ReactElement,
  service: DownloadService,
  viewportAdapter: ViewportAdapter | null = null,
): ReturnType<typeof render> {
  // ViewportRefProvider wrapper nécessaire car ExportPng3dSection appelle useViewportRef().
  // On crée le ref statiquement ici — React hooks ne peuvent pas être appelés ici,
  // donc on utilise un composant intermédiaire.
  function Wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    const ref = useRef<ViewportAdapter | null>(viewportAdapter);
    return (
      <ViewportRefProvider viewportRef={ref}>
        <DownloadServiceProvider service={service}>
          {children}
        </DownloadServiceProvider>
      </ViewportRefProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}

beforeEach(() => {
  cleanup();
  mockCtor.mockClear();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('ExportTab (unit)', () => {
  it('rend les 3 sections labels i18n fr par défaut', () => {
    const { service } = makeSpyService();
    const { getByText } = renderWithService(<ExportTab />, service);
    expect(getByText('▸ EXPORT STL (IMPRESSION 3D)')).toBeDefined();
    expect(getByText('▸ EXPORT PLAN DE COUPE')).toBeDefined();
    expect(getByText('▸ EXPORT CAPTURE 3D')).toBeDefined();
  });

  it('5 boutons rendus : maison, porte, zip, plan svg, capture 3D', () => {
    const { service } = makeSpyService();
    const { getByText } = renderWithService(<ExportTab />, service);
    expect(getByText('⬇ Maison complète (.stl)')).toBeDefined();
    expect(getByText('⬇ Porte seule (.stl)')).toBeDefined();
    expect(getByText('⬇ Panneaux séparés (.zip)')).toBeDefined();
    expect(getByText('⬇ Plan de coupe (.zip, 1 SVG par panneau)')).toBeDefined();
    expect(getByText('⬇ Capture 3D (.png)')).toBeDefined();
  });

  it('bouton "Porte seule" disabled par défaut (door=none)', () => {
    const { service } = makeSpyService();
    const { getByText } = renderWithService(<ExportTab />, service);
    const btn = getByText('⬇ Porte seule (.stl)').closest('button')!;
    expect(btn.disabled).toBe(true);
  });

  it('door=round + doorPanel=true → bouton Porte activé', () => {
    act(() => {
      useNichoirStore.getState().setParam('door', 'round');
      useNichoirStore.getState().setParam('doorPanel', true);
    });
    const { service } = makeSpyService();
    const { getByText } = renderWithService(<ExportTab />, service);
    const btn = getByText('⬇ Porte seule (.stl)').closest('button')!;
    expect(btn.disabled).toBe(false);
  });

  it('door=round + doorPanel=false → bouton Porte TOUJOURS disabled', () => {
    act(() => {
      useNichoirStore.getState().setParam('door', 'round');
      useNichoirStore.getState().setParam('doorPanel', false);
    });
    const { service } = makeSpyService();
    const { getByText } = renderWithService(<ExportTab />, service);
    const btn = getByText('⬇ Porte seule (.stl)').closest('button')!;
    expect(btn.disabled).toBe(true);
  });

  it('3 items de hint rendus sous les boutons STL', () => {
    const { service } = makeSpyService();
    const { getByText } = renderWithService(<ExportTab />, service);
    expect(getByText('Maison = tous panneaux fusionnés (B1).')).toBeDefined();
    expect(getByText('ZIP = 1 fichier STL par panneau (A).')).toBeDefined();
    expect(getByText('Dimensions en mm. Watertight par panneau.')).toBeDefined();
  });

  it('switch lang fr → en : labels traduits', () => {
    const { service } = makeSpyService();
    const { getByText } = renderWithService(<ExportTab />, service);
    act(() => { useNichoirStore.getState().setLang('en'); });
    expect(getByText('▸ STL EXPORT (3D PRINTING)')).toBeDefined();
    expect(getByText('⬇ Complete house (.stl)')).toBeDefined();
    expect(getByText('⬇ Cut plan (.zip, 1 SVG per sheet)')).toBeDefined();
    expect(getByText('▸ 3D CAPTURE EXPORT')).toBeDefined();
    expect(getByText('⬇ 3D capture (.png)')).toBeDefined();
  });
});

describe('ExportTab (intégration matérielle : trigger avec contenu vérifié)', () => {
  it('click "Maison complète" → trigger STL avec bytes byte-à-byte identiques au core + header valide', async () => {
    const { service, trigger } = makeSpyService();
    const { getByText } = renderWithService(<ExportTab />, service);

    await act(async () => { fireEvent.click(getByText('⬇ Maison complète (.stl)').closest('button')!); });
    await waitFor(() => { expect(trigger).toHaveBeenCalled(); });

    const [bytes, filename, mime] = trigger.mock.calls[0]!;
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(filename).toBe('nichoir_maison.stl');
    expect(mime).toBe('application/octet-stream');

    // Matérialité : byte-à-byte vs appel direct du core. Déterministe car
    // geometryTriangles (stl.ts:50-86) n'utilise pas de random, et le state
    // initial est stable (garde-fou codex P2.6 correction finding #2).
    const state = useNichoirStore.getState();
    const expected = generateHouseSTL(buildPanelDefs(state));
    expect(expected).not.toBeNull();
    expect(bytes as Uint8Array).toEqual(expected!);

    // Parsing header STL binaire (stl.ts:93-109) :
    //   - bytes 0..79 : label ASCII "Nichoir - <label>"
    //   - bytes 80..83 : uint32 little-endian triangleCount
    //   - bytes 84..  : 50 bytes par triangle (n, a, b, c + uint16 attribute)
    const stlBytes = bytes as Uint8Array;
    const dv = new DataView(stlBytes.buffer, stlBytes.byteOffset, stlBytes.byteLength);
    const headerLabel = new TextDecoder('ascii').decode(stlBytes.slice(0, 25));
    expect(headerLabel.startsWith('Nichoir - maison_complete')).toBe(true);
    const triangleCount = dv.getUint32(80, true);
    expect(triangleCount).toBeGreaterThan(0);
    expect((stlBytes.byteLength - 84) / 50).toBe(triangleCount);
  });

  it('click "Porte seule" (door activée) → trigger STL byte-à-byte identique au core + header "porte"', async () => {
    act(() => {
      useNichoirStore.getState().setParam('door', 'round');
      useNichoirStore.getState().setParam('doorPanel', true);
    });
    const { service, trigger } = makeSpyService();
    const { getByText } = renderWithService(<ExportTab />, service);

    await act(async () => { fireEvent.click(getByText('⬇ Porte seule (.stl)').closest('button')!); });
    await waitFor(() => { expect(trigger).toHaveBeenCalled(); });

    const [bytes, filename] = trigger.mock.calls[0]!;
    expect(filename).toBe('nichoir_porte.stl');

    const state = useNichoirStore.getState();
    const expected = generateDoorSTL(buildPanelDefs(state));
    expect(expected).not.toBeNull();
    expect(bytes as Uint8Array).toEqual(expected!);

    const stlBytes = bytes as Uint8Array;
    const dv = new DataView(stlBytes.buffer, stlBytes.byteOffset, stlBytes.byteLength);
    const headerLabel = new TextDecoder('ascii').decode(stlBytes.slice(0, 15));
    expect(headerLabel.startsWith('Nichoir - porte')).toBe(true);
    const triangleCount = dv.getUint32(80, true);
    expect(triangleCount).toBeGreaterThan(0);
    expect((stlBytes.byteLength - 84) / 50).toBe(triangleCount);
  });

  it('click "Panneaux séparés" → ZIP avec 7 entries panel.*.stl (state initial), chaque STL valide', async () => {
    const { service, trigger } = makeSpyService();
    const { getByText } = renderWithService(<ExportTab />, service);

    await act(async () => { fireEvent.click(getByText('⬇ Panneaux séparés (.zip)').closest('button')!); });
    await waitFor(() => { expect(trigger).toHaveBeenCalled(); }, { timeout: 3000 });

    const [bytes, filename, mime] = trigger.mock.calls[0]!;
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(filename).toBe('nichoir_panneaux.zip');
    expect(mime).toBe('application/zip');

    // Re-inspection via JSZip plutôt que byte-à-byte : JSZip écrit la date
    // courante dans les entries, le binaire n'est donc pas déterministe
    // (codex P2.6 correction finding #2).
    //
    // NOTE d'alignement réalité UI : messages.ts n'a PAS de clés panel.*
    // (grep zéro match), donc useT() fallback sur la clé brute (useT.ts:19).
    // Les filenames sortent "panel.<key>.stl", pas "facade_avant.stl".
    // Ajouter des traductions panel.* serait un scope séparé (codex).
    const zip = await JSZip.loadAsync(bytes as Uint8Array);
    const entries = Object.keys(zip.files).sort();
    // State initial : perch=false (state.ts:51) → pas d'entry panel.perch.stl.
    // door=none → pas d'entry panel.doorPanel.stl (testée séparément ci-dessous).
    expect(entries).toEqual([
      'panel.back.stl',
      'panel.bottom.stl',
      'panel.front.stl',
      'panel.left.stl',
      'panel.right.stl',
      'panel.roofL.stl',
      'panel.roofR.stl',
    ]);

    // Chaque entry est un STL valide : header label "Nichoir - <key>",
    // triangleCount > 0, taille cohérente.
    for (const name of entries) {
      const entryBytes = await zip.files[name]!.async('uint8array');
      expect(entryBytes.byteLength).toBeGreaterThan(84);
      const dv = new DataView(entryBytes.buffer, entryBytes.byteOffset, entryBytes.byteLength);
      const triangleCount = dv.getUint32(80, true);
      expect(triangleCount).toBeGreaterThan(0);
      expect((entryBytes.byteLength - 84) / 50).toBe(triangleCount);
    }
  });

  it('ZIP avec door=round + doorPanel=true → entry panel.doorPanel.stl incluse en plus', async () => {
    act(() => {
      useNichoirStore.getState().setParam('door', 'round');
      useNichoirStore.getState().setParam('doorPanel', true);
    });
    const { service, trigger } = makeSpyService();
    const { getByText } = renderWithService(<ExportTab />, service);

    await act(async () => { fireEvent.click(getByText('⬇ Panneaux séparés (.zip)').closest('button')!); });
    await waitFor(() => { expect(trigger).toHaveBeenCalled(); }, { timeout: 3000 });

    const [bytes] = trigger.mock.calls[0]!;
    const zip = await JSZip.loadAsync(bytes as Uint8Array);
    const entries = Object.keys(zip.files);
    expect(entries).toContain('panel.doorPanel.stl');

    const doorBytes = await zip.files['panel.doorPanel.stl']!.async('uint8array');
    const dv = new DataView(doorBytes.buffer, doorBytes.byteOffset, doorBytes.byteLength);
    const triangleCount = dv.getUint32(80, true);
    expect(triangleCount).toBeGreaterThan(0);
  });

  it('click "Plan de coupe ZIP" → trigger(Uint8Array ZIP, "nichoir_plan_1220x2440.zip", "application/zip")', async () => {
    const { service, trigger } = makeSpyService();
    const { getByText } = renderWithService(<ExportTab />, service);

    await act(async () => { fireEvent.click(getByText('⬇ Plan de coupe (.zip, 1 SVG par panneau)').closest('button')!); });
    await waitFor(() => { expect(trigger).toHaveBeenCalled(); });

    const [bytes, filename, mime] = trigger.mock.calls[0]!;
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(filename).toBe('nichoir_plan_1220x2440.zip');
    expect(mime).toBe('application/zip');

    // Matérialité : le ZIP contient au moins 1 entry SVG valide (panel-1.svg)
    // pour le state initial (1 panneau).
    const zip = await JSZip.loadAsync(bytes as Uint8Array);
    const entries = Object.keys(zip.files);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const firstEntry = entries[0]!;
    const svgContent = await zip.files[firstEntry]!.async('string');
    expect(svgContent.startsWith('<?xml')).toBe(true);
    expect(svgContent).toContain('<svg');

    // Matérialité unitaire : premier SVG == generatePlanSVG(layout.panels[0], t)
    const state = useNichoirStore.getState();
    const tFake = (k: string): string => {
      const fr: Record<string, string> = {
        'calc.cuts.facade': 'Façade', 'calc.cuts.side': 'Côté', 'calc.cuts.bottom': 'Plancher',
        'calc.cuts.roof': 'Toit', 'calc.cuts.roofL': 'Toit G', 'calc.cuts.roofR': 'Toit D',
        'calc.cuts.door': 'Porte', 'plan.rotated': '(tourné 90°)',
      };
      return fr[k] ?? k;
    };
    const layout = computeCutLayout(state.params);
    const expected = generatePlanSVG(layout.panels[0]!, tFake);
    expect(svgContent).toBe(expected);
  });

  it('filename ZIP suit panelW × panelH du store (custom panel 610×1220)', async () => {
    act(() => {
      useNichoirStore.getState().setParam('panelW', 610);
      useNichoirStore.getState().setParam('panelH', 1220);
    });
    const { service, trigger } = makeSpyService();
    const { getByText } = renderWithService(<ExportTab />, service);

    await act(async () => { fireEvent.click(getByText('⬇ Plan de coupe (.zip, 1 SVG par panneau)').closest('button')!); });
    await waitFor(() => { expect(trigger).toHaveBeenCalled(); });
    const [, filename] = trigger.mock.calls[0]!;
    expect(filename).toBe('nichoir_plan_610x1220.zip');
  });

  it('pendant export en cours : aria-busy="true" + label busy affiché', async () => {
    // Service qui retarde le resolve pour laisser le temps d'observer busy
    let resolveTrigger: () => void = () => {};
    const trigger = vi.fn(async () => {
      await new Promise<void>((resolve) => { resolveTrigger = resolve; });
    });
    const service: DownloadService = { trigger };
    const { getByText, queryByText } = renderWithService(<ExportTab />, service);

    const btn = getByText('⬇ Maison complète (.stl)').closest('button')!;
    act(() => { fireEvent.click(btn); });

    // Attendre le re-render avec busy=true
    await waitFor(() => {
      expect(btn.getAttribute('aria-busy')).toBe('true');
    });
    expect(queryByText('Export maison…')).not.toBeNull();

    // Resolve pour cleanup propre
    await act(async () => { resolveTrigger(); });
    await waitFor(() => { expect(btn.getAttribute('aria-busy')).toBe('false'); });
  });
});

describe('ExportTab (erreur runtime → inline role="alert")', () => {
  // Validation directe du contrat "erreur runtime affichée inline"
  // (codex P2.6 correction finding #1). Un seul test suffit : les 3 handlers
  // STL partagent le même try/catch, pas de logique divergente.
  it('download.trigger reject → <p role="alert"> affiche t("export.error.generic", {message})', async () => {
    const trigger = vi.fn(async () => { throw new Error('boom'); });
    const service: DownloadService = { trigger };
    const { getByText, findByRole } = renderWithService(<ExportTab />, service);

    await act(async () => {
      fireEvent.click(getByText('⬇ Maison complète (.stl)').closest('button')!);
    });

    const alert = await findByRole('alert');
    // fr default : 'Erreur export : {message}' → 'Erreur export : boom'
    expect(alert.textContent).toBe('Erreur export : boom');
  });
});
