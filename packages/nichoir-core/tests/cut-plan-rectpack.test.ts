import { describe, it, expect } from 'vitest';
import { computeCutLayoutRectpack, createInitialState } from '../src/index.js';

describe('computeCutLayoutRectpack — shape + invariants', () => {
  it('returns CutLayout with 4 required fields', () => {
    const params = createInitialState().params;
    const layout = computeCutLayoutRectpack(params);
    expect(Array.isArray(layout.panels)).toBe(true);
    expect(Array.isArray(layout.overflow)).toBe(true);
    expect(typeof layout.totalUsedArea).toBe('number');
    expect(typeof layout.meanOccupation).toBe('number');
  });

  it('default preset: no overflow, at least 1 panel', () => {
    const params = createInitialState().params;
    const layout = computeCutLayoutRectpack(params);
    expect(layout.overflow.length).toBe(0);
    expect(layout.panels.length).toBeGreaterThanOrEqual(1);
  });

  it('no pieces overlap within a panel', () => {
    const params = createInitialState().params;
    const layout = computeCutLayoutRectpack(params);
    for (const panel of layout.panels) {
      const ps = panel.pieces;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i]!, b = ps[j]!;
          const overlap =
            a.px! < b.px! + b.w && b.px! < a.px! + a.w &&
            a.py! < b.py! + b.h && b.py! < a.py! + a.h;
          expect(overlap, `pieces ${i}/${j} overlap in rectpack layout`).toBe(false);
        }
      }
    }
  });

  it('all pieces inside panel bounds', () => {
    const params = createInitialState().params;
    const layout = computeCutLayoutRectpack(params);
    for (const panel of layout.panels) {
      for (const p of panel.pieces) {
        expect(p.px).toBeDefined();
        expect(p.py).toBeDefined();
        expect(p.px! + p.w).toBeLessThanOrEqual(panel.shW);
        expect(p.py! + p.h).toBeLessThanOrEqual(panel.shH);
      }
    }
  });

  it('usedArea equals sum of piece areas per panel', () => {
    const params = createInitialState().params;
    const layout = computeCutLayoutRectpack(params);
    for (const panel of layout.panels) {
      const sum = panel.pieces.reduce((acc, p) => acc + p.w * p.h, 0);
      expect(Math.abs(panel.usedArea - sum) / Math.max(sum, 1)).toBeLessThan(1e-9);
    }
  });

  it('piece strictly bigger than panel goes to overflow', () => {
    const base = createInitialState().params;
    const layout = computeCutLayoutRectpack({ ...base, panelW: 100, panelH: 100 });
    expect(layout.overflow.length).toBeGreaterThan(0);
    const panelPieceNames = layout.panels.flatMap(p => p.pieces.map(x => x.nameKey + (x.suffix ?? '')));
    for (const op of layout.overflow) {
      expect(panelPieceNames).not.toContain(op.nameKey + (op.suffix ?? ''));
    }
  });

  it('multi-bin: narrow panel forces multiple panels', () => {
    const base = createInitialState().params;
    const layout = computeCutLayoutRectpack({ ...base, panelW: 200, panelH: 300 });
    expect(layout.overflow.length).toBe(0);
    expect(layout.panels.length).toBeGreaterThan(1);
  });

  it('all pieces overflow → no panels, zero used area', () => {
    const base = createInitialState().params;
    const layout = computeCutLayoutRectpack({ ...base, panelW: 10, panelH: 10 });
    expect(layout.overflow.length).toBeGreaterThan(0);
    expect(layout.panels.length).toBe(0);
    expect(layout.totalUsedArea).toBe(0);
    expect(layout.meanOccupation).toBe(0);
  });
});
