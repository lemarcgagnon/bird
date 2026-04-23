import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createInitialState,
  buildPanelDefs,
  generateHouseSTL,
  generateDoorSTL,
  generatePanelsZIP,
  generatePlanSVG,
  computeCutLayout,
} from '../src/index.js';
import type { NichoirState, Translator } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, 'fixtures');

type FixturePreset = {
  state: {
    params: Record<string, unknown>;
    clip: Record<string, unknown>;
    camera: Record<string, unknown>;
    decos: Record<string, Record<string, unknown>>;
    activeDecoKey: string;
    lang: string;
    activeTab: string;
  };
  reference: {
    stlHouse: { byteLength: number; triangleCount: number; aggregateBbox: { min: number[]; max: number[] } } | null;
    stlDoor: { byteLength: number; triangleCount: number; aggregateBbox: { min: number[]; max: number[] } } | null;
    panelsZip: { byteLength: number; entries: Array<{ filename: string; stlByteLength: number; stlTriangleCount: number }> } | null;
    planSvg: { byteLength: number; polygonCount: number; rectCount: number; textCount: number };
  };
};

const presetA: FixturePreset = JSON.parse(readFileSync(path.join(fixturesDir, 'presetA.snapshot.json'), 'utf8'));
const presetB: FixturePreset = JSON.parse(readFileSync(path.join(fixturesDir, 'presetB.snapshot.json'), 'utf8'));
const presetC: FixturePreset = JSON.parse(readFileSync(path.join(fixturesDir, 'presetC.snapshot.json'), 'utf8'));
const presetD: FixturePreset = JSON.parse(readFileSync(path.join(fixturesDir, 'presetD.snapshot.json'), 'utf8'));
const presetE: FixturePreset = JSON.parse(readFileSync(path.join(fixturesDir, 'presetE.snapshot.json'), 'utf8'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reconstruit NichoirState depuis params + clip (presets sans déco active). */
function stateFromFixture(fixture: FixturePreset): NichoirState {
  const state = createInitialState();
  Object.assign(state.params, fixture.state.params);
  Object.assign(state.clip.x, fixture.state.clip['x']);
  Object.assign(state.clip.y, fixture.state.clip['y']);
  Object.assign(state.clip.z, fixture.state.clip['z']);
  return state;
}

/** Idem + réhydrate les décos actives (heightmapData Array → Uint8ClampedArray). */
function stateFromDecoFixture(fixture: FixturePreset): NichoirState {
  const state = stateFromFixture(fixture);
  for (const k of Object.keys(fixture.state.decos)) {
    const decoKey = k as keyof typeof state.decos;
    const src = fixture.state.decos[k]!;
    const hydrated: Record<string, unknown> = { ...src };
    if (Array.isArray(hydrated['heightmapData'])) {
      hydrated['heightmapData'] = new Uint8ClampedArray(hydrated['heightmapData'] as number[]);
    }
    Object.assign(state.decos[decoKey], hydrated);
  }
  return state;
}

/** Déduit le nombre de triangles d'un STL binaire depuis sa taille.
 *  Format : header 80 + count 4 + 50/tri → count = (byteLength - 84) / 50 */
function stlTriangleCount(bytes: Uint8Array): number {
  return (bytes.byteLength - 84) / 50;
}

/** Lit le triangle count depuis l'offset 80 (4 bytes LE uint32). */
function stlTriangleCountFromHeader(bytes: Uint8Array): number {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getUint32(80, true);
}

/** Extrait la bbox agrégée (min/max des vertices) en décodant le STL binaire. */
function stlAggregateBbox(bytes: Uint8Array): { min: [number, number, number]; max: [number, number, number] } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = dv.getUint32(80, true);
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  // Per-tri layout : [12 bytes normal][36 bytes 3 vertices × 3 floats][2 bytes attr]
  for (let i = 0; i < n; i++) {
    const base = 84 + i * 50 + 12; // skip 84 header + normal
    for (let v = 0; v < 3; v++) {
      const x = dv.getFloat32(base + v * 12, true);
      const y = dv.getFloat32(base + v * 12 + 4, true);
      const z = dv.getFloat32(base + v * 12 + 8, true);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

/** Translator identity : retourne la clé elle-même. Suffisant pour les tests
 *  puisque les références de byteLength/count ont été capturées avec un
 *  translator qui retourne des strings — ici on vérifie la structure générée
 *  à partir de la même entrée (identity), pas la parité byte vs les captures. */
const identityTranslator: Translator = (key: string) => key;

// ---------------------------------------------------------------------------
// generateHouseSTL
// ---------------------------------------------------------------------------

describe('generateHouseSTL', () => {
  const TOL_BBOX = 1e-4; // float32 round-trip tolerance on STL-encoded vertex positions

  for (const [label, fixture, withDeco] of [
    ['A', presetA, false],
    ['B', presetB, false],
    ['C', presetC, false],
    ['D', presetD, true],
    ['E', presetE, true],
  ] as const) {
    it(`preset ${label} — byteLength + triangleCount + aggregateBbox matchent le fixture`, () => {
      const state = withDeco ? stateFromDecoFixture(fixture) : stateFromFixture(fixture);
      const buildResult = buildPanelDefs(state);
      const bytes = generateHouseSTL(buildResult);

      const ref = fixture.reference.stlHouse;
      if (ref === null) {
        expect(bytes).toBeNull();
        return;
      }
      expect(bytes).not.toBeNull();
      // byteLength
      expect(bytes!.byteLength, `byteLength of preset ${label} STL house`).toBe(ref.byteLength);
      // triangleCount : via taille (dérivé) ET via header (lu depuis les bytes)
      expect(stlTriangleCount(bytes!), `triangleCount (from size)`).toBe(ref.triangleCount);
      expect(stlTriangleCountFromHeader(bytes!), `triangleCount (from STL header)`).toBe(ref.triangleCount);
      // aggregateBbox : décoder tous les vertices et comparer min/max
      const bbox = stlAggregateBbox(bytes!);
      for (let ax = 0; ax < 3; ax++) {
        expect(Math.abs(bbox.min[ax]! - ref.aggregateBbox.min[ax]!), `bbox.min[${ax}] of preset ${label}`).toBeLessThan(TOL_BBOX);
        expect(Math.abs(bbox.max[ax]! - ref.aggregateBbox.max[ax]!), `bbox.max[${ax}] of preset ${label}`).toBeLessThan(TOL_BBOX);
      }
    });
  }

  it('retourne null quand aucun défini', () => {
    // On force un BuildResult sans aucun panneau maison
    const emptyBuild = { defs: [], explodeDistance: 0, activeClips: [], clipPlanesOut: {}, derived: {} as never };
    const bytes = generateHouseSTL(emptyBuild as never);
    expect(bytes).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// generateDoorSTL
// ---------------------------------------------------------------------------

describe('generateDoorSTL', () => {
  for (const [label, fixture, withDeco] of [
    ['A', presetA, false],
    ['B', presetB, false],
    ['C', presetC, false],
    ['D', presetD, true],
    ['E', presetE, true],
  ] as const) {
    it(`preset ${label} — byteLength + triangleCount + aggregateBbox vs fixture`, () => {
      const TOL_BBOX = 1e-4;
      const state = withDeco ? stateFromDecoFixture(fixture) : stateFromFixture(fixture);
      const buildResult = buildPanelDefs(state);
      const bytes = generateDoorSTL(buildResult);

      const ref = fixture.reference.stlDoor;
      if (ref === null) {
        expect(bytes, `preset ${label} should have no doorPanel`).toBeNull();
        return;
      }
      expect(bytes).not.toBeNull();
      expect(bytes!.byteLength).toBe(ref.byteLength);
      expect(stlTriangleCount(bytes!)).toBe(ref.triangleCount);
      expect(stlTriangleCountFromHeader(bytes!)).toBe(ref.triangleCount);
      const bbox = stlAggregateBbox(bytes!);
      for (let ax = 0; ax < 3; ax++) {
        expect(Math.abs(bbox.min[ax]! - ref.aggregateBbox.min[ax]!)).toBeLessThan(TOL_BBOX);
        expect(Math.abs(bbox.max[ax]! - ref.aggregateBbox.max[ax]!)).toBeLessThan(TOL_BBOX);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// generatePanelsZIP
// ---------------------------------------------------------------------------

describe('generatePanelsZIP', () => {
  // Translator qui retourne juste `panel.<key>` — le capture script utilise
  // le src/i18n.t() qui résout ces clés. Pour le test, on compare structure
  // (count + byteLength par fichier) plutôt que les noms de fichiers.
  const fakeNames: Record<string, string> = {
    'panel.front': 'facade_avant',
    'panel.back': 'facade_arriere',
    'panel.left': 'cote_gauche',
    'panel.right': 'cote_droit',
    'panel.bottom': 'plancher',
    'panel.roofL': 'toit_gauche',
    'panel.roofR': 'toit_droit',
    'panel.perch': 'perchoir',
    'panel.doorPanel': 'panneau_porte',
  };
  const mappedTranslator: Translator = (key: string) => fakeNames[key] ?? key;

  for (const [label, fixture, withDeco] of [
    ['A', presetA, false],
    ['B', presetB, false],
    ['C', presetC, false],
    ['D', presetD, true],
    ['E', presetE, true],
  ] as const) {
    it(`preset ${label} — entries count + per-file stlByteLength + per-file stlTriangleCount matchent le fixture`, async () => {
      const state = withDeco ? stateFromDecoFixture(fixture) : stateFromFixture(fixture);
      const buildResult = buildPanelDefs(state);
      const zipBytes = await generatePanelsZIP(buildResult, state.params, mappedTranslator);
      expect(zipBytes).toBeInstanceOf(Uint8Array);

      const ref = fixture.reference.panelsZip;
      if (ref === null) {
        expect(zipBytes.byteLength, `preset ${label} ZIP byteLength`).toBeGreaterThan(0);
        return;
      }

      // Inspecte le ZIP : relire avec JSZip pour extraire chaque STL interne.
      const JSZipModule = await import('jszip');
      const JSZip = JSZipModule.default;
      const zip = await JSZip.loadAsync(zipBytes);
      const filenames = Object.keys(zip.files).sort();
      expect(filenames.length, `preset ${label} entries count`).toBe(ref.entries.length);

      // Pour chaque file : taille + triangle count (lu depuis le STL header).
      // Les noms de fichiers diffèrent entre capture (t() réel) et test (fakeNames),
      // donc on compare les tuples (size, triCount) triés lexicographiquement.
      const generatedTuples: Array<[number, number]> = [];
      for (const fname of filenames) {
        const entry = zip.file(fname);
        if (!entry) continue;
        const content = await entry.async('uint8array');
        generatedTuples.push([content.byteLength, stlTriangleCountFromHeader(content)]);
      }
      const refTuples: Array<[number, number]> = ref.entries.map(e => [e.stlByteLength, e.stlTriangleCount]);
      // Tri tuple-lexicographique sur (byteLength, triCount)
      const cmp = (a: [number, number], b: [number, number]): number => a[0] - b[0] || a[1] - b[1];
      generatedTuples.sort(cmp);
      refTuples.sort(cmp);
      expect(generatedTuples, `preset ${label} (byteLength, triCount) per entry`).toEqual(refTuples);
    });
  }
});

// ---------------------------------------------------------------------------
// generatePlanSVG
// ---------------------------------------------------------------------------

describe('generatePlanSVG', () => {
  // Les fixtures ont planSvg capturé avec src/i18n.t() qui résout les clés.
  // Pour la parité byteLength, on utilise un translator qui reproduit les
  // mêmes résolutions. Pour simplifier, on utilise identityTranslator ici
  // et on vérifie la STRUCTURE (polygon/rect/text counts) plutôt que byteLength.

  for (const [label, fixture, withDeco] of [
    ['A', presetA, false],
    ['B', presetB, false],
    ['C', presetC, false],
    ['D', presetD, true],
    ['E', presetE, true],
  ] as const) {
    it(`preset ${label} — structure SVG (polygon/rect/text counts) match`, () => {
      const state = withDeco ? stateFromDecoFixture(fixture) : stateFromFixture(fixture);
      const layout = computeCutLayout(state.params);
      const svg = generatePlanSVG(layout.panels[0], identityTranslator);

      expect(typeof svg).toBe('string');
      expect(svg.startsWith('<?xml')).toBe(true);
      expect(svg.includes('</svg>')).toBe(true);

      const ref = fixture.reference.planSvg;
      const polygonCount = (svg.match(/<polygon /g) ?? []).length;
      const rectCount = (svg.match(/<rect /g) ?? []).length;
      const textCount = (svg.match(/<text /g) ?? []).length;

      expect(polygonCount, `polygonCount preset ${label}`).toBe(ref.polygonCount);
      expect(rectCount, `rectCount preset ${label}`).toBe(ref.rectCount);
      expect(textCount, `textCount preset ${label}`).toBe(ref.textCount);
    });
  }

  it('throws si translate retourne undefined est un bug appelant — core n\'intercepte pas', () => {
    // Doc : le contrat Translator dit "must return string". Un appelant bugué
    // peut produire un SVG avec "undefined" dans les labels — pas géré par core.
    // Ce test vérifie juste que le core NE throw PAS dans ce cas (il produit
    // un SVG syntaxiquement valide mais avec "undefined" comme label).
    const badTranslator = (() => undefined) as unknown as Translator;
    const state = createInitialState();
    const layout = computeCutLayout(state.params);
    const svg = generatePlanSVG(layout.panels[0], badTranslator);
    expect(svg.includes('undefined')).toBe(true);
    expect(svg.includes('</svg>')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generatePlanZIP
// ---------------------------------------------------------------------------

describe('generatePlanZIP', () => {
  it('produces one SVG entry per panel', async () => {
    const { computeCutLayout, generatePlanZIP, createInitialState } = await import('../src/index.js');
    const JSZip = (await import('jszip')).default;
    const t = (k: string) => k;

    const base = createInitialState().params;
    // Force multi-panel with narrow panel
    const layout = computeCutLayout({ ...base, panelW: 200, panelH: 300 });
    expect(layout.panels.length, 'multiple panels expected').toBeGreaterThan(1);

    const zipBytes = await generatePlanZIP(layout, t);
    const zip = await JSZip.loadAsync(zipBytes);

    const names = Object.keys(zip.files).sort();
    expect(names.length).toBe(layout.panels.length);
    for (let i = 0; i < layout.panels.length; i++) {
      expect(names[i]).toBe(`panel-${i + 1}.svg`);
    }
  });

  it('returns a non-empty ZIP even with a single panel', async () => {
    const { computeCutLayout, generatePlanZIP, createInitialState } = await import('../src/index.js');
    const JSZip = (await import('jszip')).default;
    const t = (k: string) => k;
    const layout = computeCutLayout(createInitialState().params);
    const zipBytes = await generatePlanZIP(layout, t);
    expect(zipBytes.byteLength).toBeGreaterThan(100);
    const zip = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(zip.files).length).toBe(1);
  });

  it('empty layout (all overflow) produces empty ZIP', async () => {
    const { computeCutLayout, generatePlanZIP, createInitialState } = await import('../src/index.js');
    const JSZip = (await import('jszip')).default;
    const t = (k: string) => k;
    const base = createInitialState().params;
    const layout = computeCutLayout({ ...base, panelW: 10, panelH: 10 });
    expect(layout.panels.length).toBe(0);
    const zipBytes = await generatePlanZIP(layout, t);
    const zip = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(zip.files).length).toBe(0);
  });
});
