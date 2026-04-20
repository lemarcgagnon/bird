import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { computeCutLayout, createInitialState } from '../src/index.js';

const fixturesDir = path.resolve(__dirname, 'fixtures');
const presets = ['A', 'B', 'C'].map(p =>
  JSON.parse(readFileSync(path.join(fixturesDir, `preset${p}.snapshot.json`), 'utf8'))
);

function expectCloseValue(actual: unknown, expected: unknown, tolerance = 1e-6, path_ = ''): void {
  if (typeof expected === 'number') {
    if (expected === 0) {
      expect(actual as number, `path: ${path_}`).toBeCloseTo(0, 10);
    } else {
      const rel = Math.abs((actual as number) - expected) / Math.abs(expected);
      expect(rel, `relative error at ${path_}: got ${actual}, expected ${expected}`).toBeLessThan(tolerance);
    }
    return;
  }
  if (typeof expected === 'string' || typeof expected === 'boolean' || expected === null || expected === undefined) {
    expect(actual, `path: ${path_}`).toEqual(expected);
    return;
  }
  if (typeof expected === 'object') {
    const exp = expected as Record<string, unknown>;
    const act = actual as Record<string, unknown>;
    for (const key of Object.keys(exp)) {
      expectCloseValue(act[key], exp[key], tolerance, path_ ? `${path_}.${key}` : key);
    }
  }
}

describe('computeCutLayout', () => {
  for (const [i, label] of (['A', 'B', 'C'] as const).entries()) {
    it(`preset ${label}`, () => {
      const { params } = presets[i].state;
      const result = computeCutLayout(params);
      const expected = presets[i].reference.cutLayout;

      // shW, shH : entiers exacts
      expect(result.shW, 'shW').toEqual(expected.shW);
      expect(result.shH, 'shH').toEqual(expected.shH);

      // totalArea : tolérance relative
      expectCloseValue(result.totalArea, expected.totalArea, 1e-6, 'totalArea');

      // pieces : même longueur
      expect(result.pieces.length, 'pieces.length').toEqual(expected.pieces.length);

      // pieces : chaque pièce comparée avec tolérance sur les floats
      for (let j = 0; j < expected.pieces.length; j++) {
        const expPiece = expected.pieces[j];
        const actPiece = result.pieces[j];
        expectCloseValue(actPiece, expPiece, 1e-6, `pieces[${j}]`);
      }
    });
  }
});

// Branche overflow : A/B/C avec panelW/panelH standard ne déclenchent jamais
// les chemins `overflow=true` de cut-plan.ts (lignes 61, 67, 70).
// Ces tests forcent la branche avec un panneau volontairement trop petit.
describe('computeCutLayout overflow branch', () => {
  it('marks pieces as overflow when panel is smaller than all pieces', () => {
    const base = createInitialState().params;
    // Panneau 100×100 : toutes les pièces sont plus grandes que ça → overflow garanti
    const layout = computeCutLayout({ ...base, panelW: 100, panelH: 100 });

    const overflowed = layout.pieces.filter(p => p.overflow === true);
    expect(overflowed.length, 'at least one piece must overflow on 100×100 panel').toBeGreaterThan(0);

    // Tous les pièces doivent avoir une position assignée (px/py définis)
    // même en overflow — c'est ce que fait src/cut-plan.js.
    for (const p of layout.pieces) {
      expect(p.px, `piece "${p.nameKey}${p.suffix ?? ''}" must have px`).toBeDefined();
      expect(p.py, `piece "${p.nameKey}${p.suffix ?? ''}" must have py`).toBeDefined();
      expect(typeof p.rot, `piece "${p.nameKey}${p.suffix ?? ''}" must have rot bool`).toBe('boolean');
    }
  });

  it('overflow branch with too-narrow panel (width < pieces) flags overflow', () => {
    const base = createInitialState().params;
    // Panneau très fin : les pièces larges (façades) ne tiennent pas en largeur
    const layout = computeCutLayout({ ...base, panelW: 50, panelH: 4000 });

    const overflowed = layout.pieces.filter(p => p.overflow === true);
    expect(overflowed.length, 'overflow expected on 50-wide panel').toBeGreaterThan(0);
  });

  it('no overflow on default panel (regression sanity)', () => {
    const params = createInitialState().params;  // 1220 × 2440, cas nominal
    const layout = computeCutLayout(params);
    const overflowed = layout.pieces.filter(p => p.overflow === true);
    expect(overflowed.length, 'default panel must not overflow any piece').toBe(0);
  });
});
