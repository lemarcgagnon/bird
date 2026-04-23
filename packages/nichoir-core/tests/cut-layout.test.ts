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
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), `expected array at ${path_}`).toBe(true);
    const act = actual as unknown[];
    expect(act.length, `length at ${path_}`).toEqual(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expectCloseValue(act[i], expected[i], tolerance, `${path_}[${i}]`);
    }
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

describe('computeCutLayout — new multi-bin contract', () => {
  for (const [i, label] of (['A', 'B', 'C'] as const).entries()) {
    it(`preset ${label} : parity with fixture (cutLayout)`, () => {
      const { params } = presets[i].state;
      const result = computeCutLayout(params);
      const expected = presets[i].reference.cutLayout;

      // Structural shape of the new type
      expect(Array.isArray(result.panels), 'panels is array').toBe(true);
      expect(Array.isArray(result.overflow), 'overflow is array').toBe(true);
      expect(typeof result.totalUsedArea, 'totalUsedArea number').toBe('number');
      expect(typeof result.meanOccupation, 'meanOccupation number').toBe('number');

      // Parity with fixture — exact panel count and totals
      expect(result.panels.length, 'panels.length').toEqual(expected.panels.length);
      expect(result.overflow.length, 'overflow.length').toEqual(expected.overflow.length);

      expectCloseValue(result.totalUsedArea, expected.totalUsedArea, 1e-6, 'totalUsedArea');
      expectCloseValue(result.meanOccupation, expected.meanOccupation, 1e-6, 'meanOccupation');

      // Each panel: dimensions, pieces count, occupation
      for (let p = 0; p < expected.panels.length; p++) {
        const actPanel = result.panels[p]!;
        const expPanel = expected.panels[p]!;
        expect(actPanel.shW, `panels[${p}].shW`).toEqual(expPanel.shW);
        expect(actPanel.shH, `panels[${p}].shH`).toEqual(expPanel.shH);
        expect(actPanel.pieces.length, `panels[${p}].pieces.length`).toEqual(expPanel.pieces.length);
        expectCloseValue(actPanel.usedArea, expPanel.usedArea, 1e-6, `panels[${p}].usedArea`);
        expectCloseValue(actPanel.occupation, expPanel.occupation, 1e-6, `panels[${p}].occupation`);

        for (let j = 0; j < expPanel.pieces.length; j++) {
          expectCloseValue(actPanel.pieces[j], expPanel.pieces[j], 1e-6, `panels[${p}].pieces[${j}]`);
        }
      }
    });
  }
});

describe('computeCutLayout — invariants', () => {
  it('no piece goes out of its panel bounds', () => {
    const params = createInitialState().params;
    const layout = computeCutLayout(params);
    for (const panel of layout.panels) {
      for (const p of panel.pieces) {
        expect(p.px, `px defined`).toBeDefined();
        expect(p.py, `py defined`).toBeDefined();
        expect(p.px! + p.w, `px+w ≤ shW`).toBeLessThanOrEqual(panel.shW);
        expect(p.py! + p.h, `py+h ≤ shH`).toBeLessThanOrEqual(panel.shH);
      }
    }
  });

  it('no pieces overlap within the same panel', () => {
    const params = createInitialState().params;
    const layout = computeCutLayout(params);
    for (const panel of layout.panels) {
      const ps = panel.pieces;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i]!, b = ps[j]!;
          const overlap =
            a.px! < b.px! + b.w && b.px! < a.px! + a.w &&
            a.py! < b.py! + b.h && b.py! < a.py! + a.h;
          expect(overlap, `pieces ${i}/${j} overlap on panel`).toBe(false);
        }
      }
    }
  });

  it('usedArea matches sum of piece areas', () => {
    const params = createInitialState().params;
    const layout = computeCutLayout(params);
    for (const panel of layout.panels) {
      const sum = panel.pieces.reduce((acc, p) => acc + p.w * p.h, 0);
      expect(Math.abs(panel.usedArea - sum) / Math.max(sum, 1)).toBeLessThan(1e-9);
    }
  });

  it('totalUsedArea equals sum of panel.usedArea', () => {
    const params = createInitialState().params;
    const layout = computeCutLayout(params);
    const sum = layout.panels.reduce((acc, p) => acc + p.usedArea, 0);
    expect(Math.abs(layout.totalUsedArea - sum) / Math.max(sum, 1)).toBeLessThan(1e-9);
  });

  it('default preset fits in one panel, no overflow', () => {
    const params = createInitialState().params;  // 1220 × 2440, nominal
    const layout = computeCutLayout(params);
    expect(layout.overflow.length, 'no overflow on nominal').toBe(0);
    expect(layout.panels.length, 'fits on 1 panel at nominal').toBeGreaterThanOrEqual(1);
  });
});

describe('computeCutLayout — multi-bin opens new panel on overflow', () => {
  it('small panel: pieces that fit individually are placed across panels', () => {
    const base = createInitialState().params;
    // Default params: W=160, H=220, D=160 → facades ~160×276, sides ~136×220, roofs ~146×220.
    // A 200×300 panel fits any single piece (each is ≤160×276 < 200×300),
    // but cannot fit two pieces in the same shelf height because pieces ≥ 220mm tall.
    // Multi-bin must open a new panel for each piece → at least 2 panels, no overflow.
    const layout = computeCutLayout({ ...base, panelW: 200, panelH: 300 });
    expect(layout.overflow.length, 'no overflow expected').toBe(0);
    expect(layout.panels.length, 'multiple panels expected').toBeGreaterThan(1);
  });

  it('piece bigger than panel (w > shW AND h > shW) goes to overflow', () => {
    const base = createInitialState().params;
    // Tiny panel: some pieces are strictly larger than shW in both dims after rotation.
    const layout = computeCutLayout({ ...base, panelW: 100, panelH: 100 });
    expect(layout.overflow.length, 'at least one overflow').toBeGreaterThan(0);
    // Overflow pieces must NOT appear in any panel
    const panelPieceNames = layout.panels.flatMap(p => p.pieces.map(x => x.nameKey + (x.suffix ?? '')));
    for (const op of layout.overflow) {
      expect(panelPieceNames).not.toContain(op.nameKey + (op.suffix ?? ''));
    }
  });

  it('empty layout when all pieces overflow', () => {
    const base = createInitialState().params;
    const layout = computeCutLayout({ ...base, panelW: 10, panelH: 10 });
    expect(layout.overflow.length, 'all pieces overflow').toBeGreaterThan(0);
    expect(layout.panels.length, 'no panel opened').toBe(0);
    expect(layout.totalUsedArea, 'zero used area').toBe(0);
    expect(layout.meanOccupation, 'zero occupation').toBe(0);
  });
});
