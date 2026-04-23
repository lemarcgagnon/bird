import { describe, it, expect } from 'vitest';
import { PALETTES, hexToNumber } from '../src/palettes.js';
import { createInitialState, buildPanelDefs, computeCutLayout } from '../src/index.js';

describe('palettes', () => {
  it('wood palette preserves historical hex values bit-to-bit', () => {
    const pal = PALETTES.wood;
    expect(pal.facade).toBe('#d4a574');
    expect(pal.side).toBe('#c49464');
    expect(pal.bottom).toBe('#b48454');
    expect(pal.roof).toBe('#9e7044');
    expect(pal.door).toBe('#e8c088');
  });

  it('hexToNumber converts correctly', () => {
    expect(hexToNumber('#d4a574')).toBe(0xd4a574);
    expect(hexToNumber('#000000')).toBe(0);
    expect(hexToNumber('#ffffff')).toBe(0xffffff);
    expect(hexToNumber('#FFFFFF')).toBe(0xffffff);
  });

  it('buildPanelDefs with palette=wood produces historical color numbers', () => {
    const state = createInitialState();
    // palette defaults to 'wood' — verify the historical numbers
    const result = buildPanelDefs(state);
    const front = result.defs.find((d) => d.key === 'front');
    const left  = result.defs.find((d) => d.key === 'left');
    const roofL = result.defs.find((d) => d.key === 'roofL');
    expect(front?.color).toBe(0xd4a574);
    expect(left?.color).toBe(0xc49464);
    expect(roofL?.color).toBe(0x9e7044);
  });

  it('buildPanelDefs with palette=colorful applies colorful roof color', () => {
    const state = createInitialState();
    state.params.palette = 'colorful';
    const result = buildPanelDefs(state);
    const roofL = result.defs.find((d) => d.key === 'roofL');
    const roofR = result.defs.find((d) => d.key === 'roofR');
    // colorful roof = '#d2691e' = 0xd2691e
    expect(roofL?.color).toBe(hexToNumber('#d2691e'));
    expect(roofR?.color).toBe(hexToNumber('#d2691e'));
  });

  it('computeCutLayout with palette=wood produces historical hex strings in LayoutPiece.color', () => {
    const state = createInitialState();
    // palette='wood' is the default
    const layout = computeCutLayout(state.params);
    // Panels with pieces (no overflow in default config)
    const allPieces = layout.panels.flatMap((p) => p.pieces);
    const facade = allPieces.find((p) => p.nameKey === 'calc.cuts.facade');
    const side   = allPieces.find((p) => p.nameKey === 'calc.cuts.side');
    const bottom = allPieces.find((p) => p.nameKey === 'calc.cuts.bottom');
    const roof   = allPieces.find((p) => p.nameKey === 'calc.cuts.roofL');
    expect(facade?.color).toBe('#d4a574');
    expect(side?.color).toBe('#c49464');
    expect(bottom?.color).toBe('#b48454');
    expect(roof?.color).toBe('#9e7044');
  });

  it('computeCutLayout with palette=mono produces gray hex strings in LayoutPiece.color', () => {
    const state = createInitialState();
    state.params.palette = 'mono';
    const layout = computeCutLayout(state.params);
    const allPieces = layout.panels.flatMap((p) => p.pieces);
    const facade = allPieces.find((p) => p.nameKey === 'calc.cuts.facade');
    expect(facade?.color).toBe('#d0d0d0');
  });
});
