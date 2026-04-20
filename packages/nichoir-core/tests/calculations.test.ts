import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { computeCalculations, computeCutList } from '../src/index.js';

const fixturesDir = path.resolve(__dirname, 'fixtures');
const presets = ['A', 'B', 'C'].map(p =>
  JSON.parse(readFileSync(path.join(fixturesDir, `preset${p}.snapshot.json`), 'utf8'))
);

function expectCloseObject(
  actual: unknown,
  expected: unknown,
  tolerance = 1e-6,
  path_ = ''
): void {
  if (typeof expected === 'number') {
    if (expected === 0) {
      expect(actual as number, `path: ${path_}`).toBeCloseTo(0, 10);
    } else {
      const rel = Math.abs((actual as number) - expected) / Math.abs(expected);
      expect(rel, `relative error at ${path_}: got ${actual}, expected ${expected}`).toBeLessThan(tolerance);
    }
    return;
  }
  if (typeof expected !== 'object' || expected === null) {
    expect(actual, `path: ${path_}`).toEqual(expected);
    return;
  }
  const exp = expected as Record<string, unknown>;
  const act = actual as Record<string, unknown>;
  for (const key of Object.keys(exp)) {
    expectCloseObject(act[key], exp[key], tolerance, path_ ? `${path_}.${key}` : key);
  }
}

describe('computeCalculations', () => {
  for (const [i, label] of (['A', 'B', 'C'] as const).entries()) {
    it(`preset ${label}`, () => {
      const { params } = presets[i].state;
      const result = computeCalculations(params);
      const expected = presets[i].reference.calculations;
      expectCloseObject(result.volumes, expected.volumes, 1e-6, 'volumes');
      expectCloseObject(result.surfaces, expected.surfaces, 1e-6, 'surfaces');
      // Booleans et non-float : exact
      expect(result.derived.hasTaper, 'derived.hasTaper').toEqual(expected.derived.hasTaper);
      expect(result.derived.isPose, 'derived.isPose').toEqual(expected.derived.isPose);
      // Floats : relative tolerance
      const floatFields = [
        'wallH', 'rH', 'sL', 'rL', 'bev', 'sL_L', 'sL_R',
        'Wtop', 'Wbot', 'wallHreal', 'floorW', 'floorD', 'sideD', 'ang',
      ] as const;
      for (const field of floatFields) {
        expectCloseObject(
          (result.derived as unknown as Record<string, unknown>)[field],
          (expected.derived as unknown as Record<string, unknown>)[field],
          1e-6,
          `derived.${field}`
        );
      }
    });
  }
});

describe('computeCutList', () => {
  for (const [i, label] of (['A', 'B', 'C'] as const).entries()) {
    it(`preset ${label}`, () => {
      const { params } = presets[i].state;
      const calc = computeCalculations(params);
      const result = computeCutList(params, calc.derived);
      const expected = presets[i].reference.cutList;
      // nPieces : entier exact
      expect(result.nPieces, 'nPieces').toEqual(expected.nPieces);
      // cuts[] : comparaison profonde exacte
      expect(result.cuts).toEqual(expected.cuts);
    });
  }
});
