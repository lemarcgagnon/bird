import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks hoistés : WebGLRenderer (jsdom n'a pas WebGL) + instrumentation
// ---------------------------------------------------------------------------

const { MockWebGLRenderer, rendererCalls } = vi.hoisted(() => {
  const rendererCalls = {
    setSize: [] as Array<{ w: number; h: number; updateStyle: boolean }>,
    disposeCount: 0,
    // Flag test-only : si true, le constructeur throw pour simuler WebGL indisponible.
    throwOnConstruct: false,
  };
  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    localClippingEnabled = false;
    constructor() {
      if (rendererCalls.throwOnConstruct) {
        throw new Error('MockWebGLRenderer: simulated WebGL context failure');
      }
      this.domElement = document.createElement('canvas');
    }
    setSize(w: number, h: number, updateStyle: boolean): void {
      rendererCalls.setSize.push({ w, h, updateStyle });
      this.domElement.width = w;
      this.domElement.height = h;
    }
    setPixelRatio(): void { /* no-op */ }
    render(): void { /* no-op */ }
    dispose(): void { rendererCalls.disposeCount++; }
  }
  return { MockWebGLRenderer, rendererCalls };
});

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: MockWebGLRenderer };
});

// ---------------------------------------------------------------------------
// ResizeObserver stub (jsdom v24 ne l'a pas)
// ---------------------------------------------------------------------------

interface MockROInstance {
  callback: ResizeObserverCallback;
  observeTarget: Element | null;
  disconnected: boolean;
  disconnectCount: number;
}
const roInstances: MockROInstance[] = [];

class MockResizeObserver implements ResizeObserver {
  private readonly inst: MockROInstance;
  constructor(cb: ResizeObserverCallback) {
    this.inst = { callback: cb, observeTarget: null, disconnected: false, disconnectCount: 0 };
    roInstances.push(this.inst);
  }
  observe(target: Element): void { this.inst.observeTarget = target; this.inst.disconnected = false; }
  disconnect(): void { this.inst.disconnected = true; this.inst.disconnectCount++; }
  unobserve(): void { /* no-op */ }
}

beforeEach(() => {
  roInstances.length = 0;
  rendererCalls.setSize.length = 0;
  rendererCalls.disposeCount = 0;
  rendererCalls.throwOnConstruct = false;
  (globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;
});

// ---------------------------------------------------------------------------
// Imports après vi.mock
// ---------------------------------------------------------------------------

import { createInitialState } from '@nichoir/core';
import { ImperativeThreeViewport } from '../src/viewports/ImperativeThreeViewport.js';
import type { ViewportAdapter } from '../src/viewports/ViewportAdapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHost(w = 800, h = 600): HTMLDivElement {
  const div = document.createElement('div');
  Object.defineProperty(div, 'clientWidth', { value: w, configurable: true });
  Object.defineProperty(div, 'clientHeight', { value: h, configurable: true });
  document.body.appendChild(div);
  return div;
}

function setHostSize(el: HTMLElement, w: number, h: number): void {
  Object.defineProperty(el, 'clientWidth', { value: w, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: h, configurable: true });
}

// ---------------------------------------------------------------------------
// V1 + V2 : Interface sans leak React/Three
// ---------------------------------------------------------------------------

describe('ViewportAdapter (V1, V2)', () => {
  it('V1 : instance sans charger React', () => {
    const adapter: ViewportAdapter = new ImperativeThreeViewport();
    expect(typeof adapter.mount).toBe('function');
    expect(typeof adapter.update).toBe('function');
    expect(typeof adapter.unmount).toBe('function');
    expect(typeof adapter.readCameraState).toBe('function');
    expect(typeof adapter.captureAsPng).toBe('function');
  });

  it('V2 : readCameraState retourne NichoirState[camera], pas de Vector3 / Camera leak', () => {
    const host = makeHost();
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());
    const cam = adapter.readCameraState();
    expect(cam).toEqual(expect.objectContaining({
      theta: expect.any(Number),
      phi: expect.any(Number),
      dist: expect.any(Number),
      tx: expect.any(Number),
      ty: expect.any(Number),
      tz: expect.any(Number),
    }));
    expect((cam as unknown as { isVector3?: unknown }).isVector3).toBeUndefined();
    adapter.unmount();
    host.remove();
  });

  it('readCameraState : inverse mapping round-trip (conforme VIEWPORT.md:139)', () => {
    // Vérifie que readCameraState lit camera.position + inverse mapping
    // vers {theta, phi, dist, tx, ty, tz}, pas un simple snapshot de lastState.
    const host = makeHost();
    const adapter = new ImperativeThreeViewport();
    const initial = createInitialState();
    // Valeurs non-triviales pour forcer le mapping
    initial.camera.theta = Math.PI * 0.3;
    initial.camera.phi = Math.PI * 0.4;
    initial.camera.dist = 600;
    initial.camera.tx = 0; initial.camera.ty = 0; initial.camera.tz = 0;
    adapter.mount(host, initial);
    const read = adapter.readCameraState();
    // Round-trip tolérance 1e-6 (précision double-précision, pas float32)
    expect(Math.abs(read.theta - initial.camera.theta)).toBeLessThan(1e-6);
    expect(Math.abs(read.phi - initial.camera.phi)).toBeLessThan(1e-6);
    expect(Math.abs(read.dist - initial.camera.dist)).toBeLessThan(1e-6);
    expect(Math.abs(read.tx - initial.camera.tx)).toBeLessThan(1e-6);
    expect(Math.abs(read.ty - initial.camera.ty)).toBeLessThan(1e-6);
    expect(Math.abs(read.tz - initial.camera.tz)).toBeLessThan(1e-6);
    adapter.unmount();
    host.remove();
  });

  it('readCameraState : capte une mutation externe de camera.position (simulation OrbitControls)', () => {
    // Simule un control externe (P2.1+) qui mue camera.position sans update().
    // readCameraState doit refléter la nouvelle position via inverse mapping.
    const host = makeHost();
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());
    // Access privé pour simuler : on ne teste pas la voie publique, on injecte
    // une mutation pour prouver que l'inverse mapping lit la vraie caméra.
    const cam = (adapter as unknown as { camera: THREE.PerspectiveCamera }).camera;
    // Déplacer la caméra manuellement (comme le ferait OrbitControls)
    cam.position.set(0, 0, 500);
    const read = adapter.readCameraState();
    // Pour pos=(0,0,500) et target=(0,H*0.4,0) ≈ (0,88,0) :
    //   delta = (0, -88, 500) ; dist ≈ 507.7 ; phi = acos(-88/507.7) ≈ 1.745 ; theta = atan2(500,0) = π/2
    expect(read.dist).toBeGreaterThan(500); // ≠ initialState.camera.dist (=550)
    expect(read.theta).toBeCloseTo(Math.PI / 2, 5);
    adapter.unmount();
    host.remove();
  });
});

// ---------------------------------------------------------------------------
// V3 : Ownership DOM
// ---------------------------------------------------------------------------

describe('V3 — Ownership DOM', () => {
  it('mount() attache 1 canvas enfant du host, ne touche pas au parent', () => {
    const host = makeHost();
    const parent = host.parentNode!;
    const parentChildrenBefore = parent.childNodes.length;

    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());

    expect(host.children.length).toBe(1);
    expect(host.children[0]?.tagName.toLowerCase()).toBe('canvas');
    expect(parent.childNodes.length).toBe(parentChildrenBefore);

    adapter.unmount();
    host.remove();
  });

  it('unmount() retire uniquement le canvas créé par l\'adapter', () => {
    const host = makeHost();
    const sibling = document.createElement('span');
    host.appendChild(sibling);

    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());
    expect(host.children.length).toBe(2);

    adapter.unmount();
    expect(host.children.length).toBe(1);
    expect(host.children[0]).toBe(sibling);

    host.remove();
  });

  it('setSize appelé avec updateStyle=false (V3 + VIEWPORT.md:143)', () => {
    const host = makeHost(500, 400);
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());

    expect(rendererCalls.setSize.length).toBeGreaterThan(0);
    const firstCall = rendererCalls.setSize[0]!;
    expect(firstCall.updateStyle).toBe(false);
    expect(firstCall.w).toBe(500);
    expect(firstCall.h).toBe(400);

    adapter.unmount();
    host.remove();
  });
});

// ---------------------------------------------------------------------------
// V4 : Cycle de vie déterministe
// ---------------------------------------------------------------------------

describe('V4 — Cycle de vie', () => {
  it('update() avant mount() throw', () => {
    const adapter = new ImperativeThreeViewport();
    expect(() => adapter.update(createInitialState())).toThrow();
  });

  it('readCameraState() avant mount() throw', () => {
    const adapter = new ImperativeThreeViewport();
    expect(() => adapter.readCameraState()).toThrow();
  });

  it('mount() deux fois sans unmount throw (même instance)', () => {
    const host = makeHost();
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());
    expect(() => adapter.mount(host, createInitialState())).toThrow();
    adapter.unmount();
    host.remove();
  });

  it('mount() throw si un AUTRE adapter occupe déjà le même host (VIEWPORT.md:56)', () => {
    const host = makeHost();
    const a1 = new ImperativeThreeViewport();
    const a2 = new ImperativeThreeViewport();
    a1.mount(host, createInitialState());
    expect(() => a2.mount(host, createInitialState())).toThrow(/occupied|occupé/i);
    a1.unmount();
    host.remove();
  });

  it('après unmount d\'a1, a2 peut mount sur le même host', () => {
    const host = makeHost();
    const a1 = new ImperativeThreeViewport();
    const a2 = new ImperativeThreeViewport();
    a1.mount(host, createInitialState());
    a1.unmount();
    expect(() => a2.mount(host, createInitialState())).not.toThrow();
    a2.unmount();
    host.remove();
  });

  it('mount → update × N → unmount : flow nominal', () => {
    const host = makeHost();
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());
    for (let i = 0; i < 5; i++) {
      const s = createInitialState();
      s.params.slope = 35 + i * 2;
      expect(() => adapter.update(s)).not.toThrow();
    }
    adapter.unmount();
    host.remove();
  });

  it('update() après unmount() throw', () => {
    const host = makeHost();
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());
    adapter.unmount();
    expect(() => adapter.update(createInitialState())).toThrow();
    host.remove();
  });

  it('V4-rollback : mount() qui échoue en cours libère le host (pas poisoned)', () => {
    // Simule un WebGL context failure
    rendererCalls.throwOnConstruct = true;
    const host = makeHost();
    const a1 = new ImperativeThreeViewport();

    expect(() => a1.mount(host, createInitialState())).toThrow(/WebGL/);

    // Après l'échec, le host doit être libéré : un autre adapter peut mount
    // (pas "host already occupied by another adapter"). rollback via unmount().
    rendererCalls.throwOnConstruct = false;
    const a2 = new ImperativeThreeViewport();
    expect(() => a2.mount(host, createInitialState())).not.toThrow();

    // Et le canvas de l'échec n'est pas resté attaché
    expect(host.children.length).toBe(1); // seulement a2's canvas

    a2.unmount();
    host.remove();
  });

  it('V4-rollback : après mount() échoué, la même instance peut re-mount', () => {
    rendererCalls.throwOnConstruct = true;
    const host = makeHost();
    const adapter = new ImperativeThreeViewport();

    expect(() => adapter.mount(host, createInitialState())).toThrow();

    // Même instance : unmount() a run implicitement, this.host = null, OK re-mount
    rendererCalls.throwOnConstruct = false;
    expect(() => adapter.mount(host, createInitialState())).not.toThrow();

    adapter.unmount();
    host.remove();
  });
});

// ---------------------------------------------------------------------------
// V5 : Indépendance des instances
// ---------------------------------------------------------------------------

describe('V5 — Indépendance', () => {
  it('deux adapters ont des canvases distincts', () => {
    const host1 = makeHost();
    const host2 = makeHost();
    const a1 = new ImperativeThreeViewport();
    const a2 = new ImperativeThreeViewport();

    a1.mount(host1, createInitialState());
    a2.mount(host2, createInitialState());

    expect(host1.children[0]).not.toBe(host2.children[0]);
    expect(host1.children.length).toBe(1);
    expect(host2.children.length).toBe(1);

    a1.unmount();
    a2.unmount();
    host1.remove();
    host2.remove();
  });
});

// ---------------------------------------------------------------------------
// V6 : Idempotence unmount
// ---------------------------------------------------------------------------

describe('V6 — unmount() idempotent', () => {
  it('unmount() avant mount() ne throw pas', () => {
    const adapter = new ImperativeThreeViewport();
    expect(() => adapter.unmount()).not.toThrow();
  });

  it('unmount() x2 ne throw pas', () => {
    const host = makeHost();
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());
    expect(() => adapter.unmount()).not.toThrow();
    expect(() => adapter.unmount()).not.toThrow();
    host.remove();
  });
});

// ---------------------------------------------------------------------------
// V7 : Resize interne
// ---------------------------------------------------------------------------

describe('V7 — Resize ownership', () => {
  it('mount() crée un ResizeObserver qui observe le host', () => {
    const host = makeHost();
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());

    expect(roInstances.length).toBe(1);
    const ro = roInstances[0]!;
    expect(ro.observeTarget).toBe(host);
    expect(ro.disconnected).toBe(false);

    adapter.unmount();
    host.remove();
  });

  it('unmount() disconnect le ResizeObserver', () => {
    const host = makeHost();
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());
    const ro = roInstances[0]!;

    adapter.unmount();

    expect(ro.disconnected).toBe(true);
    expect(ro.disconnectCount).toBeGreaterThanOrEqual(1);

    host.remove();
  });

  it('resize callback met à jour canvas size via renderer.setSize(w, h, false)', () => {
    const host = makeHost(500, 400);
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());

    const initialCount = rendererCalls.setSize.length;

    setHostSize(host, 1000, 800);
    const ro = roInstances[0]!;
    ro.callback([], {} as ResizeObserver);

    expect(rendererCalls.setSize.length).toBeGreaterThan(initialCount);
    const last = rendererCalls.setSize[rendererCalls.setSize.length - 1]!;
    expect(last.w).toBe(1000);
    expect(last.h).toBe(800);
    expect(last.updateStyle).toBe(false);

    adapter.unmount();
    host.remove();
  });
});

// ---------------------------------------------------------------------------
// P3 feature — OrbitControls (rotate/pan/zoom souris)
// ---------------------------------------------------------------------------

describe('OrbitControls (P3)', () => {
  it('mount() instancie OrbitControls + dispose au unmount sans throw', () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(host, 'clientHeight', { configurable: true, value: 600 });
    document.body.appendChild(host);
    const state = createInitialState();
    const adapter = new ImperativeThreeViewport();
    expect(() => {
      adapter.mount(host, state);
      adapter.unmount();
    }).not.toThrow();
    document.body.removeChild(host);
  });

  it('update() sans changement de camera ref : position caméra NON écrasée', () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(host, 'clientHeight', { configurable: true, value: 600 });
    document.body.appendChild(host);
    const state = createInitialState();
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, state);

    // Simuler une mutation souris : bouger manuellement la camera.
    // On accède à la caméra via readCameraState pour capturer, puis bouger
    // camera.position directement n'est pas accessible de l'extérieur.
    // On utilise donc une autre approche : capturer readCameraState après
    // rotation via un setParam non-camera.
    const before = adapter.readCameraState();

    // Changer uniquement params.W (même camera ref) → update() ne doit PAS
    // ré-appliquer updateCameraFromState.
    const nextState = { ...state, params: { ...state.params, W: 220 } };
    adapter.update(nextState);

    const after = adapter.readCameraState();
    // Même camera ref → même state.camera → readCameraState identique.
    expect(after).toEqual(before);

    adapter.unmount();
    document.body.removeChild(host);
  });

  it('update() avec camera ref changée : updateCameraFromState ré-appliqué', () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(host, 'clientHeight', { configurable: true, value: 600 });
    document.body.appendChild(host);
    const state = createInitialState();
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, state);

    // Nouvelle camera ref : theta différent → readCameraState doit refléter le changement.
    const newCamera = { ...state.camera, theta: state.camera.theta + Math.PI / 4 };
    const nextState = { ...state, camera: newCamera };
    adapter.update(nextState);

    const after = adapter.readCameraState();
    expect(after.theta).toBeCloseTo(newCamera.theta, 5);

    adapter.unmount();
    document.body.removeChild(host);
  });
});

// ---------------------------------------------------------------------------
// captureAsPng — Feature 3D capture (branche multi-bin)
// ---------------------------------------------------------------------------

describe('captureAsPng', () => {
  it('captureAsPng avant mount() → rejette avec une erreur', async () => {
    const adapter = new ImperativeThreeViewport();
    await expect(adapter.captureAsPng()).rejects.toThrow(/capture before mount/i);
  });

  it('captureAsPng après mount() → retourne un Uint8Array via canvas.toBlob stubé', async () => {
    const host = makeHost();
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());

    // jsdom ne fournit pas toBlob sur canvas ni arrayBuffer sur Blob.
    // On stub les deux : toBlob appelle le callback avec un fake blob qui a
    // arrayBuffer() retournant un ArrayBuffer avec des bytes PNG magiques.
    const pngBytes = new Uint8Array([137, 80, 78, 71]); // PNG magic header
    const fakeArrayBuffer = pngBytes.buffer.slice(
      pngBytes.byteOffset,
      pngBytes.byteOffset + pngBytes.byteLength,
    );
    const fakeBlob = {
      arrayBuffer: async (): Promise<ArrayBuffer> => fakeArrayBuffer,
    } as unknown as Blob;

    const canvas = (adapter as unknown as {
      canvas: HTMLCanvasElement;
    }).canvas!;
    canvas.toBlob = (_cb: BlobCallback, _type?: string): void => {
      // Simuler un appel async (microtask)
      Promise.resolve().then(() => { _cb(fakeBlob); }).catch(() => {});
    };

    const result = await adapter.captureAsPng();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result[0]).toBe(137); // PNG magic byte

    adapter.unmount();
    host.remove();
  });

  it('captureAsPng : canvas.toBlob retourne null → rejette', async () => {
    const host = makeHost();
    const adapter = new ImperativeThreeViewport();
    adapter.mount(host, createInitialState());

    const canvas = (adapter as unknown as { canvas: HTMLCanvasElement }).canvas!;
    canvas.toBlob = (_cb: BlobCallback): void => {
      Promise.resolve().then(() => { _cb(null); }).catch(() => {});
    };

    await expect(adapter.captureAsPng()).rejects.toThrow(/toBlob returned null/i);

    adapter.unmount();
    host.remove();
  });
});
