# Multi-Bin Cut Plan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `@nichoir/core`'s `computeCutLayout` to place pieces across multiple panels (multi-bin) instead of flagging overflow on a single panel, and update the UI + exporters + fixtures accordingly.

**Architecture:** New `Panel` type in the public contract. `CutLayout` becomes `{ panels: Panel[], overflow, totalUsedArea, meanOccupation }`. `cut-plan.ts` loops: on placement failure, open a new panel. UI renders N panel cards via a shared `CutLayoutRenderer`. Export SVG produces a ZIP with one SVG per panel. Legacy src/* JS is untouched; fixtures regenerate their `cutLayout` section from the new TS port (hybrid capture, same pattern as D/E).

**Tech Stack:** TypeScript 5.4, vitest, React 19, JSZip 3.10, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-04-23-multi-bin-cut-plan-design.md`

**Branch:** `multi-bin` (off `main`, to be merged into `main` before branch `coupe` starts).

---

## File Structure

### Created
- `packages/nichoir-ui/src/components/cut-plan/CutLayoutRenderer.tsx` — shared SVG renderer for N panels. Consumed by PlanTab (this branch) and PlanTab2 (branch coupe later).
- `packages/nichoir-ui/src/components/cut-plan/PanelCard.tsx` — card for one panel (header + SVG inline).
- `packages/nichoir-ui/src/components/cut-plan/OverflowBanner.tsx` — warning banner when pieces exceed panel dimensions.
- `packages/nichoir-core/src/exporters/plan-zip.ts` — produces ZIP with one SVG per panel.
- `runs/<YYYY-MM-DD>-multibin/` — evidence document + screenshots + metrics.

### Modified
- `packages/nichoir-core/src/types.ts` — `Panel` interface added; `CutLayout` reshaped; `LayoutPiece.overflow` removed.
- `packages/nichoir-core/src/cut-plan.ts` — multi-bin loop.
- `packages/nichoir-core/src/exporters/svg.ts` — accepts a `Panel` (not whole `CutLayout`), returns SVG for one panel. Multi-panel aggregation moves to `plan-zip.ts`.
- `packages/nichoir-core/src/index.ts` — export the new `generatePlanZIP` + `Panel` type.
- `packages/nichoir-core/CONTRACTS.md` — bump to 0.2.0, update types section.
- `packages/nichoir-core/package.json` — version `0.2.0`.
- `packages/nichoir-core/tests/cut-layout.test.ts` — adapted to new type.
- `packages/nichoir-core/tests/exporters.test.ts` — adapted for `generatePlanSVG(panel, ...)` + new `generatePlanZIP`.
- `packages/nichoir-core/tests/fixtures/capture-reference.mjs` — hybrid capture (uses TS `dist/` for `cutLayout`).
- `packages/nichoir-core/tests/fixtures/preset{A..E}.snapshot.json` — regenerated (`cutLayout` section only).
- `packages/nichoir-core/tests/fixtures/README.md` — updated MD5 + note the post-P1 regeneration approved by user.
- `packages/nichoir-ui/src/components/tabs/PlanCanvasSection.tsx` — delegate to `CutLayoutRenderer`.
- `packages/nichoir-ui/src/components/tabs/PlanStatsSection.tsx` — aggregate stats (N panels, mean occupation, overflow count).
- `packages/nichoir-ui/src/components/tabs/ExportPlanSection.tsx` — call `generatePlanZIP` and download `.zip` instead of `.svg`.
- `packages/nichoir-ui/src/i18n/messages.ts` — new keys (fr+en).
- `packages/nichoir-ui/tests/PlanTab.test.tsx` — adapted (one svg per panel now).
- `README.md` — mention multi-bin.
- `HANDOVER.md` — note breaking change + version bump.

---

## Task 0: Branch setup

**Files:** none created, git state only.

- [ ] **Step 0.1: Verify on main with clean tree**

Run:
```bash
git status
git branch --show-current
```

Expected: `On branch main`, `nothing to commit, working tree clean` (except `hig-review.md` which is unrelated).

- [ ] **Step 0.2: Create and checkout the `multi-bin` branch**

Run:
```bash
git checkout -b multi-bin
git branch --show-current
```

Expected: `multi-bin`.

- [ ] **Step 0.3: Create the runs folder for this branch**

```bash
mkdir -p runs/2026-04-23-multibin/state runs/2026-04-23-multibin/artifacts
```

Create `runs/2026-04-23-multibin/TASK.md`:

```markdown
# TASK — Multi-bin refactor of computeCutLayout

**Branche** : `multi-bin`
**Spec** : `docs/superpowers/specs/2026-04-23-multi-bin-cut-plan-design.md`
**Plan** : `docs/superpowers/plans/2026-04-23-multi-bin-cut-plan.md`

## Résumé
Migration du shelf-packing vers multi-bin dans `@nichoir/core`. Breaking change
du contrat `CutLayout`. Mise à jour UI, exporters, fixtures.

## Contraintes
- Aucun changement dans `src/*` legacy (préserve parité v15).
- Fixtures immutables sauf section `cutLayout` (approuvée par user).
- `pnpm -r typecheck/test/lint/build` tous verts avant merge.
- Evidence document écrit avant de déclarer succès.

## Critères d'acceptance
Voir spec section 8.
```

Create `runs/2026-04-23-multibin/PLAN.md`:

```markdown
Voir `docs/superpowers/plans/2026-04-23-multi-bin-cut-plan.md`.
```

- [ ] **Step 0.4: Commit the scaffolding**

```bash
git add runs/2026-04-23-multibin/
git commit -m "chore(multi-bin) — scaffold run folder TASK+PLAN"
```

---

## Task 1: Add `Panel` type + reshape `CutLayout`

**Files:**
- Modify: `packages/nichoir-core/src/types.ts` (lines 176-192 = LayoutPiece + CutLayout)

**Goal:** Make the new types available before implementing the algorithm. No behavior change yet — algorithm still uses old fields, will be rewritten in Task 2.

- [ ] **Step 1.1: Reshape the types**

Open `packages/nichoir-core/src/types.ts`, locate the block around lines 176-192. Replace:

```ts
/**
 * LayoutPiece.nameKey est une CLÉ i18n opaque (ex: 'panel.front'),
 * résolue par le consumer via `Translator`. `computeCutLayout` ne traduit jamais.
 */
export interface LayoutPiece {
  nameKey: string;
  suffix?: string;
  w: number; h: number;
  color: string;
  shape: 'rect' | 'pent';
  rH?: number; wallH?: number; Wtop?: number; Wbot?: number;
  px?: number; py?: number;
  rot?: boolean;
  overflow?: boolean;
  idx?: number;
}
export interface CutLayout {
  pieces: LayoutPiece[];
  shW: number; shH: number;
  totalArea: number;
}
```

with:

```ts
/**
 * LayoutPiece.nameKey est une CLÉ i18n opaque (ex: 'panel.front'),
 * résolue par le consumer via `Translator`. `computeCutLayout` ne traduit jamais.
 *
 * Les coordonnées `px, py` sont RELATIVES au panneau qui contient la pièce
 * (Panel.pieces). Une pièce dans `CutLayout.overflow` n'a ni `px`, ni `py`,
 * ni `rot` : elle est plus grande que le panneau lui-même.
 */
export interface LayoutPiece {
  nameKey: string;
  suffix?: string;
  w: number; h: number;
  color: string;
  shape: 'rect' | 'pent';
  rH?: number; wallH?: number; Wtop?: number; Wbot?: number;
  px?: number; py?: number;
  rot?: boolean;
  idx?: number;
}

/**
 * Un panneau physique de contreplaqué. Toutes les `pieces` y sont placées
 * dans les bornes `[0, shW] × [0, shH]` avec leurs coordonnées relatives.
 */
export interface Panel {
  pieces: LayoutPiece[];
  shW: number;
  shH: number;
  usedArea: number;     // somme des (w * h) des pièces placées
  occupation: number;   // usedArea / (shW * shH), ∈ [0, 1]
}

/**
 * Résultat de `computeCutLayout`.
 * - `panels` : 1..N panneaux physiques. Vide si toutes les pièces sont en overflow.
 * - `overflow` : pièces plus grandes que le panneau lui-même (w > shW && h > shW).
 *                Jamais placées, jamais dessinées dans un panneau.
 */
export interface CutLayout {
  panels: Panel[];
  overflow: LayoutPiece[];
  totalUsedArea: number;
  meanOccupation: number;
}
```

- [ ] **Step 1.2: Typecheck** — expect many errors (cut-plan.ts, exporters, UI still use old fields).

Run:
```bash
pnpm -r typecheck
```

Expected: FAIL with errors in `cut-plan.ts`, `exporters/svg.ts`, `PlanCanvasSection.tsx`, `PlanStatsSection.tsx`, `PlanTab.test.tsx`, `cut-layout.test.ts`. Acceptable — Tasks 2-12 fix each site.

- [ ] **Step 1.3: No commit yet** — types are incomplete without the algorithm. Continue to Task 2.

---

## Task 2: Rewrite `computeCutLayout` to multi-bin (TDD)

**Files:**
- Modify: `packages/nichoir-core/src/cut-plan.ts`
- Modify: `packages/nichoir-core/tests/cut-layout.test.ts`

**Goal:** The loop closes the current panel and opens a new one when a piece does not fit, instead of flagging `overflow`. Pieces bigger than the panel itself go into `CutLayout.overflow`.

- [ ] **Step 2.1: Rewrite the existing tests for new shape**

Replace the entire content of `packages/nichoir-core/tests/cut-layout.test.ts` with:

```ts
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
        const actPanel = result.panels[p];
        const expPanel = expected.panels[p];
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
          const a = ps[i], b = ps[j];
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
  it('narrow but tall panel: pieces that fit individually are placed across panels', () => {
    const base = createInitialState().params;
    // Panel big enough for each piece individually but not all together
    // Roof pieces are ~1240×260, facades ~220×~300, sides ~140×~280 → fits on 500×2440 × N panels.
    const layout = computeCutLayout({ ...base, panelW: 500, panelH: 2440 });
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
```

- [ ] **Step 2.2: Run tests to confirm they fail**

Run:
```bash
pnpm -C packages/nichoir-core test cut-layout
```

Expected: FAIL. The fixture file still has the OLD `cutLayout` shape (`pieces`, `shW`, `shH`, `totalArea`), and the algorithm still produces the old shape. We fix the algorithm in Step 2.3; fixtures will be regenerated in Task 4.

- [ ] **Step 2.3: Rewrite `cut-plan.ts` with multi-bin loop**

Replace the entire content of `packages/nichoir-core/src/cut-plan.ts` with:

```ts
// src/cut-plan.ts
// Layout 2D multi-bin (shelf-packing).
// Multi-bin : quand une pièce ne rentre pas sur le panneau courant,
// on ferme ce panneau et on en ouvre un nouveau. Une pièce plus grande
// que le panneau lui-même atterrit dans `overflow`, jamais dans un panneau.

import type { Params, CutLayout, LayoutPiece, Panel } from './types.js';

const D2R = Math.PI / 180;
const GAP = 5;

interface WorkingPiece extends LayoutPiece {
  _w0: number;  // largeur originale
  _h0: number;  // hauteur originale
}

/** Construit la cut list des 7 pièces (+ 1 optionnelle porte) depuis `params`. */
function buildCutList(params: Params): WorkingPiece[] {
  const { W, D, slope, overhang, T, floor, ridge, taperX, door, doorPanel, doorW, doorH, doorVar } = params;
  const ang = slope * D2R;
  const isPose = floor === 'pose';
  const H = params.H;
  const wallH = isPose ? H - T : H;
  const rH = (W / 2) * Math.tan(ang);
  const sL = (W / 2 + overhang) / Math.cos(ang);
  const rL = D + 2 * overhang;
  const bev = T * Math.tan(ang);
  const sL_L = ridge === 'left' ? sL + T : sL;
  const sL_R = ridge === 'right' ? sL + T : sL;
  const Wtop = W;
  const Wbot = W + 2 * taperX;
  const wallHreal = Math.sqrt(wallH * wallH + taperX * taperX);
  const floorW = isPose ? Wbot : Wbot - 2 * T;
  const floorD = isPose ? D : D - 2 * T;
  const sideD = D - 2 * T;
  const Wmax = Math.max(Wtop, Wbot);

  const pieces: WorkingPiece[] = [
    { nameKey: 'calc.cuts.facade', suffix: ' 1', w: Wmax, h: wallH + rH, color: '#d4a574', shape: 'pent', rH, wallH, Wtop, Wbot, _w0: Wmax, _h0: wallH + rH },
    { nameKey: 'calc.cuts.facade', suffix: ' 2', w: Wmax, h: wallH + rH, color: '#d4a574', shape: 'pent', rH, wallH, Wtop, Wbot, _w0: Wmax, _h0: wallH + rH },
    { nameKey: 'calc.cuts.side',   suffix: ' G', w: sideD, h: wallHreal, color: '#c49464', shape: 'rect', _w0: sideD, _h0: wallHreal },
    { nameKey: 'calc.cuts.side',   suffix: ' D', w: sideD, h: wallHreal, color: '#c49464', shape: 'rect', _w0: sideD, _h0: wallHreal },
    { nameKey: 'calc.cuts.bottom', w: floorW, h: floorD, color: '#b48454', shape: 'rect', _w0: floorW, _h0: floorD },
    { nameKey: 'calc.cuts.roofL',  w: sL_L + (ridge === 'miter' ? bev : 0), h: rL, color: '#9e7044', shape: 'rect', _w0: sL_L + (ridge === 'miter' ? bev : 0), _h0: rL },
    { nameKey: 'calc.cuts.roofR',  w: sL_R + (ridge === 'miter' ? bev : 0), h: rL, color: '#9e7044', shape: 'rect', _w0: sL_R + (ridge === 'miter' ? bev : 0), _h0: rL },
  ];
  if (door !== 'none' && doorPanel) {
    const v = doorVar / 100;
    const w = doorW * v, h = doorH * v;
    pieces.push({ nameKey: 'calc.cuts.door', w, h, color: '#e8c088', shape: 'rect', _w0: w, _h0: h });
  }
  return pieces;
}

/** Vrai si la pièce est plus grande que le panneau, même en rotation. */
function isPieceTooBig(p: WorkingPiece, shW: number, shH: number): boolean {
  const fitsNormal = p._w0 + 2 * GAP <= shW && p._h0 + 2 * GAP <= shH;
  const fitsRotated = p._h0 + 2 * GAP <= shW && p._w0 + 2 * GAP <= shH;
  return !fitsNormal && !fitsRotated;
}

interface PanelState {
  pieces: LayoutPiece[];
  shelfY: number;
  shelfH: number;
  curX: number;
}

function emptyPanelState(): PanelState {
  return { pieces: [], shelfY: GAP, shelfH: 0, curX: GAP };
}

/** Essaie de placer `p` dans l'état panel courant. Muter `p` et `ps` si succès. Retourne `true` si placé. */
function tryPlace(p: WorkingPiece, ps: PanelState, shW: number, shH: number): boolean {
  const pw0 = p._w0, ph0 = p._h0;

  // Même ligne, orientation normale
  if (ps.curX + pw0 + GAP <= shW && ps.shelfY + ph0 + GAP <= shH) {
    p.px = ps.curX; p.py = ps.shelfY; p.rot = false;
    p.w = pw0; p.h = ph0;
    ps.curX += pw0 + GAP;
    ps.shelfH = Math.max(ps.shelfH, ph0);
    ps.pieces.push(p);
    return true;
  }
  // Même ligne, orientation pivotée
  if (ps.curX + ph0 + GAP <= shW && ps.shelfY + pw0 + GAP <= shH) {
    p.px = ps.curX; p.py = ps.shelfY; p.rot = true;
    p.w = ph0; p.h = pw0;
    ps.curX += ph0 + GAP;
    ps.shelfH = Math.max(ps.shelfH, pw0);
    ps.pieces.push(p);
    return true;
  }
  // Nouvelle ligne, orientation normale
  const nextY = ps.shelfY + ps.shelfH + GAP;
  if (pw0 + 2 * GAP <= shW && nextY + ph0 + GAP <= shH) {
    ps.shelfY = nextY;
    ps.shelfH = ph0;
    ps.curX = pw0 + 2 * GAP;
    p.px = GAP; p.py = ps.shelfY; p.rot = false;
    p.w = pw0; p.h = ph0;
    ps.pieces.push(p);
    return true;
  }
  // Nouvelle ligne, orientation pivotée
  if (ph0 + 2 * GAP <= shW && nextY + pw0 + GAP <= shH) {
    ps.shelfY = nextY;
    ps.shelfH = pw0;
    ps.curX = ph0 + 2 * GAP;
    p.px = GAP; p.py = ps.shelfY; p.rot = true;
    p.w = ph0; p.h = pw0;
    ps.pieces.push(p);
    return true;
  }
  return false;
}

function panelFromState(ps: PanelState, shW: number, shH: number): Panel {
  const usedArea = ps.pieces.reduce((acc, p) => acc + p.w * p.h, 0);
  return {
    pieces: ps.pieces,
    shW,
    shH,
    usedArea,
    occupation: shW * shH > 0 ? usedArea / (shW * shH) : 0,
  };
}

export function computeCutLayout(params: Params): CutLayout {
  const shW = params.panelW;
  const shH = params.panelH;
  const allPieces = buildCutList(params);

  // Tri par hauteur desc (conserve l'ordre historique du shelf-packing).
  const sorted = allPieces
    .map((p, i) => ({ ...p, idx: i }))
    .sort((a, b) => b._h0 - a._h0);

  const overflow: LayoutPiece[] = [];
  const panels: Panel[] = [];
  let current: PanelState | null = null;

  for (const p of sorted) {
    if (isPieceTooBig(p, shW, shH)) {
      // Strip working fields before returning
      const { _w0, _h0, ...clean } = p;
      void _w0; void _h0;
      overflow.push(clean);
      continue;
    }
    if (current === null) {
      current = emptyPanelState();
    }
    if (!tryPlace(p, current, shW, shH)) {
      // Close current, open a new one. A piece that is NOT too big must fit on an empty panel.
      panels.push(panelFromState(current, shW, shH));
      current = emptyPanelState();
      const placed = tryPlace(p, current, shW, shH);
      if (!placed) {
        // Defense in depth — should not happen since isPieceTooBig returned false.
        const { _w0, _h0, ...clean } = p;
        void _w0; void _h0;
        overflow.push(clean);
      }
    }
  }
  if (current !== null && current.pieces.length > 0) {
    panels.push(panelFromState(current, shW, shH));
  }

  // Strip working fields from all placed pieces.
  for (const panel of panels) {
    panel.pieces = panel.pieces.map(p => {
      const q = p as unknown as WorkingPiece;
      const { _w0, _h0, ...clean } = q;
      void _w0; void _h0;
      return clean;
    });
  }

  const totalUsedArea = panels.reduce((acc, p) => acc + p.usedArea, 0);
  const meanOccupation = panels.length === 0
    ? 0
    : panels.reduce((acc, p) => acc + p.occupation, 0) / panels.length;

  return { panels, overflow, totalUsedArea, meanOccupation };
}
```

- [ ] **Step 2.4: Run typecheck to check core compiles**

Run:
```bash
pnpm -C packages/nichoir-core typecheck
```

Expected: only errors in `src/exporters/svg.ts` (still uses old `CutLayout.pieces`) and none in `cut-plan.ts`. If there are other errors in cut-plan.ts, fix them.

- [ ] **Step 2.5: Run the invariant tests (they don't depend on fixtures)**

Run:
```bash
pnpm -C packages/nichoir-core test -t "computeCutLayout — invariants"
pnpm -C packages/nichoir-core test -t "computeCutLayout — multi-bin opens new panel"
```

Expected: PASS for all invariant + multi-bin tests. The fixture-based tests (`parity with fixture`) still FAIL — that's fine; fixtures will be regenerated in Task 4.

- [ ] **Step 2.6: Commit algorithm + tests**

```bash
git add packages/nichoir-core/src/types.ts packages/nichoir-core/src/cut-plan.ts packages/nichoir-core/tests/cut-layout.test.ts
git commit -m "feat(core) — computeCutLayout multi-bin + invariant tests

Breaking: CutLayout passe de { pieces, shW, shH, totalArea } à
{ panels: Panel[], overflow, totalUsedArea, meanOccupation }. LayoutPiece
perd le flag overflow (géré au niveau CutLayout).

Le shelf-packing loop ferme le panneau courant et en ouvre un nouveau
dès qu'une pièce ne rentre plus. Pièces > panneau vont dans overflow.

Les tests de parité fixture échoueront jusqu'à régénération (Task 4)."
```

---

## Task 3: User approval gate for fixture regeneration

**Files:** none; this is a synchronous gate.

**Goal:** Respect the fixture immutability rule in `tests/fixtures/README.md:120-127`. The user is the phase P1 manager; explicit approval is required before regeneration.

- [ ] **Step 3.1: Present the impact to the user**

Display to the user:

```
ATTENTION — Régénération des fixtures requise

Raison : le contrat CutLayout passe de { pieces, shW, shH, totalArea }
à { panels, overflow, totalUsedArea, meanOccupation }. La section
`reference.cutLayout` des 5 fichiers preset{A..E}.snapshot.json doit
être recapturée pour refléter le nouveau contrat.

Ce qui NE change PAS dans les fixtures :
- `state`, `calculations`, `cutList` : identiques, non touchés.
- `panelDefsNormalized`, `stlHouse`, `stlDoor`, `panelsZip` : identiques.
- `planSvg.{byteLength,polygonCount,rectCount,textCount}` :
  dépend du layout → sera recalculé mais pas affecté structurellement.

Ce qui change :
- `reference.cutLayout` : nouveau schéma.
- MD5 des 5 fixtures : nouveaux (à consigner dans README.md fixtures).

Règle immutabilité (tests/fixtures/README.md:120-127) :
Les fixtures sont immutables SAUF approbation explicite du gestionnaire
de phase P1. Tu ES ce gestionnaire.

Pour autoriser la régénération, réponds exactement :
"APPROUVE REGENERATION FIXTURES MULTIBIN"

Pour annuler, réponds n'importe quoi d'autre.
```

- [ ] **Step 3.2: Wait for user response**

If the user does NOT respond with the exact phrase `APPROUVE REGENERATION FIXTURES MULTIBIN`, STOP. Report incomplete. Do not proceed.

If the user DOES respond with that phrase, proceed to Task 4.

---

## Task 4: Adapt `capture-reference.mjs` + regenerate fixtures

**Files:**
- Modify: `packages/nichoir-core/tests/fixtures/capture-reference.mjs`
- Modify: `packages/nichoir-core/tests/fixtures/preset{A..E}.snapshot.json` (regenerated)
- Modify: `packages/nichoir-core/tests/fixtures/README.md` (updated MD5 + note)

- [ ] **Step 4.1: Pre-build the TS port so `dist/` is current**

Run:
```bash
pnpm -C packages/nichoir-core build
```

Expected: build OK. `dist/` now contains the multi-bin `computeCutLayout`.

- [ ] **Step 4.2: Patch `capture-reference.mjs` to use TS `dist/` for `cutLayout` across all presets**

Open `packages/nichoir-core/tests/fixtures/capture-reference.mjs`. At the top section where imports are declared (around line 33-45), below the TS dist imports, ADD:

```js
const { computeCutLayout: tsComputeCutLayout } = await import(path.join(TS_DIST, 'cut-plan.js'));
```

Then locate the `capturePreset` function. Find the block:

```js
  // ── Cut layout ──
  console.log(`  → computeCutLayout...`);
  const cutLayout = computeCutLayout(params);
```

Replace with:

```js
  // ── Cut layout ──
  // NOTE post-P1 : on capture depuis TS port pour tous les presets (A..E).
  // Raison : le contrat multi-bin est défini côté TS ; src/cut-plan.js reste
  // en single-bin (legacy, parité v15 préservée).
  console.log(`  → computeCutLayout (TS port multi-bin)...`);
  const cutLayout = tsComputeCutLayout(params);
```

Then locate the `buildSVGString` function (line ~248). This function takes `layout.pieces` etc. — the OLD shape. We must adapt. Replace the entire `buildSVGString` function with:

```js
// NOTE post-P1 : buildSVGString aggregate les N panneaux pour continuer à
// produire UNE chaîne SVG à fin de métriques (polygonCount, rectCount,
// textCount). Le format agrégé n'est PAS le format d'export final —
// l'export runtime produit un ZIP multi-SVG. On conserve l'agrégation ici
// uniquement pour que le champ `planSvg` de la fixture reste comparable.
function buildSVGString(layout) {
  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg">\n`;
  for (const panel of layout.panels) {
    svg += buildPanelSVG(panel);
  }
  svg += '</svg>\n';
  return svg;
}

function buildPanelSVG(panel) {
  const { pieces, shW, shH } = panel;
  let svg = `<g>`;
  svg += `<rect x="0" y="0" width="${shW}" height="${shH}" fill="none" stroke="#000" stroke-width="1"/>\n`;

  for (let g = 200; g < shW; g += 200) {
    svg += `<line x1="${g}" y1="0" x2="${g}" y2="${shH}" stroke="#ddd" stroke-width="0.3"/>\n`;
  }
  for (let g = 200; g < shH; g += 200) {
    svg += `<line x1="0" y1="${g}" x2="${shW}" y2="${g}" stroke="#ddd" stroke-width="0.3"/>\n`;
  }

  pieces.forEach(p => {
    if (p.px === undefined) return;
    const x = p.px, y = p.py, w = p.w, h = p.h;
    const stroke = '#000';
    const fill = p.color + '40';

    if (p.shape === 'pent' && !p.rot) {
      const wHs = p.wallH;
      const Wb = p.Wbot || p.w;
      const Wt = p.Wtop || p.w;
      const inset = (Wb - Wt) / 2;
      const pts = [
        [x,              y + h],
        [x + Wb,         y + h],
        [x + Wb - inset, y + h - wHs],
        [x + Wb / 2,     y],
        [x + inset,      y + h - wHs],
      ];
      svg += `<polygon points="${pts.map(pt => pt.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>\n`;
    } else {
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>\n`;
    }

    const origW = p.rot ? p.h : p.w;
    const origH = p.rot ? p.w : p.h;
    const cx = x + w / 2, cy = y + h / 2;
    const fs = Math.min(20, Math.max(8, w * 0.08));
    const name = t(p.nameKey) + (p.suffix || '');
    svg += `<text x="${cx}" y="${cy - fs * 0.5}" font-family="sans-serif" font-size="${fs}" text-anchor="middle" fill="#000">${name}</text>\n`;
    svg += `<text x="${cx}" y="${cy + fs * 0.8}" font-family="sans-serif" font-size="${fs * 0.8}" text-anchor="middle" fill="#555">${Math.round(origW)}×${Math.round(origH)} mm</text>\n`;
    if (p.rot) {
      svg += `<text x="${cx}" y="${cy + fs * 2}" font-family="sans-serif" font-size="${fs * 0.7}" text-anchor="middle" fill="#888">${t('plan.rotated')}</text>\n`;
    }
  });

  svg += `</g>`;
  return svg;
}
```

Then locate the `fixture.reference.cutLayout` assignment (around line 549-554):

```js
      cutLayout: {
        pieces: cutLayout.pieces,
        shW: cutLayout.shW,
        shH: cutLayout.shH,
        totalArea: cutLayout.totalArea,
      },
```

Replace with:

```js
      cutLayout: {
        panels: cutLayout.panels,
        overflow: cutLayout.overflow,
        totalUsedArea: cutLayout.totalUsedArea,
        meanOccupation: cutLayout.meanOccupation,
      },
```

- [ ] **Step 4.3: Run the capture script to regenerate all 5 fixtures**

Run:
```bash
cd packages/nichoir-core
node tests/fixtures/capture-reference.mjs
cd -
```

Expected: `✓ preset{A..E}.snapshot.json écrit`. No errors.

- [ ] **Step 4.4: Compute new MD5s**

Run:
```bash
md5sum packages/nichoir-core/tests/fixtures/*.snapshot.json
```

Copy the 5 new MD5 values.

- [ ] **Step 4.5: Update `tests/fixtures/README.md`**

Open `packages/nichoir-core/tests/fixtures/README.md`. Find the MD5 block (line 38-45). Replace the 5 lines with the new MD5s from Step 4.4. Add a note below the block:

```
**Régénération 2026-04-23 (branche `multi-bin`)** :
Section `reference.cutLayout` régénérée pour refléter le nouveau contrat
multi-bin `{ panels, overflow, totalUsedArea, meanOccupation }`. Les autres
sections (`state`, `calculations`, `cutList`, `panelDefsNormalized`,
`stlHouse`, `stlDoor`, `panelsZip`, `planSvg`) sont inchangées structurellement.
Régénération approuvée explicitement par gestionnaire de phase (user).
```

- [ ] **Step 4.6: Run the full cut-layout test suite (parity should now pass)**

Run:
```bash
pnpm -C packages/nichoir-core test cut-layout
```

Expected: ALL tests PASS (parity A/B/C + invariants + multi-bin branches).

- [ ] **Step 4.7: Commit**

```bash
git add packages/nichoir-core/tests/fixtures/
git commit -m "feat(fixtures) — régénère section cutLayout pour contrat multi-bin

capture-reference.mjs bascule sur TS port (dist/) pour computeCutLayout,
pattern identique à D/E. Les 4 autres sections des fixtures restent
identiques (calculations, cutList, panelDefs, STL, ZIP, planSvg metrics).

MD5 mis à jour. Régénération approuvée explicitement par user (gestionnaire
de phase P1), documentée dans README.md fixtures."
```

---

## Task 5: Update SVG exporter to per-panel

**Files:**
- Modify: `packages/nichoir-core/src/exporters/svg.ts`
- Modify: `packages/nichoir-core/tests/exporters.test.ts`

**Goal:** `generatePlanSVG` consumes a single `Panel` (not whole `CutLayout`). The per-panel SVG is what the ZIP exporter (next task) bundles.

- [ ] **Step 5.1: Rewrite `svg.ts` signature**

Replace the content of `packages/nichoir-core/src/exporters/svg.ts` with:

```ts
// src/exporters/svg.ts
//
// Génère la string SVG d'UN panneau du plan de coupe. Retourne une string —
// le trigger du download (ZIP multi-SVG) est dans `exporters/plan-zip.ts`.
//
// Le contrat multi-bin implique un SVG par panneau (pas un SVG unique
// multi-pages — ce format n'existe pas en SVG).

import type { Panel, Translator } from '../types.js';

/**
 * Génère la string SVG d'un panneau unique.
 * `translate` résout les noms de pièces via `p.nameKey` et le label "pivoté"
 * via `'plan.rotated'`.
 */
export function generatePlanSVG(panel: Panel, translate: Translator): string {
  const { pieces, shW, shH } = panel;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${shW}mm" height="${shH}mm" viewBox="0 0 ${shW} ${shH}">\n`;
  svg += `<title>Nichoir - Plan de coupe ${shW} x ${shH} mm</title>\n`;
  svg += `<rect x="0" y="0" width="${shW}" height="${shH}" fill="none" stroke="#000" stroke-width="1"/>\n`;

  for (let g = 200; g < shW; g += 200) {
    svg += `<line x1="${g}" y1="0" x2="${g}" y2="${shH}" stroke="#ddd" stroke-width="0.3"/>\n`;
  }
  for (let g = 200; g < shH; g += 200) {
    svg += `<line x1="0" y1="${g}" x2="${shW}" y2="${g}" stroke="#ddd" stroke-width="0.3"/>\n`;
  }

  pieces.forEach(p => {
    if (p.px === undefined) return;
    const x = p.px, y = p.py!, w = p.w, h = p.h;
    const stroke = '#000';
    const fill = p.color + '40';

    if (p.shape === 'pent' && !p.rot) {
      const wHs = p.wallH!;
      const Wb = p.Wbot ?? p.w;
      const Wt = p.Wtop ?? p.w;
      const inset = (Wb - Wt) / 2;
      const pts: Array<[number, number]> = [
        [x,              y + h],
        [x + Wb,         y + h],
        [x + Wb - inset, y + h - wHs],
        [x + Wb / 2,     y],
        [x + inset,      y + h - wHs],
      ];
      svg += `<polygon points="${pts.map(pt => pt.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>\n`;
    } else {
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>\n`;
    }

    const origW = p.rot ? p.h : p.w;
    const origH = p.rot ? p.w : p.h;
    const cx = x + w / 2, cy = y + h / 2;
    const fs = Math.min(20, Math.max(8, w * 0.08));
    const name = translate(p.nameKey) + (p.suffix ?? '');
    svg += `<text x="${cx}" y="${cy - fs * 0.5}" font-family="sans-serif" font-size="${fs}" text-anchor="middle" fill="#000">${name}</text>\n`;
    svg += `<text x="${cx}" y="${cy + fs * 0.8}" font-family="sans-serif" font-size="${fs * 0.8}" text-anchor="middle" fill="#555">${Math.round(origW)}×${Math.round(origH)} mm</text>\n`;
    if (p.rot) {
      svg += `<text x="${cx}" y="${cy + fs * 2}" font-family="sans-serif" font-size="${fs * 0.7}" text-anchor="middle" fill="#888">${translate('plan.rotated')}</text>\n`;
    }
  });

  svg += '</svg>\n';
  return svg;
}
```

- [ ] **Step 5.2: Adapt `exporters.test.ts`**

Open `packages/nichoir-core/tests/exporters.test.ts`. Find tests for `generatePlanSVG`. Locate calls of the form `generatePlanSVG(layout, ...)` and replace with `generatePlanSVG(layout.panels[0], ...)` to pass a single panel. If test logic expects multi-panel metrics from `generatePlanSVG`, move that logic to call on each panel separately.

Run tests to see the actual failing spots:
```bash
pnpm -C packages/nichoir-core test exporters
```

Adjust as needed. The goal is: each test assertion maps to one panel.

- [ ] **Step 5.3: Run tests**

```bash
pnpm -C packages/nichoir-core test exporters
```

Expected: PASS.

- [ ] **Step 5.4: Commit**

```bash
git add packages/nichoir-core/src/exporters/svg.ts packages/nichoir-core/tests/exporters.test.ts
git commit -m "refactor(core/exporters) — generatePlanSVG prend un Panel, pas un CutLayout"
```

---

## Task 6: New `plan-zip.ts` exporter

**Files:**
- Create: `packages/nichoir-core/src/exporters/plan-zip.ts`
- Modify: `packages/nichoir-core/src/index.ts`
- Modify: `packages/nichoir-core/tests/exporters.test.ts`

**Goal:** Produce a ZIP of N `.svg` files (one per panel). Consumer: UI export button.

- [ ] **Step 6.1: Write a failing test**

Append to `packages/nichoir-core/tests/exporters.test.ts`:

```ts
describe('generatePlanZIP', () => {
  it('produces one SVG entry per panel', async () => {
    const { computeCutLayout, generatePlanZIP, createInitialState } = await import('../src/index.js');
    const JSZip = (await import('jszip')).default;
    const t = (k: string) => k;

    const base = createInitialState().params;
    // Force multi-panel with narrow panel
    const layout = computeCutLayout({ ...base, panelW: 500, panelH: 2440 });
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
```

- [ ] **Step 6.2: Run test to confirm failure**

```bash
pnpm -C packages/nichoir-core test exporters -t "generatePlanZIP"
```

Expected: FAIL (module `generatePlanZIP` not exported).

- [ ] **Step 6.3: Create `plan-zip.ts`**

Create `packages/nichoir-core/src/exporters/plan-zip.ts`:

```ts
// src/exporters/plan-zip.ts
//
// Génère un ZIP contenant un SVG par panneau du layout multi-bin.
// Fichiers nommés `panel-1.svg`, `panel-2.svg`, … (ordre préservé de CutLayout.panels).
// Nom neutre en anglais pour éviter i18n dans un nom de fichier ZIP.

import JSZip from 'jszip';
import type { CutLayout, Translator } from '../types.js';
import { generatePlanSVG } from './svg.js';

export async function generatePlanZIP(
  layout: CutLayout,
  translate: Translator,
): Promise<Uint8Array> {
  const zip = new JSZip();
  layout.panels.forEach((panel, i) => {
    const svg = generatePlanSVG(panel, translate);
    zip.file(`panel-${i + 1}.svg`, svg);
  });
  return zip.generateAsync({ type: 'uint8array' });
}
```

- [ ] **Step 6.4: Export from `index.ts`**

Open `packages/nichoir-core/src/index.ts`. After the existing `export { generatePlanSVG } from './exporters/svg.js';`, add:

```ts
export { generatePlanZIP } from './exporters/plan-zip.js';
```

- [ ] **Step 6.5: Run test to verify pass**

```bash
pnpm -C packages/nichoir-core test exporters -t "generatePlanZIP"
```

Expected: PASS.

- [ ] **Step 6.6: Commit**

```bash
git add packages/nichoir-core/src/exporters/plan-zip.ts packages/nichoir-core/src/index.ts packages/nichoir-core/tests/exporters.test.ts
git commit -m "feat(core/exporters) — generatePlanZIP produit un ZIP de N SVG par panneau"
```

---

## Task 7: UI component `CutLayoutRenderer`

**Files:**
- Create: `packages/nichoir-ui/src/components/cut-plan/CutLayoutRenderer.tsx`
- Create: `packages/nichoir-ui/src/components/cut-plan/PanelCard.tsx`
- Create: `packages/nichoir-ui/src/components/cut-plan/OverflowBanner.tsx`
- Create: `packages/nichoir-ui/src/components/cut-plan/CutLayout.module.css`

**Goal:** Self-contained renderer. Accepts a `CutLayout` + a translator. Renders overflow banner + N panel cards. Reused in `coupe` branch by `PlanTab2`.

- [ ] **Step 7.1: Create CSS module**

Create `packages/nichoir-ui/src/components/cut-plan/CutLayout.module.css`:

```css
/* Renderer partagé pour CutLayout multi-panneaux. */

.root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header {
  font-size: 11px;
  color: var(--n-text-muted);
  padding: 4px 0;
}

.banner {
  background: #441a1a;
  color: #ff8888;
  border: 1px solid #ff4444;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bannerTitle {
  font-weight: bold;
}

.bannerList {
  margin: 0;
  padding-left: 16px;
}

.panelCard {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 0;
  border-top: 1px solid var(--n-border);
}

.panelHeader {
  font-size: 11px;
  color: var(--n-accent);
  display: flex;
  justify-content: space-between;
}

.svgPreview {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
  background: #252018;
}
```

- [ ] **Step 7.2: Create `OverflowBanner`**

Create `packages/nichoir-ui/src/components/cut-plan/OverflowBanner.tsx`:

```tsx
// src/components/cut-plan/OverflowBanner.tsx
//
// Bannière rouge affichée quand au moins une pièce est plus grande que le
// panneau lui-même. La pièce n'est dessinée dans aucun panneau ; on signale
// à l'utilisateur qu'il doit augmenter panelW/panelH.

'use client';

import type { LayoutPiece, Translator } from '@nichoir/core';
import styles from './CutLayout.module.css';

export interface OverflowBannerProps {
  overflow: LayoutPiece[];
  t: Translator;
}

export function OverflowBanner({ overflow, t }: OverflowBannerProps): React.JSX.Element | null {
  if (overflow.length === 0) return null;
  return (
    <div className={styles.banner} role="alert">
      <span className={styles.bannerTitle}>{t('plan.overflow.title')}</span>
      <ul className={styles.bannerList}>
        {overflow.map((p, i) => (
          <li key={`overflow-${i}`}>
            {t(p.nameKey) + (p.suffix ?? '')} — {Math.round(p.w)}×{Math.round(p.h)} mm
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7.3: Create `PanelCard`**

Create `packages/nichoir-ui/src/components/cut-plan/PanelCard.tsx`:

```tsx
// src/components/cut-plan/PanelCard.tsx
//
// Carte d'UN panneau : header (numéro + occupation %) + SVG inline responsive
// des pièces placées. Visuel fidèle v15 (fond sombre, palette accent).

'use client';

import type { Panel, LayoutPiece, Translator } from '@nichoir/core';
import styles from './CutLayout.module.css';

const SHEET_BG    = '#252018';
const SHEET_STROKE = '#4a4030';
const GRID_STROKE = '#302818';
const PIECE_STROKE = '#e8a955';
const LABEL_COLOR = '#fff';
const LABEL_DIM_COLOR = '#bbb';
const LABEL_ROT_COLOR = '#888';
const PIECE_FILL_OPACITY = 0.65;

function renderPentagon(
  p: LayoutPiece, x: number, y: number, w: number, h: number,
  fill: string, stroke: string,
): React.JSX.Element {
  const wHs = p.wallH ?? 0;
  const Wb = p.Wbot ?? w;
  const Wt = p.Wtop ?? w;
  const Wmax = Math.max(Wb, Wt);
  const bottomInset = (Wmax - Wb) / 2;
  const topInset = (Wmax - Wt) / 2;
  const pts: Array<[number, number]> = [
    [x + bottomInset,       y + h],
    [x + bottomInset + Wb,  y + h],
    [x + topInset + Wt,     y + h - wHs],
    [x + Wmax / 2,          y],
    [x + topInset,          y + h - wHs],
  ];
  return (
    <polygon
      points={pts.map((pt) => pt.join(',')).join(' ')}
      fill={fill} fillOpacity={PIECE_FILL_OPACITY}
      stroke={stroke} strokeWidth={1}
    />
  );
}

function renderPiece(
  p: LayoutPiece, idx: number, t: Translator, shW: number,
): React.JSX.Element | null {
  if (p.px === undefined || p.py === undefined) return null;
  const { px, py, w, h } = p as Required<Pick<LayoutPiece, 'px' | 'py'>> & LayoutPiece;

  const fill = p.color;
  const stroke = PIECE_STROKE;
  const fs = Math.max(shW * 0.025, Math.min(shW * 0.04, w * 0.12));
  const origW = p.rot === true ? p.h : p.w;
  const origH = p.rot === true ? p.w : p.h;
  const name = t(p.nameKey) + (p.suffix ?? '');
  const cx = px + w / 2;
  const cy = py + h / 2;

  const shapeElement =
    p.shape === 'pent' && p.rot !== true
      ? renderPentagon(p, px, py, w, h, fill, stroke)
      : (
        <rect
          x={px} y={py} width={w} height={h}
          fill={fill} fillOpacity={PIECE_FILL_OPACITY}
          stroke={stroke} strokeWidth={Math.max(0.3, shW * 0.0008)}
        />
      );

  return (
    <g key={`piece-${idx}`}>
      {shapeElement}
      <text x={cx} y={cy - fs * 0.3} fontFamily="sans-serif" fontSize={fs} fill={LABEL_COLOR} textAnchor="middle" dominantBaseline="middle">{name}</text>
      <text x={cx} y={cy + fs * 0.75} fontFamily="sans-serif" fontSize={fs * 0.8} fill={LABEL_DIM_COLOR} textAnchor="middle" dominantBaseline="middle">{Math.round(origW)}×{Math.round(origH)}</text>
      {p.rot === true && (
        <text x={cx} y={cy + fs * 1.7} fontFamily="sans-serif" fontSize={fs * 0.65} fill={LABEL_ROT_COLOR} textAnchor="middle" dominantBaseline="middle">{t('plan.rotated')}</text>
      )}
    </g>
  );
}

function renderGrid(shW: number, shH: number): React.JSX.Element[] {
  const lines: React.JSX.Element[] = [];
  for (let g = 200; g < shW; g += 200) {
    lines.push(<line key={`gx-${g}`} x1={g} y1={0} x2={g} y2={shH} stroke={GRID_STROKE} strokeWidth={0.5} />);
  }
  for (let g = 200; g < shH; g += 200) {
    lines.push(<line key={`gy-${g}`} x1={0} y1={g} x2={shW} y2={g} stroke={GRID_STROKE} strokeWidth={0.5} />);
  }
  return lines;
}

export interface PanelCardProps {
  panel: Panel;
  panelIndex: number;    // 1-based pour l'affichage
  t: Translator;
}

export function PanelCard({ panel, panelIndex, t }: PanelCardProps): React.JSX.Element {
  const { pieces, shW, shH, occupation } = panel;
  const title = t('plan.panelN', { n: panelIndex });
  const occupationStr = `${Math.round(occupation * 100)}%`;

  return (
    <div className={styles.panelCard}>
      <div className={styles.panelHeader}>
        <span>{title}</span>
        <span>{t('plan.occupation')}: {occupationStr}</span>
      </div>
      <svg
        className={styles.svgPreview}
        viewBox={`0 0 ${shW} ${shH}`}
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={`${title} ${shW}×${shH} mm`}
        style={{ aspectRatio: `${shW}/${shH}` }}
      >
        <title>{`${title} ${shW}×${shH} mm`}</title>
        <rect x={0} y={0} width={shW} height={shH} fill={SHEET_BG} stroke={SHEET_STROKE} strokeWidth={Math.max(1, shW / 234)} />
        {renderGrid(shW, shH)}
        {pieces.map((p, i) => renderPiece(p, i, t, shW))}
      </svg>
    </div>
  );
}
```

- [ ] **Step 7.4: Create `CutLayoutRenderer`**

Create `packages/nichoir-ui/src/components/cut-plan/CutLayoutRenderer.tsx`:

```tsx
// src/components/cut-plan/CutLayoutRenderer.tsx
//
// Composant racine du rendu d'un CutLayout multi-panneaux. Partagé entre
// PlanTab (shelf-packing) et PlanTab2 (rectangle-packer, branche coupe).
//
// Responsabilité : orchestrer header + overflow banner + liste de PanelCard.
// Zéro logique de calcul — purement présentational.

'use client';

import type { CutLayout, Translator } from '@nichoir/core';
import { OverflowBanner } from './OverflowBanner.js';
import { PanelCard } from './PanelCard.js';
import styles from './CutLayout.module.css';

export interface CutLayoutRendererProps {
  layout: CutLayout;
  t: Translator;
  algoBadge?: string;  // ex: "algo: shelf-packing" (optionnel, utilisé en branche coupe)
}

export function CutLayoutRenderer({ layout, t, algoBadge }: CutLayoutRendererProps): React.JSX.Element {
  const { panels, overflow, meanOccupation } = layout;
  const nPanels = panels.length;
  const meanOccStr = `${Math.round(meanOccupation * 100)}%`;

  const headerText = nPanels === 0
    ? t('plan.noPanels')
    : t('plan.summary', { n: nPanels, occ: meanOccStr });

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        {headerText}
        {algoBadge !== undefined ? ` — ${algoBadge}` : ''}
      </div>
      <OverflowBanner overflow={overflow} t={t} />
      {panels.map((panel, i) => (
        <PanelCard key={`panel-${i}`} panel={panel} panelIndex={i + 1} t={t} />
      ))}
    </div>
  );
}
```

- [ ] **Step 7.5: Typecheck the UI package**

```bash
pnpm -C packages/nichoir-ui typecheck
```

Expected: errors in `PlanCanvasSection.tsx` etc. (fixed in next task). The new cut-plan/ components should have no errors.

- [ ] **Step 7.6: Commit**

```bash
git add packages/nichoir-ui/src/components/cut-plan/
git commit -m "feat(ui) — composants partagés CutLayoutRenderer + PanelCard + OverflowBanner"
```

---

## Task 8: Refactor `PlanCanvasSection` + `PlanStatsSection`

**Files:**
- Modify: `packages/nichoir-ui/src/components/tabs/PlanCanvasSection.tsx`
- Modify: `packages/nichoir-ui/src/components/tabs/PlanStatsSection.tsx`

**Goal:** PlanCanvasSection becomes a thin wrapper around `CutLayoutRenderer`. PlanStatsSection shows aggregate multi-panel metrics.

- [ ] **Step 8.1: Rewrite `PlanCanvasSection.tsx`**

Replace its content with:

```tsx
// src/components/tabs/PlanCanvasSection.tsx
//
// Thin wrapper : appelle computeCutLayout et délègue le rendu à
// CutLayoutRenderer (composant partagé multi-bin).

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { computeCutLayout } from '@nichoir/core';
import { CutLayoutRenderer } from '../cut-plan/CutLayoutRenderer.js';

export function PlanCanvasSection(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const t = useT();
  const layout = computeCutLayout(params);
  return <CutLayoutRenderer layout={layout} t={t} />;
}
```

- [ ] **Step 8.2: Rewrite `PlanStatsSection.tsx` for aggregate stats**

Replace its content with:

```tsx
// src/components/tabs/PlanStatsSection.tsx
//
// Stats agrégées multi-bin : taille panneau, nb panneaux, occupation moyenne,
// aire totale pièces, aire totale panneaux, pièces overflow (si applicable).

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { computeCutLayout } from '@nichoir/core';
import { formatPlanArea, formatPlanSize } from '../../utils/planFormatters.js';
import styles from './PlanTab.module.css';

export function PlanStatsSection(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const t = useT();
  const layout = computeCutLayout(params);
  const nPanels = layout.panels.length;
  const totalPanelArea = nPanels * params.panelW * params.panelH;
  const meanOccPct = `${Math.round(layout.meanOccupation * 100)}%`;

  return (
    <div className={styles.section}>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.panel')}</span>
        <span className={styles.val}>{formatPlanSize(params.panelW, params.panelH)}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.panelCount')}</span>
        <span className={styles.val}>{nPanels}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.meanOccupation')}</span>
        <span className={styles.val}>{meanOccPct}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.area')}</span>
        <span className={styles.val}>{formatPlanArea(layout.totalUsedArea)}</span>
      </div>
      <div className={styles.statRow}>
        <span className={styles.label}>{t('plan.totalPanelArea')}</span>
        <span className={styles.val}>{formatPlanArea(totalPanelArea)}</span>
      </div>
      {layout.overflow.length > 0 && (
        <div className={styles.statRow}>
          <span className={styles.label}>{t('plan.overflowCount')}</span>
          <span className={styles.val}>{layout.overflow.length}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8.3: Typecheck UI**

```bash
pnpm -C packages/nichoir-ui typecheck
```

Expected: errors only in tests now; src/ compiles clean.

- [ ] **Step 8.4: Commit**

```bash
git add packages/nichoir-ui/src/components/tabs/PlanCanvasSection.tsx packages/nichoir-ui/src/components/tabs/PlanStatsSection.tsx
git commit -m "refactor(ui/PlanTab) — délègue au CutLayoutRenderer partagé + stats multi-bin"
```

---

## Task 9: Update `ExportPlanSection` to ZIP export

**Files:**
- Modify: `packages/nichoir-ui/src/components/tabs/ExportPlanSection.tsx`
- Modify: `packages/nichoir-ui/tests/ExportTab.test.tsx` (if exists — adapt assertions)

**Goal:** Download a ZIP of N SVGs instead of a single SVG.

- [ ] **Step 9.1: Rewrite `ExportPlanSection.tsx`**

Replace its content with:

```tsx
// src/components/tabs/ExportPlanSection.tsx
//
// Export ZIP multi-panneaux du plan de coupe. Un SVG par panneau (nommage
// panel-1.svg, panel-2.svg, ...). Déclenche via DownloadService.

'use client';

import { useState } from 'react';
import { computeCutLayout, generatePlanZIP } from '@nichoir/core';
import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { useDownloadService } from '../../adapters/DownloadServiceContext.js';
import { ExportButton } from '../primitives/ExportButton.js';
import styles from './ExportTab.module.css';

export function ExportPlanSection(): React.JSX.Element {
  const t = useT();
  const download = useDownloadService();
  const [error, setError] = useState<string | null>(null);

  const handleZip = async (): Promise<void> => {
    setError(null);
    try {
      const state = useNichoirStore.getState();
      const layout = computeCutLayout(state.params);
      const zipBytes = await generatePlanZIP(layout, t);
      const filename = `nichoir_plan_${state.params.panelW}x${state.params.panelH}.zip`;
      await download.trigger(zipBytes, filename, 'application/zip');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('export.error.generic', { message: msg }));
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('export.plan')}</div>
      <ExportButton
        label={t('plan.export.zip')}
        labelBusy={t('export.busy.zip.plan')}
        onClick={handleZip}
      />
      {error !== null && (
        <p role="alert" className={styles.error}>{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 9.2: Run UI typecheck**

```bash
pnpm -C packages/nichoir-ui typecheck
```

Expected: OK (i18n keys `plan.export.zip`, `export.busy.zip.plan` don't exist yet — that's OK for typecheck, i18n is lookup-at-runtime; tests will fail later though).

- [ ] **Step 9.3: Commit**

```bash
git add packages/nichoir-ui/src/components/tabs/ExportPlanSection.tsx
git commit -m "feat(ui/export) — export plan en ZIP multi-SVG"
```

---

## Task 10: i18n labels

**Files:**
- Modify: `packages/nichoir-ui/src/i18n/messages.ts`

**Goal:** Add all new keys used by the new components and replace deprecated ones.

- [ ] **Step 10.1: Add new keys (FR)**

Open `packages/nichoir-ui/src/i18n/messages.ts`. Locate the FR block around lines 213-222 (the `PLAN` section). Replace:

```ts
    'plan.panelSize': '▸ TAILLE DU PANNEAU',
    'plan.panelSize.custom': 'Personnalisé…',
    'plan.panelSize.bb': 'bouleau baltique',
    'plan.panelWidth': 'Largeur panneau',
    'plan.panelHeight': 'Hauteur panneau',
    'plan.panel': 'Panneau :',
    'plan.usage': 'Utilisation :',
    'plan.area': 'Aire pièces :',
    'plan.panelArea': 'Aire panneau :',
    'plan.rotated': '(tourné 90°)',
```

with:

```ts
    'plan.panelSize': '▸ TAILLE DU PANNEAU',
    'plan.panelSize.custom': 'Personnalisé…',
    'plan.panelSize.bb': 'bouleau baltique',
    'plan.panelWidth': 'Largeur panneau',
    'plan.panelHeight': 'Hauteur panneau',
    'plan.panel': 'Panneau :',
    'plan.rotated': '(tourné 90°)',
    'plan.panelN': 'Panneau {n}',
    'plan.occupation': 'Occupation',
    'plan.panelCount': 'Nombre de panneaux :',
    'plan.meanOccupation': 'Occupation moyenne :',
    'plan.area': 'Aire pièces totale :',
    'plan.totalPanelArea': 'Aire panneaux totale :',
    'plan.overflowCount': 'Pièces hors panneau :',
    'plan.summary': '{n} panneau(x), occupation moyenne {occ}',
    'plan.noPanels': 'Aucun panneau — toutes les pièces sont trop grandes',
    'plan.overflow.title': '⚠ Pièces plus grandes que le panneau',
```

Also in the FR EXPORT block, locate:

```ts
    'export.plan': '▸ EXPORT PLAN DE COUPE',
    'plan.export.svg': '⬇ Plan de coupe (.svg)',
    'export.busy.svg': 'Export SVG…',
```

Replace with:

```ts
    'export.plan': '▸ EXPORT PLAN DE COUPE',
    'plan.export.zip': '⬇ Plan de coupe (.zip, 1 SVG par panneau)',
    'export.busy.zip.plan': 'Export ZIP plan…',
```

- [ ] **Step 10.2: Symmetric changes in EN block**

Locate the EN `PLAN` block around lines 449-458. Replace with:

```ts
    'plan.panelSize': '▸ SHEET SIZE',
    'plan.panelSize.custom': 'Custom…',
    'plan.panelSize.bb': 'baltic birch',
    'plan.panelWidth': 'Sheet width',
    'plan.panelHeight': 'Sheet height',
    'plan.panel': 'Sheet:',
    'plan.rotated': '(rotated 90°)',
    'plan.panelN': 'Sheet {n}',
    'plan.occupation': 'Occupation',
    'plan.panelCount': 'Sheet count:',
    'plan.meanOccupation': 'Mean occupation:',
    'plan.area': 'Total pieces area:',
    'plan.totalPanelArea': 'Total sheet area:',
    'plan.overflowCount': 'Oversized pieces:',
    'plan.summary': '{n} sheet(s), mean occupation {occ}',
    'plan.noPanels': 'No sheet — all pieces are too large',
    'plan.overflow.title': '⚠ Pieces larger than the sheet',
```

In the EN EXPORT block, locate:

```ts
    'export.plan': '▸ CUT PLAN EXPORT',
    'plan.export.svg': '⬇ Cut plan (.svg)',
    'export.busy.svg': 'Exporting SVG…',
```

Replace with:

```ts
    'export.plan': '▸ CUT PLAN EXPORT',
    'plan.export.zip': '⬇ Cut plan (.zip, 1 SVG per sheet)',
    'export.busy.zip.plan': 'Exporting ZIP plan…',
```

- [ ] **Step 10.3: Typecheck UI**

```bash
pnpm -C packages/nichoir-ui typecheck
```

Expected: OK.

- [ ] **Step 10.4: Commit**

```bash
git add packages/nichoir-ui/src/i18n/messages.ts
git commit -m "i18n(plan) — clés multi-bin (panelN, meanOccupation, overflow…) + ZIP export"
```

---

## Task 11: Fix `PlanTab.test.tsx`

**Files:**
- Modify: `packages/nichoir-ui/tests/PlanTab.test.tsx`

**Goal:** Adapt tests to the new render tree. With multi-bin on default preset, there is 1 panel → 1 `<svg>` in the canvas section. The existing assertions about labels and stats change to the new keys.

- [ ] **Step 11.1: Run the failing tests to see the delta**

```bash
pnpm -C packages/nichoir-ui test PlanTab
```

Expected: FAIL. Multiple assertions failing on renamed labels + multiple svg elements + missing old keys.

- [ ] **Step 11.2: Rewrite the unit tests**

Replace the content of `packages/nichoir-ui/tests/PlanTab.test.tsx` with:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

// Mock viewport (unchanged).
const { mockCtor, mockInstances } = vi.hoisted(() => {
  interface MockCall { mount: Array<{ el: HTMLElement; state: unknown }>; update: Array<unknown>; unmount: number; }
  const mockInstances: MockCall[] = [];
  const mockCtor = vi.fn(() => {
    const calls: MockCall = { mount: [], update: [], unmount: 0 };
    mockInstances.push(calls);
    return {
      mount: vi.fn((el: HTMLElement, state: unknown) => { calls.mount.push({ el, state }); }),
      update: vi.fn((state: unknown) => { calls.update.push(state); }),
      unmount: vi.fn(() => { calls.unmount++; }),
      readCameraState: vi.fn(),
    };
  });
  return { mockCtor, mockInstances };
});

vi.mock('../src/viewports/ImperativeThreeViewport.js', () => ({
  ImperativeThreeViewport: mockCtor,
}));

import { PlanTab } from '../src/components/tabs/PlanTab.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState, computeCutLayout } from '@nichoir/core';
import { formatPlanArea, formatPlanSize } from '../src/utils/planFormatters.js';

beforeEach(() => {
  cleanup();
  mockCtor.mockClear();
  mockInstances.length = 0;
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('PlanTab (unit, multi-bin)', () => {
  it('rend : size picker + canvas section + stats (3 blocs)', () => {
    const { getByText, getAllByRole } = render(<PlanTab />);
    expect(getByText('▸ TAILLE DU PANNEAU')).toBeDefined();
    // Canvas section expose au moins un <svg role="img"> (1 panneau sur default preset)
    expect(getAllByRole('img').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Panneau :')).toBeDefined();
    expect(getByText('Nombre de panneaux :')).toBeDefined();
    expect(getByText('Occupation moyenne :')).toBeDefined();
    expect(getByText('Aire pièces totale :')).toBeDefined();
    expect(getByText('Aire panneaux totale :')).toBeDefined();
  });

  it('preset picker : 5 options, valeur initiale "1220x2440"', () => {
    const { getByRole } = render(<PlanTab />);
    const select = getByRole('combobox') as HTMLSelectElement;
    expect(select.options).toHaveLength(5);
    expect(select.value).toBe('1220x2440');
  });

  it('custom NON visible par défaut', () => {
    const { queryByText } = render(<PlanTab />);
    expect(queryByText('Largeur panneau')).toBeNull();
    expect(queryByText('Hauteur panneau')).toBeNull();
  });

  it('select preset "1220x1220" : mutation ATOMIQUE panelW + panelH', () => {
    const { getByRole } = render(<PlanTab />);
    const select = getByRole('combobox') as HTMLSelectElement;
    act(() => { fireEvent.change(select, { target: { value: '1220x1220' } }); });
    const after = useNichoirStore.getState().params;
    expect(after.panelW).toBe(1220);
    expect(after.panelH).toBe(1220);
  });

  it('default preset → 1 panneau rendu', () => {
    const { container } = render(<PlanTab />);
    // 1 svg pour le panneau (pas de svg pour l'app-root dans PlanTab)
    const layout = computeCutLayout(createInitialState().params);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(layout.panels.length);
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it('panneau étroit (500x2440) → multi-panneaux rendus', () => {
    act(() => {
      useNichoirStore.getState().setParam('panelW', 500);
      useNichoirStore.getState().setParam('panelH', 2440);
    });
    const { container } = render(<PlanTab />);
    const expected = computeCutLayout(useNichoirStore.getState().params).panels.length;
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(expected);
    expect(expected).toBeGreaterThan(1);
  });

  it('pièce surdimensionnée (panneau 100x100) → bannière overflow rendue', () => {
    act(() => {
      useNichoirStore.getState().setParam('panelW', 100);
      useNichoirStore.getState().setParam('panelH', 100);
    });
    const { getByRole, getByText } = render(<PlanTab />);
    // role="alert" sur OverflowBanner
    expect(getByRole('alert')).toBeDefined();
    expect(getByText('⚠ Pièces plus grandes que le panneau')).toBeDefined();
  });

  it('stats : totalUsedArea rendue', () => {
    const layout = computeCutLayout(createInitialState().params);
    const { getByText } = render(<PlanTab />);
    expect(getByText(formatPlanArea(layout.totalUsedArea))).toBeDefined();
    expect(getByText(formatPlanSize(1220, 2440))).toBeDefined();
  });

  it('stats : overflowCount masqué quand overflow = 0', () => {
    const { queryByText } = render(<PlanTab />);
    expect(queryByText('Pièces hors panneau :')).toBeNull();
  });

  it('switch lang fr → en : labels traduits', () => {
    const { getByText, rerender } = render(<PlanTab />);
    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<PlanTab />);
    expect(getByText('▸ SHEET SIZE')).toBeDefined();
    expect(getByText('Sheet:')).toBeDefined();
    expect(getByText('Sheet count:')).toBeDefined();
    expect(getByText('Mean occupation:')).toBeDefined();
  });
});
```

- [ ] **Step 11.3: Run tests**

```bash
pnpm -C packages/nichoir-ui test PlanTab
```

Expected: PASS.

- [ ] **Step 11.4: Run the full UI suite — investigate other breakages**

```bash
pnpm -C packages/nichoir-ui test
```

Expected: other tests might fail if they read `layout.pieces` / `layout.shW` / `layout.totalArea` or call `generatePlanSVG(layout, ...)`. Fix by updating them to the new contract. Likely targets:
- `planFormatters.test.ts` — if it tests a `formatUsagePct` that no longer exists, delete that test (it was based on old single-bin stats); if `formatUsagePct` is still exported from `planFormatters.ts` but unused, consider removing.
- `ExportTab.test.tsx` — if it asserts on `plan.export.svg` label, adapt to `plan.export.zip`.

For each failing test, read the failure, adapt minimally, keep the assertion's intent.

- [ ] **Step 11.5: Commit**

```bash
git add packages/nichoir-ui/tests/
git commit -m "test(ui) — adapte tests au contrat multi-bin (Panel, CutLayoutRenderer, ZIP)"
```

---

## Task 12: Deprecated helper cleanup (`formatUsagePct`)

**Files:**
- Modify: `packages/nichoir-ui/src/utils/planFormatters.ts`
- Modify: `packages/nichoir-ui/tests/planFormatters.test.ts`

**Goal:** Remove `formatUsagePct(totalArea, shW, shH)` — its semantics was single-bin usage. Aggregate `meanOccupation` is now a pre-formatted percentage computed in `PlanStatsSection` directly.

- [ ] **Step 12.1: Check usage**

```bash
grep -rn "formatUsagePct" packages/nichoir-ui/src packages/nichoir-ui/tests
```

If the only reference is in `planFormatters.ts` export and its own test file, proceed. Otherwise, adapt consumers.

- [ ] **Step 12.2: Remove the function**

Open `packages/nichoir-ui/src/utils/planFormatters.ts`. Remove `formatUsagePct` + its export. If the file only had that one function + two others (`formatPlanArea`, `formatPlanSize`), keep the two others.

- [ ] **Step 12.3: Remove corresponding test(s)**

Open `packages/nichoir-ui/tests/planFormatters.test.ts`. Remove test cases that only cover `formatUsagePct`.

- [ ] **Step 12.4: Typecheck + test**

```bash
pnpm -C packages/nichoir-ui typecheck
pnpm -C packages/nichoir-ui test planFormatters
```

Expected: PASS.

- [ ] **Step 12.5: Commit**

```bash
git add packages/nichoir-ui/src/utils/planFormatters.ts packages/nichoir-ui/tests/planFormatters.test.ts
git commit -m "chore(ui) — supprime formatUsagePct (remplacé par meanOccupation multi-bin)"
```

---

## Task 13: Update `CONTRACTS.md` + version bump

**Files:**
- Modify: `packages/nichoir-core/CONTRACTS.md`
- Modify: `packages/nichoir-core/package.json` (version `0.2.0`)
- Modify: `packages/nichoir-core/src/index.ts` (`CORE_VERSION` = `'0.2.0'`)

- [ ] **Step 13.1: Bump version in `package.json`**

Open `packages/nichoir-core/package.json`. Change `"version": "0.1.0"` to `"version": "0.2.0"`.

- [ ] **Step 13.2: Bump `CORE_VERSION`**

Open `packages/nichoir-core/src/index.ts` line 1:

```ts
export const CORE_VERSION = '0.1.0';
```

Change to:

```ts
export const CORE_VERSION = '0.2.0';
```

- [ ] **Step 13.3: Update `CONTRACTS.md`**

Open `packages/nichoir-core/CONTRACTS.md`. At line 7 change:
```
**Version du contrat** : 0.1.0 (figée pour P0–P1)
```
to:
```
**Version du contrat** : 0.2.0 (multi-bin cut plan)
```

Line 1 frontmatter update:
```
// Généré depuis CONTRACTS.md v0.1.0
```
→
```
// Généré depuis CONTRACTS.md v0.2.0
```

Locate the `LayoutPiece` + `CutLayout` block (around lines 215-235). Replace with:

```ts
/**
 * LayoutPiece.nameKey est une CLÉ i18n opaque (ex: 'panel.front'),
 * résolue par le consumer via `Translator`. `computeCutLayout` ne traduit jamais.
 * Les coordonnées `px, py` sont RELATIVES au panneau (Panel.pieces).
 */
export interface LayoutPiece {
  nameKey: string;
  suffix?: string;
  w: number; h: number;
  color: string;
  shape: 'rect' | 'pent';
  rH?: number; wallH?: number; Wtop?: number; Wbot?: number;
  px?: number; py?: number;
  rot?: boolean;
  idx?: number;
}

/**
 * Panneau physique : toutes les `pieces` sont dans [0, shW] × [0, shH].
 */
export interface Panel {
  pieces: LayoutPiece[];
  shW: number;
  shH: number;
  usedArea: number;
  occupation: number;   // ∈ [0, 1]
}

/**
 * Résultat multi-bin de `computeCutLayout`.
 * `overflow` contient les pièces strictement plus grandes que le panneau.
 */
export interface CutLayout {
  panels: Panel[];
  overflow: LayoutPiece[];
  totalUsedArea: number;
  meanOccupation: number;
}
```

Locate the exporters section (around line 479). Replace:

```ts
/** Génère la string SVG du plan de découpe.
 *  `translate` est utilisé pour les labels de pièces + `plan.rotated`. */
export function generatePlanSVG(
  layout: CutLayout,
  translate: Translator
): string;
```

with:

```ts
/** Génère la string SVG d'UN panneau du plan de découpe.
 *  `translate` résout les labels de pièces et `plan.rotated`. */
export function generatePlanSVG(
  panel: Panel,
  translate: Translator
): string;

/** Génère un ZIP contenant un SVG par panneau (`panel-1.svg`, `panel-2.svg`, …). */
export function generatePlanZIP(
  layout: CutLayout,
  translate: Translator
): Promise<Uint8Array>;
```

- [ ] **Step 13.4: Verify**

```bash
pnpm -r typecheck
pnpm -r test
```

Expected: all green.

- [ ] **Step 13.5: Commit**

```bash
git add packages/nichoir-core/package.json packages/nichoir-core/src/index.ts packages/nichoir-core/CONTRACTS.md
git commit -m "feat(contract) — @nichoir/core 0.2.0 : Panel + CutLayout multi-bin + generatePlanZIP"
```

---

## Task 14: Update `README.md` + `HANDOVER.md`

**Files:**
- Modify: `README.md` (project root)
- Modify: `HANDOVER.md` (project root)

- [ ] **Step 14.1: Edit `README.md`**

Find line 16 in `README.md`:
```
  - **PLAN** — plan de coupe 2D avec layout shelf-packing, export SVG
```

Replace with:
```
  - **PLAN** — plan de coupe 2D multi-bin avec layout shelf-packing, export ZIP (1 SVG par panneau)
```

- [ ] **Step 14.2: Edit `HANDOVER.md` — add a note in the Roadmap section**

Open `HANDOVER.md`. Find the "Roadmap" or equivalent section. Append a new item:

```markdown
### Breaking change 0.2.0 — CutLayout multi-bin (2026-04-23)

Le contrat `CutLayout` de `@nichoir/core` a été refait pour supporter plusieurs
panneaux. Forme avant : `{ pieces, shW, shH, totalArea }`. Forme après :
`{ panels: Panel[], overflow, totalUsedArea, meanOccupation }`.

L'ancienne export `generatePlanSVG(layout, t)` prend maintenant un `Panel`
(pas un `CutLayout`). Un helper `generatePlanZIP(layout, t)` agrège N SVG
dans un ZIP.

Impact SaaS host : un consumer externe qui utilisait `CutLayout.pieces` doit
migrer vers `CutLayout.panels[i].pieces`. L'export SVG consommateur doit
passer un panneau ou utiliser `generatePlanZIP` pour un ZIP multi-panneau.
```

- [ ] **Step 14.3: Commit**

```bash
git add README.md HANDOVER.md
git commit -m "docs — mention multi-bin cut plan + breaking change 0.2.0"
```

---

## Task 15: Full-stack validation

**Files:** none modified (verification only).

- [ ] **Step 15.1: Clean rebuild + full test suite**

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```

Expected: all green, 4/4 packages.

- [ ] **Step 15.2: Run the demo in dev mode**

```bash
pnpm -C apps/demo dev &
DEV_PID=$!
sleep 15
curl -sf http://localhost:3000/tools/nichoir > /dev/null && echo "OK" || echo "FAIL"
kill $DEV_PID
```

Expected: `OK`. If FAIL, investigate console / terminal output.

- [ ] **Step 15.3: Manual visual check of the 5 presets**

Run `pnpm -C apps/demo dev` in one terminal. In the browser, open `http://localhost:3000/tools/nichoir`. For each preset A through E:
1. Set the corresponding params (A = default ; B,C,D,E require manual slider/toggle changes per `tests/fixtures/capture-reference.mjs` lines 47-136).
2. Navigate to PLAN tab.
3. Observe: N panel cards rendered, each with its header + SVG. Occupation values plausible.
4. Screenshot the tab → save to `runs/2026-04-23-multibin/artifacts/preset-{A..E}-plantab.png`.
5. Switch lang FR ↔ EN, verify labels update correctly.
6. For one preset, go to EXPORT tab, click "Plan de coupe (.zip)", open the downloaded zip, verify it contains the expected number of `panel-N.svg`. Save one SVG as `artifacts/sample-panel-1.svg`.

Stop dev server.

- [ ] **Step 15.4: If any visual anomaly, fix and re-commit**

Otherwise, proceed.

---

## Task 16: Evidence document

**Files:**
- Create/modify: `runs/2026-04-23-multibin/RESULT.md`
- Create/modify: `runs/2026-04-23-multibin/state/metrics.json`
- Create/modify: `runs/2026-04-23-multibin/state/NOTES.md`
- Create: `runs/2026-04-23-multibin/artifacts/manifest.json`

- [ ] **Step 16.1: Write `RESULT.md`**

Create `runs/2026-04-23-multibin/RESULT.md`:

```markdown
# RESULT — Multi-bin refactor of computeCutLayout

## Problème
Le shelf-packing single-bin de `computeCutLayout` flagguait `overflow=true`
sur les pièces débordantes sans les re-placer. En atelier, cette information
n'avait aucune valeur actionnable : on achète plusieurs panneaux physiques.

## Matériaux examinés
- `packages/nichoir-core/src/cut-plan.ts` (pre-commit ad3e564 : single-bin)
- `packages/nichoir-core/src/types.ts` (CutLayout 0.1.0)
- `packages/nichoir-core/tests/fixtures/preset{A..E}.snapshot.json` (pre-regen)
- `packages/nichoir-ui/src/components/tabs/PlanTab.tsx` + sous-sections
- `docs/superpowers/specs/2026-04-23-multi-bin-cut-plan-design.md`

## Symptômes avant migration
- Dans l'UI, lors d'un panneau sous-dimensionné (ex: 500×2440), des pièces
  étaient dessinées rouge à des coordonnées hors-panneau, sans moyen pour
  l'utilisateur de les re-placer.
- Pas de support multi-panneaux dans le store ni dans l'export SVG.

## Cause racine
[observation directe] L'algorithme v15 portait intentionnellement un modèle
single-bin (cf. code commenté `overflow=true` lignes 61, 67, 70 de cut-plan.ts
pre-commit). La sémantique "overflow" = "cette pièce ne tient pas dans la
découpe courante, l'utilisateur doit changer la taille de panneau".

Cette sémantique n'est pas ahiṃsā (cf. CLAUDE.md G5) : elle oblige à un
allo-retour manuel "je mesure → je vois rouge → j'agrandis panneau → je
vérifie". Le multi-bin supprime cet allo-retour : les pièces sont réparties
automatiquement sur autant de panneaux physiques que nécessaire.

## Résolution appliquée

### Core (cut-plan.ts)
- Nouveau type `Panel = { pieces, shW, shH, usedArea, occupation }`.
- `CutLayout = { panels: Panel[], overflow, totalUsedArea, meanOccupation }`.
- Boucle multi-bin : `tryPlace` échoue → `panels.push(current)` + nouveau panneau.
- Overflow strict : uniquement pour pièces > panneau (invariant `isPieceTooBig`).

### Exporters
- `generatePlanSVG(panel, t)` : consomme UN panneau (changement de signature).
- `generatePlanZIP(layout, t)` : nouveau, produit un ZIP de N SVG.

### UI
- Nouveaux composants partagés `CutLayoutRenderer` + `PanelCard` + `OverflowBanner`.
- `PlanCanvasSection` devient un thin wrapper.
- `PlanStatsSection` affiche stats agrégées (N panneaux, occupation moyenne, overflow count).
- Export PLAN : `.zip` au lieu de `.svg`.

### Fixtures
- Section `reference.cutLayout` régénérée sur les 5 fixtures (approuvée user).
- MD5 mis à jour dans `tests/fixtures/README.md`.

## Validation
- [x] `pnpm -r typecheck` vert (4/4).
- [x] `pnpm -r test` vert (4/4 packages, total tests voir `state/metrics.json`).
- [x] `pnpm -r lint` vert (4/4).
- [x] `pnpm -r build` vert (4/4).
- [x] `apps/demo` lancé, curl `/tools/nichoir` → 200 OK.
- [x] 5 presets rendent dans le browser sans erreur console. Screenshots dans `artifacts/`.
- [x] Export ZIP fonctionne, N SVG présents, ouvrables en éditeur.
- [x] FR ↔ EN : tous les nouveaux labels s'affichent correctement.

## Incertitude résiduelle
- Pas de test sur très gros `nPanels` (ex: panneau 200×200 → 15 panneaux).
  Le rendu scroll est probablement OK mais non vérifié.
- Pas de mesure comparative d'efficacité entre l'ancien et le nouveau
  shelf-packing — c'est l'objet de la branche `coupe` (benchmark vs rectangle-packer).
- `formatUsagePct` supprimé : si un consumer externe l'importait, cassé.
  Cherche via `grep -rn formatUsagePct` a retourné zéro match hors fixture interne.
```

- [ ] **Step 16.2: Write `state/metrics.json`**

Run:
```bash
pnpm -r test 2>&1 | tee /tmp/multibin-test-output.txt
```

Then count pass/fail per package and create `runs/2026-04-23-multibin/state/metrics.json` with:
```json
{
  "task_id": "multi-bin-cut-plan",
  "status": "completed",
  "acceptance_passed": true,
  "tests_passed": true,
  "lint_passed": true,
  "typecheck_passed": true,
  "build_passed": true,
  "retries": 0,
  "files_changed": <count from git diff --stat main..HEAD | tail -1>,
  "commands_count": <approximate>,
  "verification_evidence": "RESULT.md, artifacts/*.png, artifacts/sample-panel-1.svg",
  "evidence_document_written": true
}
```

Fill in the numeric fields from the actual run.

- [ ] **Step 16.3: Write `state/NOTES.md`**

Create `runs/2026-04-23-multibin/state/NOTES.md`:

```markdown
# NOTES

## Findings
- Le shelf-packing historique était déjà préparé pour un overflow explicite
  (flag `overflow=true`), ce qui a rendu le port multi-bin surtout structurel
  (découpage en fonction de `tryPlace`), pas algorithmique.
- La section `cutLayout` des fixtures changeait alors que les autres sections
  restent bit-identiques. Hybrid capture (TS port pour cutLayout, src/* pour
  le reste) préserve la garantie parité v15 de `src/`.

## Assumptions
- Les 5 presets sont des configurations "plausibles" pour le nichoir.
  Aucune ne force explicitement un cas multi-panneau sur le panneau par défaut
  1220×2440. Le multi-panel est testé via `panelW: 500` dans les tests d'invariants.

## Future work
- Multi-bin + décomposition de la façade pentagonale (rectangle bas +
  triangle haut) : gain théorique 5-10 % supplémentaire, non exploré ici.
- Comparaison algorithmique contre rectangle-packer (branche `coupe`).
```

- [ ] **Step 16.4: Create `artifacts/manifest.json`**

```bash
ls runs/2026-04-23-multibin/artifacts/ > /tmp/manifest-list.txt
```

Create `runs/2026-04-23-multibin/artifacts/manifest.json`:
```json
{
  "description": "Screenshots + sample exported SVG from the 5 preset manual validation",
  "entries": [
    { "path": "preset-A-plantab.png", "kind": "screenshot" },
    { "path": "preset-B-plantab.png", "kind": "screenshot" },
    { "path": "preset-C-plantab.png", "kind": "screenshot" },
    { "path": "preset-D-plantab.png", "kind": "screenshot" },
    { "path": "preset-E-plantab.png", "kind": "screenshot" },
    { "path": "sample-panel-1.svg", "kind": "exported-panel" }
  ]
}
```

Adjust if some screenshots weren't produced.

- [ ] **Step 16.5: Commit evidence**

```bash
git add runs/2026-04-23-multibin/
git commit -m "docs(evidence) — RESULT.md + metrics + screenshots pour branche multi-bin"
```

---

## Task 17: Final verification + merge-readiness

**Files:** none modified.

- [ ] **Step 17.1: One last full check**

```bash
pnpm -r typecheck && pnpm -r lint && pnpm -r test && pnpm -r build
```

Expected: all green.

- [ ] **Step 17.2: Diff summary**

```bash
git log --oneline main..HEAD
git diff --stat main..HEAD | tail -3
```

Report to user with a summary of commits + LOC changed.

- [ ] **Step 17.3: Hand off for merge**

Tell the user:

```
Branche `multi-bin` prête à être mergée dans `main`.

Commits depuis `main` :
[coller la sortie de git log]

Diff stat : [coller la sortie de git diff --stat]

Evidence document : runs/2026-04-23-multibin/RESULT.md

Prochaine étape :
1. Reviewer les diffs (git diff main..HEAD)
2. Merger dans main (suggestion : fast-forward ou PR merge)
3. Démarrer la branche `coupe` (plan séparé, Task #5 de la todo list,
   nécessite writing-plans skill sur 2026-04-23-coupe-rectangle-packer-design.md)
```

DO NOT push or merge automatically. Wait for user's explicit instruction.

---

## Self-Review

Completed after writing the plan:

1. **Spec coverage** — all 16 criteria + invariants from `docs/superpowers/specs/2026-04-23-multi-bin-cut-plan-design.md` are covered:
   - Types (Panel, CutLayout) → Task 1
   - Multi-bin algorithm → Task 2
   - Fixture regen approval → Task 3
   - Fixture regen → Task 4
   - SVG per-panel → Task 5
   - ZIP multi-SVG → Task 6
   - UI shared components → Task 7
   - PlanTab refactor → Task 8
   - Export button → Task 9
   - i18n → Task 10
   - Tests adapted → Task 11
   - Deprecated helpers → Task 12
   - CONTRACTS + version → Task 13
   - README / HANDOVER → Task 14
   - Visual validation → Task 15
   - Evidence document → Task 16
   - Merge handoff → Task 17

2. **Placeholder scan** — passed. The "fill in the numeric fields" in Step 16.2 is legitimately runtime-dependent (requires running the test suite); the metrics structure is fully specified.

3. **Type consistency** — `Panel.shW`, `shH`, `usedArea`, `occupation` used consistently across Task 1, 2, 4, 5, 7, 8, 13. `CutLayout.panels`, `overflow`, `totalUsedArea`, `meanOccupation` consistent. `LayoutPiece.overflow` removed consistently (Task 1 removes, Task 11 test checks overflow via `layout.overflow` not piece-level).

4. **Ambiguity** — Task 3 (approval gate) uses exact-phrase match to avoid ambiguous "yes"/"ok" inputs. Task 4 explicitly names which fixture sections change vs stay identical.
