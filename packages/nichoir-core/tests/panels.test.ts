import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { createInitialState, buildPanelDefs } from '../src/index.js';
import type { NichoirState, BuildResult, PanelDef } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, 'fixtures');

type FixturePreset = {
  state: { params: Record<string, unknown>; clip: Record<string, unknown>; camera: Record<string, unknown>; decos: Record<string, unknown>; activeDecoKey: string; lang: string; activeTab: string };
  reference: {
    panelDefsNormalized: Array<{
      key: string;
      triangleCount: number;
      bbox: { min: [number, number, number]; max: [number, number, number] };
      basePos: [number, number, number];
      baseRot: [number, number, number];
      color: number;
      hasExtraClips: boolean;
    }>;
    calculations: { derived: Record<string, unknown> };
  };
};

const presets: FixturePreset[] = ['A', 'B', 'C'].map(p =>
  JSON.parse(readFileSync(path.join(fixturesDir, `preset${p}.snapshot.json`), 'utf8')),
);
const presetD: FixturePreset = JSON.parse(readFileSync(path.join(fixturesDir, 'presetD.snapshot.json'), 'utf8'));
const presetE: FixturePreset = JSON.parse(readFileSync(path.join(fixturesDir, 'presetE.snapshot.json'), 'utf8'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function triangleCount(geo: THREE.BufferGeometry): number {
  const idx = geo.getIndex();
  if (idx) return idx.count / 3;
  const pos = geo.getAttribute('position');
  return pos.count / 3;
}

function computeBbox(geo: THREE.BufferGeometry): { min: [number, number, number]; max: [number, number, number] } {
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

/** Reconstruit un NichoirState depuis un objet fixture (copie des params + état initial). */
function stateFromFixture(fixture: FixturePreset): NichoirState {
  const state = createInitialState();
  Object.assign(state.params, fixture.state.params);
  Object.assign(state.clip.x, fixture.state.clip['x']);
  Object.assign(state.clip.y, fixture.state.clip['y']);
  Object.assign(state.clip.z, fixture.state.clip['z']);
  return state;
}

/**
 * Reconstruit un NichoirState depuis un fixture D/E (avec décos actives).
 * Réhydrate heightmapData (Array → Uint8ClampedArray) et parsedShapes (inchangés).
 */
function stateFromDecoFixture(fixture: FixturePreset): NichoirState {
  const state = stateFromFixture(fixture);
  const fixtureDecos = fixture.state['decos'] as Record<string, Record<string, unknown>>;
  for (const k of Object.keys(fixtureDecos)) {
    const decoKey = k as keyof typeof state.decos;
    const srcDeco = fixtureDecos[k]!;
    // Rehydratation : on copie via Object.assign puis on réhydrate les Uint8ClampedArray.
    const hydrated: Record<string, unknown> = { ...srcDeco };
    if (Array.isArray(hydrated['heightmapData'])) {
      hydrated['heightmapData'] = new Uint8ClampedArray(hydrated['heightmapData'] as number[]);
    }
    // Assign sur le DecoSlotCore existant — les champs concordent avec la contrat.
    Object.assign(state.decos[decoKey], hydrated);
  }
  return state;
}

const TOL = 1e-6; // ACCEPTANCE-P1-P2.md exige 1e-6. Les valeurs sont stockées en Float32 mais les opérations sont en double — les valeurs architecturales (mm, <1000) restent dans 1e-6 après round-trip float32.

function expectClose(actual: number, expected: number, label: string, tol = TOL): void {
  if (expected === 0) {
    expect(Math.abs(actual), label).toBeLessThan(1e-3);
  } else {
    const rel = Math.abs(actual - expected) / Math.abs(expected);
    expect(rel, `rel err at ${label}: got ${actual}, expected ${expected}`).toBeLessThan(tol);
  }
}

// ---------------------------------------------------------------------------
// Tests panels A/B/C
// ---------------------------------------------------------------------------

describe('buildPanelDefs', () => {
  for (const [i, label] of (['A', 'B', 'C'] as const).entries()) {
    describe(`preset ${label}`, () => {
      let result: BuildResult;
      const fixture = presets[i]!;

      it('retourne un BuildResult', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        expect(result).toBeDefined();
        expect(Array.isArray(result.defs)).toBe(true);
      });

      it('nombre de panelDefs correspond au fixture', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        expect(result.defs.length).toBe(fixture.reference.panelDefsNormalized.length);
      });

      it('clés dans le bon ordre', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        const actualKeys = result.defs.map((d: PanelDef) => d.key);
        const expectedKeys = fixture.reference.panelDefsNormalized.map(r => r.key);
        expect(actualKeys).toEqual(expectedKeys);
      });

      it('triangleCount de chaque panneau', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        fixture.reference.panelDefsNormalized.forEach((ref, idx) => {
          const def = result.defs[idx]!;
          const tc = triangleCount(def.geometry);
          expect(tc, `triangleCount[${ref.key}]`).toBe(ref.triangleCount);
        });
      });

      it('bbox de chaque panneau (tolérance float32)', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        fixture.reference.panelDefsNormalized.forEach((ref, idx) => {
          const def = result.defs[idx]!;
          const bb = computeBbox(def.geometry);
          for (let ax = 0; ax < 3; ax++) {
            expectClose(bb.min[ax]!, ref.bbox.min[ax]!, `bbox.min[${ax}] of ${ref.key}`);
            expectClose(bb.max[ax]!, ref.bbox.max[ax]!, `bbox.max[${ax}] of ${ref.key}`);
          }
        });
      });

      it('basePos de chaque panneau', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        fixture.reference.panelDefsNormalized.forEach((ref, idx) => {
          const def = result.defs[idx]!;
          for (let ax = 0; ax < 3; ax++) {
            expectClose(def.basePos[ax]!, ref.basePos[ax]!, `basePos[${ax}] of ${ref.key}`);
          }
        });
      });

      it('baseRot de chaque panneau', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        fixture.reference.panelDefsNormalized.forEach((ref, idx) => {
          const def = result.defs[idx]!;
          for (let ax = 0; ax < 3; ax++) {
            expectClose(def.baseRot[ax]!, ref.baseRot[ax]!, `baseRot[${ax}] of ${ref.key}`);
          }
        });
      });

      it('couleur de chaque panneau', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        fixture.reference.panelDefsNormalized.forEach((ref, idx) => {
          const def = result.defs[idx]!;
          expect(def.color, `color of ${ref.key}`).toBe(ref.color);
        });
      });

      it('hasExtraClips de chaque panneau', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        fixture.reference.panelDefsNormalized.forEach((ref, idx) => {
          const def = result.defs[idx]!;
          const hasExtra = def.extraClips != null && (def.extraClips as THREE.Plane[]).length > 0;
          expect(hasExtra, `hasExtraClips of ${ref.key}`).toBe(ref.hasExtraClips);
        });
      });

      it('explodeDistance = 0 (explode=0 dans tous les presets)', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        expect(result.explodeDistance).toBe(0);
      });

      it('activeClips = [] (clips off dans tous les presets)', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        expect(result.activeClips).toEqual([]);
      });

      it('derived.wallH correspond au fixture calculations.derived.wallH', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        const refDerived = fixture.reference.calculations.derived;
        expectClose(result.derived.wallH, refDerived['wallH'] as number, 'derived.wallH', 1e-6);
      });

      it('derived.rH correspond au fixture', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        expectClose(result.derived.rH, fixture.reference.calculations.derived['rH'] as number, 'derived.rH', 1e-6);
      });

      it('derived.sL correspond au fixture', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        expectClose(result.derived.sL, fixture.reference.calculations.derived['sL'] as number, 'derived.sL', 1e-6);
      });

      it('derived.hasTaper correspond au fixture', () => {
        const state = stateFromFixture(fixture);
        result = buildPanelDefs(state);
        expect(result.derived.hasTaper).toBe(fixture.reference.calculations.derived['hasTaper']);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Tests panels D (heightmap deco) et E (vector decos)
// Fixtures captured from TS port (not src/*) car src.buildDecoGeo heightmap
// branch utilise document.createElement('canvas') → non-exécutable en Node.
// Ces tests vérifient que le port TS est DÉTERMINISTE sur les mêmes inputs.
// ---------------------------------------------------------------------------

/**
 * Tests génériques pour un preset D/E : parité structurelle complète
 * (même couverture que A/B/C — 11 assertions × preset).
 * Extrait en fonction helper pour éviter la duplication verbeuse.
 */
function runDecoPresetTests(label: string, fixture: FixturePreset, extraKeys: string[] = []): void {
  describe(`buildPanelDefs — preset ${label}`, () => {
    let result: BuildResult;

    it('retourne un BuildResult', () => {
      const state = stateFromDecoFixture(fixture);
      result = buildPanelDefs(state);
      expect(result).toBeDefined();
      expect(Array.isArray(result.defs)).toBe(true);
    });

    it('nombre de panelDefs correspond au fixture', () => {
      const state = stateFromDecoFixture(fixture);
      result = buildPanelDefs(state);
      expect(result.defs.length).toBe(fixture.reference.panelDefsNormalized.length);
    });

    it('clés dans le bon ordre', () => {
      const state = stateFromDecoFixture(fixture);
      result = buildPanelDefs(state);
      const actualKeys = result.defs.map(d => d.key);
      const expectedKeys = fixture.reference.panelDefsNormalized.map(r => r.key);
      expect(actualKeys).toEqual(expectedKeys);
      for (const extra of extraKeys) {
        expect(actualKeys, `key "${extra}" present`).toContain(extra);
      }
    });

    it('triangleCount de chaque panneau (y compris deco_*)', () => {
      const state = stateFromDecoFixture(fixture);
      result = buildPanelDefs(state);
      fixture.reference.panelDefsNormalized.forEach((ref, idx) => {
        const def = result.defs[idx]!;
        const tc = triangleCount(def.geometry);
        expect(tc, `triangleCount[${ref.key}]`).toBe(ref.triangleCount);
      });
    });

    it('bbox de chaque panneau (tolérance float32)', () => {
      const state = stateFromDecoFixture(fixture);
      result = buildPanelDefs(state);
      fixture.reference.panelDefsNormalized.forEach((ref, idx) => {
        const def = result.defs[idx]!;
        const bb = computeBbox(def.geometry);
        for (let ax = 0; ax < 3; ax++) {
          expectClose(bb.min[ax]!, ref.bbox.min[ax]!, `bbox.min[${ax}] of ${ref.key}`);
          expectClose(bb.max[ax]!, ref.bbox.max[ax]!, `bbox.max[${ax}] of ${ref.key}`);
        }
      });
    });

    it('basePos de chaque panneau', () => {
      const state = stateFromDecoFixture(fixture);
      result = buildPanelDefs(state);
      fixture.reference.panelDefsNormalized.forEach((ref, idx) => {
        const def = result.defs[idx]!;
        for (let ax = 0; ax < 3; ax++) {
          expectClose(def.basePos[ax]!, ref.basePos[ax]!, `basePos[${ax}] of ${ref.key}`);
        }
      });
    });

    it('baseRot de chaque panneau', () => {
      const state = stateFromDecoFixture(fixture);
      result = buildPanelDefs(state);
      fixture.reference.panelDefsNormalized.forEach((ref, idx) => {
        const def = result.defs[idx]!;
        for (let ax = 0; ax < 3; ax++) {
          expectClose(def.baseRot[ax]!, ref.baseRot[ax]!, `baseRot[${ax}] of ${ref.key}`);
        }
      });
    });

    it('couleur de chaque panneau', () => {
      const state = stateFromDecoFixture(fixture);
      result = buildPanelDefs(state);
      fixture.reference.panelDefsNormalized.forEach((ref, idx) => {
        const def = result.defs[idx]!;
        expect(def.color, `color of ${ref.key}`).toBe(ref.color);
      });
    });

    it('hasExtraClips de chaque panneau', () => {
      const state = stateFromDecoFixture(fixture);
      result = buildPanelDefs(state);
      fixture.reference.panelDefsNormalized.forEach((ref, idx) => {
        const def = result.defs[idx]!;
        const hasExtra = def.extraClips != null && (def.extraClips as THREE.Plane[]).length > 0;
        expect(hasExtra, `hasExtraClips of ${ref.key}`).toBe(ref.hasExtraClips);
      });
    });

    it('explodeDistance = 0 (explode=0 dans les presets D/E)', () => {
      const state = stateFromDecoFixture(fixture);
      result = buildPanelDefs(state);
      expect(result.explodeDistance).toBe(0);
    });

    it('activeClips = [] (clips off dans les presets D/E)', () => {
      const state = stateFromDecoFixture(fixture);
      result = buildPanelDefs(state);
      expect(result.activeClips).toEqual([]);
    });

    it('derived correspond au fixture (wallH, rH, sL, hasTaper)', () => {
      const state = stateFromDecoFixture(fixture);
      result = buildPanelDefs(state);
      const ref = fixture.reference.calculations.derived;
      expectClose(result.derived.wallH, ref['wallH'] as number, 'derived.wallH');
      expectClose(result.derived.rH, ref['rH'] as number, 'derived.rH');
      expectClose(result.derived.sL, ref['sL'] as number, 'derived.sL');
      expect(result.derived.hasTaper).toBe(ref['hasTaper']);
    });
  });
}

// Preset D : floor=pose, ridge=right, heightmap deco sur front
runDecoPresetTests('D (heightmap deco)', presetD, ['deco_front']);

// Preset E : ridge=left, doorPanel+door=round, 4 vector decos sur front/back/left/right
runDecoPresetTests('E (4 vector decos + doorPanel)', presetE, ['doorPanel', 'deco_front', 'deco_back', 'deco_left', 'deco_right']);

// ---------------------------------------------------------------------------
// P3 Feature doorFace : routing du trou de porte sur front / left / right
// ---------------------------------------------------------------------------

describe('doorFace routing (P3 feature)', () => {
  function stateWithDoor(face: 'front' | 'left' | 'right'): NichoirState {
    const s = createInitialState();
    s.params.door = 'round';
    s.params.doorFace = face;
    return s;
  }

  function defByKey(defs: PanelDef[], key: string): PanelDef | undefined {
    return defs.find((d) => d.key === key);
  }

  it('doorFace="front" (default) : front a plus de triangles que back (trou ajoute des faces)', () => {
    const { defs } = buildPanelDefs(stateWithDoor('front'));
    const front = defByKey(defs, 'front');
    const back = defByKey(defs, 'back');
    expect(front).toBeDefined();
    expect(back).toBeDefined();
    expect(triangleCount(front!.geometry)).toBeGreaterThan(triangleCount(back!.geometry));
  });

  it('doorFace="left" : front "plain" = back, left a plus de triangles qu\'un left sans porte', () => {
    const withDoorLeft = buildPanelDefs(stateWithDoor('left'));
    const noDoor = buildPanelDefs(createInitialState()); // door='none'
    const frontLeft = defByKey(withDoorLeft.defs, 'front');
    const backLeft = defByKey(withDoorLeft.defs, 'back');
    const leftWithDoor = defByKey(withDoorLeft.defs, 'left');
    const leftNoDoor = defByKey(noDoor.defs, 'left');
    expect(triangleCount(frontLeft!.geometry)).toBe(triangleCount(backLeft!.geometry)); // front plein
    expect(triangleCount(leftWithDoor!.geometry)).toBeGreaterThan(triangleCount(leftNoDoor!.geometry));
  });

  it('doorFace="right" : right a plus de triangles qu\'un right sans porte, left inchange', () => {
    const withDoorRight = buildPanelDefs(stateWithDoor('right'));
    const noDoor = buildPanelDefs(createInitialState());
    const rightWithDoor = defByKey(withDoorRight.defs, 'right');
    const rightNoDoor = defByKey(noDoor.defs, 'right');
    const leftWithDoorRight = defByKey(withDoorRight.defs, 'left');
    const leftNoDoor = defByKey(noDoor.defs, 'left');
    expect(triangleCount(rightWithDoor!.geometry)).toBeGreaterThan(triangleCount(rightNoDoor!.geometry));
    expect(triangleCount(leftWithDoorRight!.geometry)).toBe(triangleCount(leftNoDoor!.geometry));
  });

  it('doorPanel physique suit la face : basePos.z = D/2-T pour front, 0 pour left/right', () => {
    const base = createInitialState();
    const D_val = base.params.D;
    const T_val = base.params.T;
    const W_val = base.params.W;

    for (const face of ['front', 'left', 'right'] as const) {
      const s = stateWithDoor(face);
      s.params.doorPanel = true;
      const { defs } = buildPanelDefs(s);
      const dp = defByKey(defs, 'doorPanel');
      expect(dp, `doorPanel missing for face=${face}`).toBeDefined();
      if (face === 'front') {
        expect(dp!.basePos[2]).toBeCloseTo(D_val / 2 - T_val, 5);
        expect(dp!.basePos[0]).toBe(0);
      } else if (face === 'left') {
        expect(dp!.basePos[0]).toBeCloseTo(-(W_val / 2 - T_val), 5);
        expect(dp!.basePos[2]).toBe(0);
      } else {
        expect(dp!.basePos[0]).toBeCloseTo(+(W_val / 2 - T_val), 5);
        expect(dp!.basePos[2]).toBe(0);
      }
    }
  });
});
