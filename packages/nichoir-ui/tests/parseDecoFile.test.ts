// tests/parseDecoFile.test.ts
//
// Tests du helper `parseDecoFile` (P2.7b). Stratégie :
//   - jsdom ne supporte ni `getPointAtLength` (SVG layout) ni un vrai
//     `canvas.getContext('2d')`. Tenter un vrai parse SVG avec shapes ou
//     une vraie rasterisation throw dès la première ligne.
//   - On teste donc :
//       (a) la validation d'extension (sans DOM, triviale)
//       (b) la structure du result sur les branches SVG / image via mocks
//           ciblés sur `Image` + `canvas.getContext('2d')`
//       (c) les erreurs de chargement (img.onerror)
//       (d) les variants de résolution (heightmapData.length === target²×4)
//   - L'extraction SVG avec vraies shapes nécessite un navigateur réel.
//     Validation en passe navigateur (passe codex) — les tests unit ici
//     valident uniquement que le code n'explose pas et retourne une
//     structure cohérente face aux limitations jsdom.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDecoFile, resampleHeightmapFromSource, RASTER_SOURCE_SIZE } from '../src/utils/parseDecoFile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mock Image qui trigger onload immédiatement après set src. Les dimensions
// naturelles sont contrôlables via `MockImage.nextWidth` / `nextHeight` (reset
// dans beforeEach) pour tester le letterboxing v15 avec différents ratios.
class MockImage {
  static nextWidth = RASTER_SOURCE_SIZE;
  static nextHeight = RASTER_SOURCE_SIZE;
  crossOrigin = '';
  width = MockImage.nextWidth;
  height = MockImage.nextHeight;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  get src(): string { return this._src; }
  set src(v: string) {
    this._src = v;
    queueMicrotask(() => { this.onload?.(); });
  }
}

// Mock Image qui trigger onerror.
class ErrorImage {
  crossOrigin = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  get src(): string { return this._src; }
  set src(v: string) {
    this._src = v;
    queueMicrotask(() => { this.onerror?.(); });
  }
}

// Installe un mock de `getContext('2d')` sur HTMLCanvasElement.prototype.
// `getImageData` retourne une Uint8ClampedArray remplie avec une valeur
// déterministe — suffisant pour valider la structure du résultat.
// Retourne le mock ctx pour que les tests puissent inspecter drawImage args.
function installCanvasMock(fillByte = 128): {
  drawImageMock: ReturnType<typeof vi.fn>;
  fillRectMock: ReturnType<typeof vi.fn>;
} {
  const drawImageMock = vi.fn();
  const fillRectMock = vi.fn();
  const ctx = {
    fillStyle: '',
    fillRect: fillRectMock,
    drawImage: drawImageMock,
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4).fill(fillByte),
      width: w,
      height: h,
      colorSpace: 'srgb' as PredefinedColorSpace,
    })),
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(
    (type: string) => type === '2d' ? (ctx as unknown as CanvasRenderingContext2D) : null,
  ) as HTMLCanvasElement['getContext'];
  return { drawImageMock, fillRectMock };
}

beforeEach(() => {
  // Reset dims par défaut (carré) avant chaque test. Tests letterbox
  // overrideront ces valeurs dans leur body.
  MockImage.nextWidth = RASTER_SOURCE_SIZE;
  MockImage.nextHeight = RASTER_SOURCE_SIZE;
  vi.stubGlobal('Image', MockImage);
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:fake'),
    revokeObjectURL: vi.fn(),
  });
});

// ---------------------------------------------------------------------------
// 1. Validation d'extension — ne dépend pas du DOM, trivial
// ---------------------------------------------------------------------------

describe('parseDecoFile — extension validation', () => {
  it('extension .txt → throws "Unsupported file extension"', async () => {
    const file = new File(['not an image'], 'invalid.txt', { type: 'text/plain' });
    await expect(parseDecoFile(file, 64)).rejects.toThrow(/Unsupported file extension/);
  });

  it.each(['test.exe', 'test.pdf', 'test.webp', 'test.gif', 'test.bmp'])(
    'extension %s → throws (seules svg|png|jpg|jpeg acceptées)',
    async (name) => {
      const file = new File([''], name);
      await expect(parseDecoFile(file, 64)).rejects.toThrow(/Unsupported file extension/);
    },
  );

  it.each(['.svg', '.png', '.jpg', '.jpeg', '.SVG', '.PNG'])(
    'extension %s → passe la validation (ne throw pas dessus)',
    async (ext) => {
      installCanvasMock();
      const file = new File(['<svg/>'], `sample${ext}`);
      // Le throw n'est pas sur l'extension — peut throw ailleurs (mock simplifié),
      // mais le message ne doit JAMAIS contenir "Unsupported file extension".
      try {
        await parseDecoFile(file, 64);
      } catch (err) {
        expect((err as Error).message).not.toMatch(/Unsupported file extension/);
      }
    },
  );
});

// ---------------------------------------------------------------------------
// 2. SVG branches — via fixtures locales + mocks canvas
// ---------------------------------------------------------------------------

describe('parseDecoFile — SVG branches (fixtures + jsdom)', () => {
  it('no-shapes.svg → sourceType="svg", parsedShapes=null, mode="heightmap", warning noShapes', async () => {
    installCanvasMock();
    const svgText = readFileSync(join(__dirname, 'fixtures/deco/no-shapes.svg'), 'utf8');
    const file = new File([svgText], 'no-shapes.svg', { type: 'image/svg+xml' });

    const result = await parseDecoFile(file, 64);
    expect(result.sourceType).toBe('svg');
    expect(result.parsedShapes).toBeNull();
    expect(result.mode).toBe('heightmap');
    expect(result.lastParseWarning).toEqual({ key: 'deco.svg.noShapes' });
    expect(result.heightmapResolution).toBe(64);
    expect(result.heightmapData.length).toBe(64 * 64 * 4);
    expect(result.source).toBe(svgText);
  });

  it('valid.svg en jsdom : getTotalLength indispo → fallback heightmap', async () => {
    // En jsdom, getTotalLength throws NotImplemented → parseSvgShapes skipe
    // tous les éléments et retourne warning='noShapes'. Ce test valide la
    // robustesse face à l'absence de SVG layout, pas l'extraction réelle
    // (qui requiert un vrai browser — validation passe navigateur).
    installCanvasMock();
    const svgText = readFileSync(join(__dirname, 'fixtures/deco/valid.svg'), 'utf8');
    const file = new File([svgText], 'valid.svg', { type: 'image/svg+xml' });

    const result = await parseDecoFile(file, 64);
    expect(result.sourceType).toBe('svg');
    expect(result.mode).toBe('heightmap'); // fallback car shapes null en jsdom
    expect(result.heightmapData.length).toBe(64 * 64 * 4);
  });
});

// ---------------------------------------------------------------------------
// 3. Image branches — PNG / JPG via File bytes + mocks
// ---------------------------------------------------------------------------

describe('parseDecoFile — image branches (PNG/JPG)', () => {
  it('sample.png bytes → sourceType="image", parsedShapes=null, mode="heightmap", no warning', async () => {
    installCanvasMock();
    const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const file = new File([bytes], 'sample.png', { type: 'image/png' });

    const result = await parseDecoFile(file, 64);
    expect(result.sourceType).toBe('image');
    expect(result.parsedShapes).toBeNull();
    expect(result.bbox).toBeNull();
    expect(result.mode).toBe('heightmap');
    expect(result.lastParseWarning).toBeNull();
    expect(result.heightmapResolution).toBe(64);
    expect(result.heightmapData.length).toBe(64 * 64 * 4);
    expect(result.source).toMatch(/^data:image\/png/); // dataURL base64
  });

  it('sample.jpg → sourceType="image"', async () => {
    installCanvasMock();
    const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
    const file = new File([bytes], 'sample.jpg', { type: 'image/jpeg' });

    const result = await parseDecoFile(file, 64);
    expect(result.sourceType).toBe('image');
    expect(result.mode).toBe('heightmap');
    expect(result.source).toMatch(/^data:image\/jpeg/);
  });
});

// ---------------------------------------------------------------------------
// 4. Error paths — img.onerror
// ---------------------------------------------------------------------------

describe('parseDecoFile — error paths', () => {
  it('img.onerror pendant rasterisation → rejects', async () => {
    installCanvasMock();
    vi.stubGlobal('Image', ErrorImage);
    const file = new File(['<svg/>'], 'corrupted.svg', { type: 'image/svg+xml' });
    await expect(parseDecoFile(file, 64)).rejects.toThrow(/Image load failed/);
  });

  it('canvas.getContext null → rejects "Canvas 2D context unavailable"', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as HTMLCanvasElement['getContext'];
    const file = new File([new Uint8Array([0xFF])], 'test.png', { type: 'image/png' });
    await expect(parseDecoFile(file, 64)).rejects.toThrow(/Canvas 2D context unavailable/);
  });
});

// ---------------------------------------------------------------------------
// 5. Resolution variants — heightmapData.length respecte toujours target²×4
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 6. Letterboxing — port fidèle v15 (src/geometry/deco.js:84-89)
//    Validation matérielle des coordonnées drawImage pour image non carrée
//    (correction du finding codex P2.7b : aspect ratio devait être conservé).
// ---------------------------------------------------------------------------

describe('parseDecoFile — letterboxing (aspect ratio preservé)', () => {
  // Le premier appel à ctx.drawImage dans le flow est dans rasterizeSource
  // et dessine l'image source sur le canvas intermédiaire 256×256. Les args
  // attendus sont [img, dx, dy, dw, dh] selon la logique v15 :
  //   ar = imgW / imgH
  //   landscape (ar > 1) : dw=size, dh=size/ar,  dx=0,             dy=(size-dh)/2
  //   portrait  (ar < 1) : dw=size*ar, dh=size,  dx=(size-dw)/2,   dy=0
  //   carré     (ar = 1) : dw=size, dh=size,     dx=0,             dy=0

  it('landscape (200×100, ar=2) : dw=256, dh=128, dx=0, dy=64 — centré verticalement', async () => {
    MockImage.nextWidth = 200;
    MockImage.nextHeight = 100;
    const { drawImageMock } = installCanvasMock();
    const file = new File([new Uint8Array([0x89, 0x50])], 'landscape.png', { type: 'image/png' });

    await parseDecoFile(file, 64);

    // Le 1er appel drawImage est dans rasterizeSource sur le canvas 256.
    const firstCall = drawImageMock.mock.calls[0]!;
    const [, dx, dy, dw, dh] = firstCall as [unknown, number, number, number, number];
    expect(dw).toBe(RASTER_SOURCE_SIZE);               // 256
    expect(dh).toBe(RASTER_SOURCE_SIZE / 2);           // 128
    expect(dx).toBe(0);
    expect(dy).toBe((RASTER_SOURCE_SIZE - 128) / 2);   // 64
  });

  it('portrait (100×200, ar=0.5) : dw=128, dh=256, dx=64, dy=0 — centré horizontalement', async () => {
    MockImage.nextWidth = 100;
    MockImage.nextHeight = 200;
    const { drawImageMock } = installCanvasMock();
    const file = new File([new Uint8Array([0x89, 0x50])], 'portrait.png', { type: 'image/png' });

    await parseDecoFile(file, 64);

    const firstCall = drawImageMock.mock.calls[0]!;
    const [, dx, dy, dw, dh] = firstCall as [unknown, number, number, number, number];
    expect(dw).toBe(RASTER_SOURCE_SIZE / 2);           // 128
    expect(dh).toBe(RASTER_SOURCE_SIZE);               // 256
    expect(dx).toBe((RASTER_SOURCE_SIZE - 128) / 2);   // 64
    expect(dy).toBe(0);
  });

  it('carré (200×200, ar=1) : dw=dh=256, dx=dy=0 — pas de letterbox', async () => {
    MockImage.nextWidth = 200;
    MockImage.nextHeight = 200;
    const { drawImageMock } = installCanvasMock();
    const file = new File([new Uint8Array([0x89, 0x50])], 'square.png', { type: 'image/png' });

    await parseDecoFile(file, 64);

    const firstCall = drawImageMock.mock.calls[0]!;
    const [, dx, dy, dw, dh] = firstCall as [unknown, number, number, number, number];
    expect(dw).toBe(RASTER_SOURCE_SIZE);
    expect(dh).toBe(RASTER_SOURCE_SIZE);
    expect(dx).toBe(0);
    expect(dy).toBe(0);
  });

  it('ratio extrême landscape (512×64, ar=8) : dh=32 (size/8), centré', async () => {
    MockImage.nextWidth = 512;
    MockImage.nextHeight = 64;
    const { drawImageMock } = installCanvasMock();
    const file = new File([new Uint8Array([0x89, 0x50])], 'wide.png', { type: 'image/png' });

    await parseDecoFile(file, 64);

    const firstCall = drawImageMock.mock.calls[0]!;
    const [, , dy, dw, dh] = firstCall as [unknown, number, number, number, number];
    expect(dw).toBe(RASTER_SOURCE_SIZE);
    expect(dh).toBe(RASTER_SOURCE_SIZE / 8);           // 32
    expect(dy).toBe((RASTER_SOURCE_SIZE - 32) / 2);    // 112
  });
});

// ---------------------------------------------------------------------------
// 7. resampleHeightmapFromSource — P2.7c helper pour le slide du slider
//    resolution. Re-rasterise depuis slot.source sans re-parser les shapes.
// ---------------------------------------------------------------------------

describe('resampleHeightmapFromSource (P2.7c)', () => {
  it.each([16, 32, 64, 128])(
    'targetRes=%i → Uint8ClampedArray de taille targetRes²×4',
    async (target) => {
      installCanvasMock();
      const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';
      const data = await resampleHeightmapFromSource(svgText, 'svg', target);
      expect(data).toBeInstanceOf(Uint8ClampedArray);
      expect(data.length).toBe(target * target * 4);
    },
  );

  it('dataURL image → resample à 96×96', async () => {
    installCanvasMock();
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const data = await resampleHeightmapFromSource(dataUrl, 'image', 96);
    expect(data.length).toBe(96 * 96 * 4);
  });

  it('img.onerror → rejects "Image load failed"', async () => {
    installCanvasMock();
    // Override Image avec la variante ErrorImage pour ce test uniquement
    class LocalErrorImage {
      crossOrigin = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      get src(): string { return this._src; }
      set src(v: string) {
        this._src = v;
        queueMicrotask(() => { this.onerror?.(); });
      }
    }
    vi.stubGlobal('Image', LocalErrorImage);
    await expect(
      resampleHeightmapFromSource('<svg/>', 'svg', 64),
    ).rejects.toThrow(/Image load failed/);
  });
});

describe('parseDecoFile — resolution variants', () => {
  it.each([16, 32, 64, 128])(
    'targetRes=%i → heightmapData.length === targetRes²×4 et heightmapResolution===targetRes',
    async (target) => {
      installCanvasMock();
      const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';
      const file = new File([svgText], 'test.svg', { type: 'image/svg+xml' });

      const result = await parseDecoFile(file, target);
      expect(result.heightmapResolution).toBe(target);
      expect(result.heightmapData.length).toBe(target * target * 4);
    },
  );

  it('targetRes=256 (source size) → pas de downsample, data === source canvas bytes', async () => {
    installCanvasMock();
    const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';
    const file = new File([svgText], 'test.svg', { type: 'image/svg+xml' });

    const result = await parseDecoFile(file, RASTER_SOURCE_SIZE);
    expect(result.heightmapData.length).toBe(RASTER_SOURCE_SIZE * RASTER_SOURCE_SIZE * 4);
  });
});
