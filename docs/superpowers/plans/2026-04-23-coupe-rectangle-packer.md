# Coupe Branch — rectangle-packer benchmark — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install `rectangle-packer` npm package, add a parallel `computeCutLayoutRectpack` algorithm, expose it via a new "Plan de coupe 2" tab in the UI, and produce a reproducible benchmark (`runs/<date>-coupe-benchmark/RESULT.md`) comparing both algorithms on the 5 reference presets. User decides the winner after reading the evidence document.

**Architecture:** Two fully isolated algorithms sharing nothing except the cut list (extracted as a shared helper `buildCutList`) and the rendering component `CutLayoutRenderer` (from multi-bin). `computeCutLayout` (shelf-packing) stays untouched. `computeCutLayoutRectpack` wraps `GuillotineBinPack` with a custom multi-bin outer loop (the library is single-bin). Both expose the same `CutLayout` signature. A benchmark CLI script computes metrics (panels, occupation, waste, elapsed) per `(preset, algo)` and writes an evidence document with a candidate verdict checkbox.

**Tech Stack:** TypeScript 5.4, Vitest, React 19, rectangle-packer 1.0.4 (MIT), pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-04-23-coupe-rectangle-packer-design.md`

**Branch:** `coupe` (off `multi-bin`, not off `main` — `multi-bin` is not yet merged per user preference).

---

## File Structure

### Created
- `packages/nichoir-core/src/cut-plan-rectpack.ts` — new algorithm (mirrors `computeCutLayout` signature).
- `packages/nichoir-core/tests/cut-plan-rectpack.test.ts` — unit tests.
- `packages/nichoir-ui/src/components/tabs/PlanTab2.tsx` — thin wrapper rendering rectpack via `CutLayoutRenderer`.
- `packages/nichoir-ui/tests/PlanTab2.test.tsx` — UI tests.
- `scripts/benchmark-cut-plan.ts` — CLI script.
- `scripts/tsconfig.json` — TS config for scripts (strict, ESM output).
- `runs/2026-04-23-coupe/` (TASK/PLAN/RESULT/state/artifacts) — evidence folder.

### Modified
- `packages/nichoir-core/package.json` — add `rectangle-packer` dependency.
- `packages/nichoir-core/src/cut-plan.ts` — extract `buildCutList` as an exported helper (zero behaviour change, validated by existing tests).
- `packages/nichoir-core/src/index.ts` — export `computeCutLayoutRectpack`.
- `packages/nichoir-core/src/types.ts` — extend `TabKey` with `'plan2'`.
- `packages/nichoir-core/CONTRACTS.md` — document `computeCutLayoutRectpack` + new tab key.
- `packages/nichoir-ui/src/components/tabs/PlanTab.tsx` — add `algoBadge="shelf-packing"` prop (cosmetic).
- `packages/nichoir-ui/src/components/cut-plan/CutLayoutRenderer.tsx` — `algoBadge` prop already supported (verified).
- `packages/nichoir-ui/src/components/Sidebar.tsx` — add `'plan2'` to `TAB_ORDER` + render `<PlanTab2 />`.
- `packages/nichoir-ui/src/i18n/messages.ts` — add `'tab.plan2'` label (FR + EN).
- `packages/nichoir-ui/tests/Sidebar.test.tsx` — update tab count assertion if any.
- `package.json` (root) — add `"benchmark:cut-plan"` script.
- `README.md` — mention algo alternatif + benchmark.
- `HANDOVER.md` — branch state.

### Untouched (explicitly)
- `packages/nichoir-core/src/cut-plan.ts` algorithm body (only `buildCutList` extracted).
- `packages/nichoir-ui/src/components/tabs/PlanTab.tsx` rendering (only prop added).
- All 5 fixture snapshots (no new `activeTab` values; default stays `'dim'`).

---

## Task 0: Branch setup from `multi-bin`

**Files:** none created yet; git state + evidence scaffold.

- [ ] **Step 0.1: Verify prerequisites**

Run:
```bash
git branch --show-current
git log --oneline -3
pnpm -r test 2>&1 | grep -E "Tests\s+[0-9]+ passed"
```

Expected:
- Current branch: `multi-bin`.
- Recent commits include `851cd07` (README sync) or similar.
- Tests: 489 passed (168 core + 4 adapters + 317 ui).

If any condition fails, STOP and escalate.

- [ ] **Step 0.2: Create and checkout `coupe` branch**

```bash
git checkout -b coupe
git branch --show-current
```

Expected: `coupe`.

- [ ] **Step 0.3: Create evidence folder**

```bash
mkdir -p runs/2026-04-23-coupe/state runs/2026-04-23-coupe/artifacts
```

Create `runs/2026-04-23-coupe/TASK.md` with EXACTLY this content:

```markdown
# TASK — Install rectangle-packer + benchmark vs shelf-packing

**Branche** : `coupe` (dérivée de `multi-bin`)
**Spec** : `docs/superpowers/specs/2026-04-23-coupe-rectangle-packer-design.md`
**Plan** : `docs/superpowers/plans/2026-04-23-coupe-rectangle-packer.md`

## Résumé
Installer `rectangle-packer@1.0.4` dans `@nichoir/core`. Créer un nouvel
algorithme `computeCutLayoutRectpack` parallèle au shelf-packing. Exposer
via un nouvel onglet "Plan de coupe 2". Produire un benchmark comparatif
sur les 5 presets A-E.

## Contraintes
- `computeCutLayout` (shelf) inchangé fonctionnellement. Extraction pure
  de `buildCutList` OK si validée par les snapshots existants.
- `PlanTab` inchangé (sauf ajout d'un prop cosmétique `algoBadge`).
- Comparaison à armes strictement égales : même cut list, façades en
  boîte englobante pour les 2 algos.
- `pnpm -r typecheck/test/lint/build` tous verts.
- Evidence document `RESULT.md` écrit avant de déclarer succès.

## Critères d'acceptance
Voir spec section 8.
```

Create `runs/2026-04-23-coupe/PLAN.md` with EXACTLY:

```markdown
Voir `docs/superpowers/plans/2026-04-23-coupe-rectangle-packer.md`.
```

- [ ] **Step 0.4: Commit scaffolding**

```bash
git add runs/2026-04-23-coupe/
git commit -m "chore(coupe) — scaffold run folder TASK+PLAN"
```

Verify:
```bash
git log --oneline -2
git status --short
```

Expected: new commit on `coupe`; status shows only `hig-review.md` untracked.

---

## Task 1: Extend TabKey with 'plan2' (core)

**Files:**
- Modify: `packages/nichoir-core/src/types.ts:22` (TabKey type)
- Modify: `packages/nichoir-core/CONTRACTS.md` (TabKey documentation)

- [ ] **Step 1.1: Edit `packages/nichoir-core/src/types.ts`**

Locate line 22:
```ts
export type TabKey      = 'dim' | 'vue' | 'deco' | 'calc' | 'plan' | 'export';
```

REPLACE with:
```ts
export type TabKey      = 'dim' | 'vue' | 'deco' | 'calc' | 'plan' | 'plan2' | 'export';
```

- [ ] **Step 1.2: Edit `packages/nichoir-core/CONTRACTS.md`**

Find the same `TabKey` declaration in CONTRACTS.md (should match the types.ts line). Apply the same replacement (add `'plan2'` before `'export'`).

- [ ] **Step 1.3: Typecheck + tests**

Run:
```bash
pnpm -r typecheck
pnpm -C packages/nichoir-core test
pnpm -C packages/nichoir-ui test
```

Expected: all green. The UI package still has `TAB_ORDER = ['dim', ..., 'export']` without `'plan2'` — that's OK (TAB_ORDER is a readonly subset of TabKey, adding a key to the union doesn't break it). UI tests should still pass unchanged.

If UI tests complain about an exhaustiveness check somewhere, fix the minimal required change.

- [ ] **Step 1.4: Commit**

```bash
git add packages/nichoir-core/src/types.ts packages/nichoir-core/CONTRACTS.md
git commit -m "feat(core/contract) — TabKey étendu avec 'plan2' (onglet coupe)"
```

---

## Task 2: Extract `buildCutList` helper from cut-plan.ts

**Files:**
- Modify: `packages/nichoir-core/src/cut-plan.ts` (export buildCutList + internal types)

**Goal:** Expose `buildCutList` as a named export so `cut-plan-rectpack.ts` can use it. Zero behaviour change — the existing function is kept verbatim, only the `function` keyword becomes `export function`. The internal `WorkingPiece` interface is also exported so the rectpack file can consume the same shape.

- [ ] **Step 2.1: Edit `packages/nichoir-core/src/cut-plan.ts`**

At line 13, find:
```ts
interface WorkingPiece extends LayoutPiece {
  _w0: number;  // largeur originale
  _h0: number;  // hauteur originale
}
```

REPLACE with:
```ts
export interface WorkingPiece extends LayoutPiece {
  _w0: number;  // largeur originale
  _h0: number;  // hauteur originale
}
```

At line 19, find:
```ts
/** Construit la cut list des 7 pièces (+ 1 optionnelle porte) depuis `params`. */
function buildCutList(params: Params): WorkingPiece[] {
```

REPLACE with:
```ts
/**
 * Construit la cut list des 7 pièces (+ 1 optionnelle porte) depuis `params`.
 * Exporté : partagé avec `cut-plan-rectpack.ts` (branche `coupe`) pour
 * garantir une comparaison d'algos à armes strictement égales.
 */
export function buildCutList(params: Params): WorkingPiece[] {
```

Nothing else changes in this file. No logic modified.

- [ ] **Step 2.2: Typecheck + fixture tests**

Run:
```bash
pnpm -r typecheck
pnpm -C packages/nichoir-core test cut-layout
```

Expected: all green. The 5 fixture parity tests (A/B/C) pass because `computeCutLayout` logic is unchanged — only the visibility of a helper changed.

- [ ] **Step 2.3: Commit**

```bash
git add packages/nichoir-core/src/cut-plan.ts
git commit -m "refactor(core/cut-plan) — expose buildCutList + WorkingPiece (partage avec rectpack)

Extract-method pur : aucune ligne de logique modifiée, seule la visibilité
de l'helper passe de privée à exportée. Les 5 fixtures A-E continuent de
passer à l'identique — contrat shelf-packing strictement préservé."
```

---

## Task 3: Install rectangle-packer + interop spike

**Files:**
- Modify: `packages/nichoir-core/package.json`

**Goal:** Install `rectangle-packer@^1.0.4`. Then do a small spike (a tmp script, not committed) to verify ESM/CJS interop and confirm the `GuillotineBinPack` + `Rect` API shape before writing `cut-plan-rectpack.ts` in Task 4.

- [ ] **Step 3.1: Install the package**

```bash
cd /home/marc/Documents/cabane/nichoir
pnpm add -F @nichoir/core rectangle-packer@^1.0.4
```

Expected: `packages/nichoir-core/package.json` now has `"rectangle-packer": "^1.0.4"` in `dependencies`. `pnpm-lock.yaml` updated.

Verify:
```bash
cat packages/nichoir-core/package.json | grep rectangle-packer
ls node_modules/.pnpm/ | grep rectangle-packer
```

Expected: the package appears in both.

- [ ] **Step 3.2: Inspect the published API**

Run:
```bash
cat node_modules/rectangle-packer/package.json | head -20
cat node_modules/rectangle-packer/type/index.d.ts 2>/dev/null || cat node_modules/rectangle-packer/type/*.d.ts 2>/dev/null | head -50
ls node_modules/rectangle-packer/lib/
```

Record:
- The `main` field → CJS entry (probably `lib/index.js`).
- The `types` field.
- What the default export is (class? function? both?).
- What named exports exist (`Rect`, `FreeRectChoiceHeuristic`, `GuillotineSplitHeuristic`, etc.).

- [ ] **Step 3.3: Spike: confirm interop**

Create a temp file `packages/nichoir-core/_spike-rectpack.mjs` (root of package, NOT in src/):

```js
// Spike : confirme l'import pattern fonctionnel pour rectangle-packer
// en ESM (contexte du package @nichoir/core qui a "type": "module").
// À supprimer après validation — NE PAS commit.

import GuillotineBinPack from 'rectangle-packer';
console.log('default export:', typeof GuillotineBinPack);
console.log('default export keys:', Object.keys(GuillotineBinPack || {}));

// Si le default est un namespace object (CJS interop), les noms sont dedans.
// Si c'est directement la classe, l'instanciation doit marcher :
try {
  const packer = new GuillotineBinPack(100, 100);
  console.log('instance created, methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(packer)));
} catch (e) {
  console.log('default is not constructor, error:', e.message);
}

// Tenter les named exports possibles
import * as RP from 'rectangle-packer';
console.log('namespace keys:', Object.keys(RP));
```

Run:
```bash
cd packages/nichoir-core
node _spike-rectpack.mjs
cd -
```

Record the output. Three likely scenarios:

**A. Default export is the GuillotineBinPack class** (cleanest): use `import GuillotineBinPack from 'rectangle-packer';`

**B. Default export is a namespace object** (`{ GuillotineBinPack: [Function] }`): use `import pkg from 'rectangle-packer'; const { GuillotineBinPack } = pkg;` OR use `createRequire`.

**C. Import fails entirely**: use `createRequire`:
```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const rp = require('rectangle-packer');
const GuillotineBinPack = rp.GuillotineBinPack || rp.default || rp;
```

Pick the working scenario and note it for Task 4.

- [ ] **Step 3.4: Clean up spike + commit package.json**

```bash
rm packages/nichoir-core/_spike-rectpack.mjs
git add packages/nichoir-core/package.json pnpm-lock.yaml
git commit -m "chore(core/deps) — rectangle-packer@^1.0.4 (MIT, zero deps)

Package utilisé par la branche coupe pour benchmark vs shelf-packing.
ESM/CJS interop validé via spike (voir plan)."
```

---

## Task 4: Create cut-plan-rectpack.ts (TDD)

**Files:**
- Create: `packages/nichoir-core/src/cut-plan-rectpack.ts`
- Create: `packages/nichoir-core/tests/cut-plan-rectpack.test.ts`

**Goal:** Implement `computeCutLayoutRectpack(params): CutLayout` with the same signature as `computeCutLayout`. Internal multi-bin loop over `GuillotineBinPack` (the library is single-bin).

- [ ] **Step 4.1: Write the failing test**

Create `packages/nichoir-core/tests/cut-plan-rectpack.test.ts` with:

```ts
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
```

- [ ] **Step 4.2: Run test to confirm failure**

```bash
pnpm -C packages/nichoir-core test cut-plan-rectpack
```

Expected: FAIL with error about missing `computeCutLayoutRectpack` (not yet exported).

- [ ] **Step 4.3: Create `packages/nichoir-core/src/cut-plan-rectpack.ts`**

Use the import pattern determined in Task 3.3. The example below assumes Scenario A (default export is the class). ADAPT the import line based on Task 3.3 findings.

```ts
// src/cut-plan-rectpack.ts
//
// Algorithme alternatif de layout 2D utilisant `rectangle-packer` (MIT).
// Signature identique à `computeCutLayout` (CutLayout multi-bin).
//
// `rectangle-packer`'s `GuillotineBinPack` est SINGLE-BIN ; ce fichier implémente
// la boucle multi-bin autour : pour chaque panneau, on instancie un nouveau
// bin, on y insère ce qui rentre, le reste passe au panneau suivant. Une pièce
// plus grande que le panneau lui-même atterrit directement dans `overflow`.
//
// Partage la même `buildCutList` que `cut-plan.ts` (import local intra-package)
// pour garantir une comparaison d'algos à armes strictement égales.

// IMPORT : adapter selon le résultat du spike Task 3.3 (A/B/C).
// Scenario A (default est la classe) :
import GuillotineBinPack from 'rectangle-packer';
// Scenario B (default est un namespace object) :
// import rp from 'rectangle-packer';
// const { GuillotineBinPack } = rp as { GuillotineBinPack: new (w: number, h: number) => any };
// Scenario C (createRequire) :
// import { createRequire } from 'node:module';
// const require = createRequire(import.meta.url);
// const { GuillotineBinPack } = require('rectangle-packer');

import { buildCutList } from './cut-plan.js';
import type { CutLayout, LayoutPiece, Panel, Params } from './types.js';

const GAP = 5;

// Types minimaux en ligne de l'API rectangle-packer. À adapter après spike Task 3.3
// si les noms/types réels diffèrent.
interface RpRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotated?: boolean;
}

interface RpBin {
  Insert(w: number, h: number, allowFlip: boolean, freeChoice: number, splitChoice: number): RpRect;
  GetOccupancy?(): number;
}

// Heuristique par défaut (citée dans la doc rectangle-packer).
// À adapter si les constantes réelles ont des noms différents.
const HEURISTIC_RECT_BEST_AREA_FIT = 3;        // RectBestAreaFit
const HEURISTIC_SPLIT_SHORTER_LEFTOVER_AXIS = 3; // SplitShorterLeftoverAxis

/** Est-ce que la pièce passe seule dans le panneau, avec ou sans rotation ? */
function fitsInPanel(w: number, h: number, shW: number, shH: number): boolean {
  const fitsNormal = w + 2 * GAP <= shW && h + 2 * GAP <= shH;
  const fitsRotated = h + 2 * GAP <= shW && w + 2 * GAP <= shH;
  return fitsNormal || fitsRotated;
}

/** Retourne true si le résultat d'Insert indique un échec (rectangle de taille 0). */
function isFailedInsert(rect: RpRect): boolean {
  return rect.width === 0 || rect.height === 0;
}

export function computeCutLayoutRectpack(params: Params): CutLayout {
  const shW = params.panelW;
  const shH = params.panelH;
  const allPieces = buildCutList(params);

  // Inflation par GAP : on demande à rectangle-packer d'insérer chaque pièce
  // avec une marge de GAP sur chaque côté (équivalent au comportement de
  // shelf-packing). On insère donc (w + 2*GAP, h + 2*GAP), puis on décale
  // la pièce de GAP depuis le coin du rectangle retourné.
  const inflated = allPieces.map(p => ({
    piece: p,
    wInflated: p._w0 + 2 * GAP,
    hInflated: p._h0 + 2 * GAP,
  }));

  const overflow: LayoutPiece[] = [];
  const panels: Panel[] = [];

  // 1) Filter out pieces strictly too big (before panel loop)
  const packable: typeof inflated = [];
  for (const item of inflated) {
    if (!fitsInPanel(item.piece._w0, item.piece._h0, shW, shH)) {
      const { _w0, _h0, ...clean } = item.piece;
      void _w0; void _h0;
      overflow.push(clean);
    } else {
      packable.push(item);
    }
  }

  // 2) Multi-bin loop
  let remaining = packable.slice();
  while (remaining.length > 0) {
    const bin = new GuillotineBinPack(shW, shH) as unknown as RpBin;
    const placedOnThisBin: LayoutPiece[] = [];
    const failed: typeof remaining = [];

    for (const item of remaining) {
      const rect = bin.Insert(
        item.wInflated,
        item.hInflated,
        true,  // allowFlip (rotation 90°)
        HEURISTIC_RECT_BEST_AREA_FIT,
        HEURISTIC_SPLIT_SHORTER_LEFTOVER_AXIS,
      );

      if (isFailedInsert(rect)) {
        failed.push(item);
        continue;
      }

      // Position du coin : rect.x + GAP, rect.y + GAP (retirer la marge)
      const rotated = rect.rotated === true;
      const origW = item.piece._w0, origH = item.piece._h0;
      const placed: LayoutPiece = {
        ...item.piece,
        px: rect.x + GAP,
        py: rect.y + GAP,
        rot: rotated,
        w: rotated ? origH : origW,
        h: rotated ? origW : origH,
      };
      // Strip working fields
      const { _w0, _h0, ...clean } = placed as unknown as { _w0: number; _h0: number } & LayoutPiece;
      void _w0; void _h0;
      placedOnThisBin.push(clean);
    }

    if (placedOnThisBin.length === 0) {
      // Aucune pièce n'est entrée dans ce bin vide — défense en profondeur.
      // Ne devrait pas arriver puisqu'on a déjà filtré les pièces trop grandes.
      for (const item of remaining) {
        const { _w0, _h0, ...clean } = item.piece;
        void _w0; void _h0;
        overflow.push(clean);
      }
      break;
    }

    const usedArea = placedOnThisBin.reduce((acc, p) => acc + p.w * p.h, 0);
    panels.push({
      pieces: placedOnThisBin,
      shW, shH,
      usedArea,
      occupation: shW * shH > 0 ? usedArea / (shW * shH) : 0,
    });
    remaining = failed;
  }

  const totalUsedArea = panels.reduce((acc, p) => acc + p.usedArea, 0);
  const meanOccupation = panels.length === 0
    ? 0
    : panels.reduce((acc, p) => acc + p.occupation, 0) / panels.length;

  return { panels, overflow, totalUsedArea, meanOccupation };
}
```

**Implementation note on heuristic constants**: the numerical values `3` for both heuristics are guesses. After the spike in Task 3.3, verify the actual enum values exported by `rectangle-packer`. If the library exposes them as named exports (`GuillotineBinPack.FreeRectChoiceHeuristic.RectBestAreaFit`), reference them instead of hardcoding. Update this file accordingly.

- [ ] **Step 4.4: Run tests**

```bash
pnpm -C packages/nichoir-core test cut-plan-rectpack
```

Expected: FAIL on import error (export missing from index.ts). Move to Task 5.

---

## Task 5: Export computeCutLayoutRectpack from index.ts

**Files:**
- Modify: `packages/nichoir-core/src/index.ts`
- Modify: `packages/nichoir-core/CONTRACTS.md`

- [ ] **Step 5.1: Edit `packages/nichoir-core/src/index.ts`**

Find line 7:
```ts
export { computeCutLayout } from './cut-plan.js';
```

REPLACE with:
```ts
export { computeCutLayout } from './cut-plan.js';
export { computeCutLayoutRectpack } from './cut-plan-rectpack.js';
```

- [ ] **Step 5.2: Edit `packages/nichoir-core/CONTRACTS.md`**

Find the section documenting `computeCutLayout`. Below it, add a parallel entry:

```markdown
### `computeCutLayoutRectpack(params: Params): CutLayout`

Alternative algorithm using the `rectangle-packer` (MIT) library. Same
signature as `computeCutLayout`. Multi-bin loop wrapped around
`GuillotineBinPack` (which is single-bin natively). Uses `buildCutList`
from `cut-plan.ts` — both algos consume the same cut list for a strict
comparison. See `runs/2026-04-23-coupe/RESULT.md` for benchmark.

**Heuristic** : `RectBestAreaFit` + `SplitShorterLeftoverAxis` (defaults
cited in rectangle-packer docs).
```

- [ ] **Step 5.3: Rebuild dist + run tests**

```bash
pnpm -C packages/nichoir-core build
pnpm -C packages/nichoir-core test cut-plan-rectpack
```

Expected: all 8 new tests pass. If any fail on unexpected behaviour (e.g., isFailedInsert doesn't detect failure correctly), debug: log `rect` returned by `bin.Insert` for a minimal failing case, adjust detection logic.

- [ ] **Step 5.4: Run full core + ui tests to confirm no regression**

```bash
pnpm -r typecheck
pnpm -r test
```

Expected: all green (486 existing + 8 new = 494 tests, or close).

- [ ] **Step 5.5: Commit**

```bash
git add packages/nichoir-core/src/cut-plan-rectpack.ts \
        packages/nichoir-core/src/index.ts \
        packages/nichoir-core/CONTRACTS.md \
        packages/nichoir-core/tests/cut-plan-rectpack.test.ts

git commit -m "feat(core/cut-plan) — computeCutLayoutRectpack via rectangle-packer (MIT)

Algorithme alternatif multi-bin wrappant GuillotineBinPack (single-bin
natif) avec une boucle outer qui ouvre un nouveau bin quand les rects
restants sont refusés. Même signature que computeCutLayout (CutLayout
multi-bin). Partage la même buildCutList (import intra-package) pour
une comparaison à armes strictement égales.

Heuristiques : RectBestAreaFit + SplitShorterLeftoverAxis.
8 tests invariants (pas d'overlap, pas de débord, overflow correct,
multi-bin sur panneau étroit, etc.)."
```

---

## Task 6: Create PlanTab2.tsx (UI wrapper)

**Files:**
- Create: `packages/nichoir-ui/src/components/tabs/PlanTab2.tsx`
- Modify: `packages/nichoir-ui/src/components/tabs/PlanTab.tsx` (add algoBadge prop to CutLayoutRenderer)
- Modify: `packages/nichoir-ui/src/components/cut-plan/CutLayoutRenderer.tsx` (verify `algoBadge` prop already supported; if not, add it)

- [ ] **Step 6.1: Read `CutLayoutRenderer.tsx` to verify algoBadge prop**

```bash
grep -n "algoBadge\|algoLabel" packages/nichoir-ui/src/components/cut-plan/CutLayoutRenderer.tsx
```

Expected: `algoBadge?: string` already exists (was added in multi-bin commit `4d6903d`). If present, skip to Step 6.2. If absent, add it:

Open the file, find the Props interface, add `algoBadge?: string;`. In the render, where the header text is composed, append ` — ${algoBadge}` conditionally (see existing multi-bin pattern).

- [ ] **Step 6.2: Create `PlanTab2.tsx`**

Create `packages/nichoir-ui/src/components/tabs/PlanTab2.tsx`:

```tsx
// src/components/tabs/PlanTab2.tsx
//
// Onglet "Plan de coupe 2" : même rendu que PlanTab, algorithme différent
// (rectangle-packer au lieu de shelf-packing). Permet une comparaison
// visuelle directe en switchant d'onglet. Réutilise 100% de PlanSizeSection
// + CutLayoutRenderer + PlanStatsSection.

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { computeCutLayoutRectpack } from '@nichoir/core';
import { CutLayoutRenderer } from '../cut-plan/CutLayoutRenderer.js';
import { PlanSizeSection } from './PlanSizeSection.js';
import { PlanStatsSection } from './PlanStatsSection.js';
import styles from './PlanTab.module.css';

export function PlanTab2(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const t = useT();
  const layout = computeCutLayoutRectpack(params);
  return (
    <div className={styles.root}>
      <PlanSizeSection />
      <CutLayoutRenderer layout={layout} t={t} algoBadge="rectangle-packer" />
      <PlanStatsSection />
    </div>
  );
}
```

Note: this reuses `PlanStatsSection` which internally calls `computeCutLayout` (shelf) — that's inconsistent for PlanTab2 which shows rectpack. In Phase 1 MVP we accept this: the stats on PlanTab2 show shelf-packing stats, which is slightly misleading. A proper fix (per-tab stats) is a follow-up; for the benchmark purpose this doesn't matter because the benchmark is run from the CLI script, not read from the UI.

**Deviation from spec**: the spec sketched a minimal PlanTab2 without PlanSizeSection/PlanStatsSection. But PlanSizeSection is essential (panel size selector) and PlanStatsSection provides useful UX. Keeping both → user can compare tabs side-by-side including the panel-size controls. Accept the stats-shows-shelf inconsistency for now.

- [ ] **Step 6.3: Modify `PlanTab.tsx` to add algoBadge**

Read the current `PlanTab.tsx`:
```bash
cat packages/nichoir-ui/src/components/tabs/PlanTab.tsx
```

Find where `CutLayoutRenderer` is used (or the wrapping component `PlanCanvasSection` that uses it). Add the prop `algoBadge="shelf-packing"` to the `CutLayoutRenderer` call.

If `PlanCanvasSection.tsx` is what renders `CutLayoutRenderer` internally, edit that file:
```bash
grep -n "CutLayoutRenderer" packages/nichoir-ui/src/components/tabs/PlanCanvasSection.tsx
```

and add `algoBadge="shelf-packing"` to that render.

- [ ] **Step 6.4: Typecheck**

```bash
pnpm -r typecheck
```

Expected: green.

- [ ] **Step 6.5: Write a test for PlanTab2**

Create `packages/nichoir-ui/tests/PlanTab2.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// Mock viewport (same pattern as PlanTab.test.tsx).
const { mockCtor } = vi.hoisted(() => {
  const mockCtor = vi.fn(() => ({
    mount: vi.fn(),
    update: vi.fn(),
    unmount: vi.fn(),
    readCameraState: vi.fn(),
    captureAsPng: vi.fn(),
  }));
  return { mockCtor };
});

vi.mock('../src/viewports/ImperativeThreeViewport.js', () => ({
  ImperativeThreeViewport: mockCtor,
}));

import { PlanTab2 } from '../src/components/tabs/PlanTab2.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

beforeEach(() => {
  cleanup();
  mockCtor.mockClear();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('PlanTab2 (rectangle-packer)', () => {
  it('renders with algoBadge "rectangle-packer" visible', () => {
    const { container, getByText } = render(<PlanTab2 />);
    // Badge appears in header text
    expect(container.textContent).toContain('rectangle-packer');
    expect(getByText('▸ TAILLE DU PANNEAU')).toBeDefined();
  });

  it('renders at least 1 SVG panel card for default preset', () => {
    const { container } = render(<PlanTab2 />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it('FR→EN labels', () => {
    const { getByText, rerender } = render(<PlanTab2 />);
    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<PlanTab2 />);
    expect(getByText('▸ SHEET SIZE')).toBeDefined();
  });
});
```

- [ ] **Step 6.6: Run tests**

```bash
pnpm -C packages/nichoir-ui test PlanTab2
```

Expected: 3 tests pass. If the badge test fails because `CutLayoutRenderer` doesn't yet render the badge, that means Step 6.1 did find the prop but the render path may differ. Investigate and fix minimally.

- [ ] **Step 6.7: Commit**

```bash
git add packages/nichoir-ui/src/components/tabs/PlanTab2.tsx \
        packages/nichoir-ui/src/components/tabs/PlanTab.tsx \
        packages/nichoir-ui/src/components/tabs/PlanCanvasSection.tsx \
        packages/nichoir-ui/src/components/cut-plan/CutLayoutRenderer.tsx \
        packages/nichoir-ui/tests/PlanTab2.test.tsx

git commit -m "feat(ui) — PlanTab2 (rectangle-packer) + algoBadge sur les 2 onglets

PlanTab2 = thin wrapper sur CutLayoutRenderer qui appelle
computeCutLayoutRectpack. Ajout du prop algoBadge pour marquer chaque
tab (shelf-packing / rectangle-packer) et éviter la confusion UX.

Tests : 3 (render + badge + i18n). PlanStatsSection reste basée sur
shelf — follow-up pour des stats per-tab si besoin."
```

---

## Task 7: Wire PlanTab2 in Sidebar + i18n

**Files:**
- Modify: `packages/nichoir-ui/src/components/Sidebar.tsx`
- Modify: `packages/nichoir-ui/src/i18n/messages.ts`
- Modify: `packages/nichoir-ui/tests/Sidebar.test.tsx` (if exists — update tab count)

- [ ] **Step 7.1: Edit `Sidebar.tsx`**

Find line 16-21 (imports):
```tsx
import { DimTab } from './tabs/DimTab.js';
import { VueTab } from './tabs/VueTab.js';
import { DecoTab } from './tabs/DecoTab.js';
import { CalcTab } from './tabs/CalcTab.js';
import { PlanTab } from './tabs/PlanTab.js';
import { ExportTab } from './tabs/ExportTab.js';
```

INSERT after line `import { PlanTab } ...`:
```tsx
import { PlanTab2 } from './tabs/PlanTab2.js';
```

Find line 25:
```tsx
const TAB_ORDER: readonly TabKey[] = ['dim', 'vue', 'deco', 'calc', 'plan', 'export'];
```

REPLACE with:
```tsx
const TAB_ORDER: readonly TabKey[] = ['dim', 'vue', 'deco', 'calc', 'plan', 'plan2', 'export'];
```

Find the conditional chain in the section body (around line 60-75):
```tsx
        ) : activeTab === 'plan' ? (
          <PlanTab />
        ) : activeTab === 'export' ? (
```

INSERT between `plan` and `export` branches:
```tsx
        ) : activeTab === 'plan' ? (
          <PlanTab />
        ) : activeTab === 'plan2' ? (
          <PlanTab2 />
        ) : activeTab === 'export' ? (
```

- [ ] **Step 7.2: Edit `messages.ts` — FR block**

```bash
grep -n "'tab.plan'" packages/nichoir-ui/src/i18n/messages.ts | head -2
```

Expected: 2 matches (FR and EN). For each, add below the `'tab.plan'` line:

FR (first match) — insert after `'tab.plan': 'PLAN',`:
```ts
    'tab.plan2': 'PLAN 2',
```

EN (second match) — insert after `'tab.plan': 'PLAN',`:
```ts
    'tab.plan2': 'PLAN 2',
```

(Tabs are displayed compactly in the sidebar; "PLAN 2" fits. If visually cluttered in the browser check, change to e.g., `P2` — but start with `PLAN 2`.)

- [ ] **Step 7.3: Check Sidebar test**

```bash
grep -n "tab\|TAB_ORDER\|toHaveLength" packages/nichoir-ui/tests/Sidebar.test.tsx | head -10
```

If any assertion checks `tabs.length === 6` or similar hardcoded count, update to `7`. Otherwise skip.

- [ ] **Step 7.4: Typecheck + run tests**

```bash
pnpm -r typecheck
pnpm -C packages/nichoir-ui test Sidebar
pnpm -C packages/nichoir-ui test PlanTab2
```

Expected: all green. Some existing tests that click `tabs[4]` (PLAN index) or `tabs[5]` (EXPORT index) may need updating: the new tab order shifts EXPORT from index 5 to 6. Fix any broken indices.

- [ ] **Step 7.5: Commit**

```bash
git add packages/nichoir-ui/src/components/Sidebar.tsx \
        packages/nichoir-ui/src/i18n/messages.ts \
        packages/nichoir-ui/tests/

git commit -m "feat(ui) — wire PlanTab2 dans Sidebar + i18n tab.plan2 (fr+en)

Ordre : DIM | VUE | DÉCOR | CALCUL | PLAN | PLAN 2 | EXPORT.
Tests : adaptés si l'index d'EXPORT ou autre était hardcodé (shift +1)."
```

---

## Task 8: Create benchmark CLI script

**Files:**
- Create: `scripts/benchmark-cut-plan.ts`
- Create: `scripts/tsconfig.json`
- Modify: `package.json` (root) — add `benchmark:cut-plan` script

- [ ] **Step 8.1: Create `scripts/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": false,
    "noEmit": true
  },
  "include": ["./*.ts"]
}
```

- [ ] **Step 8.2: Create `scripts/benchmark-cut-plan.ts`**

```ts
// scripts/benchmark-cut-plan.ts
//
// Benchmark comparatif shelf-packing vs rectangle-packer sur les 5 presets
// A-E. Pour chaque (preset, algo) : mesure (nombre de panneaux, occupation
// moyenne, occupation min, gaspillage m², overflow, temps moyen 10 runs),
// exporte un SVG par combinaison, produit un RESULT.md + metrics.json.
//
// Exécution : pnpm benchmark:cut-plan
// Prérequis : @nichoir/core build (fait automatiquement via predev-like chain
// ou manuellement : pnpm -C packages/nichoir-core build).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  computeCutLayout,
  computeCutLayoutRectpack,
  generatePlanSVG,
  type CutLayout,
  type Params,
} from '../packages/nichoir-core/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const PRESETS = ['A', 'B', 'C', 'D', 'E'] as const;
type PresetKey = typeof PRESETS[number];
const ALGOS = ['shelf', 'rectpack'] as const;
type AlgoKey = typeof ALGOS[number];

interface Metrics {
  preset: PresetKey;
  algo: AlgoKey;
  panelCount: number;
  meanOccupation: number;
  minOccupation: number;
  wasteTotalM2: number;
  overflowCount: number;
  elapsedMs: number;
}

function loadPresetParams(letter: PresetKey): Params {
  const fixturePath = join(ROOT, 'packages/nichoir-core/tests/fixtures', `preset${letter}.snapshot.json`);
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  return fixture.state.params as Params;
}

function runAlgo(algo: AlgoKey, params: Params): { layout: CutLayout; elapsedMs: number } {
  const fn = algo === 'shelf' ? computeCutLayout : computeCutLayoutRectpack;
  // Warmup (JIT)
  for (let i = 0; i < 3; i++) fn(params);
  // Measure over N runs
  const N = 10;
  const t0 = performance.now();
  let layout: CutLayout = fn(params);
  for (let i = 1; i < N; i++) layout = fn(params);
  const t1 = performance.now();
  return { layout, elapsedMs: (t1 - t0) / N };
}

function computeMetrics(preset: PresetKey, algo: AlgoKey, layout: CutLayout, elapsedMs: number): Metrics {
  const panelCount = layout.panels.length;
  const minOccupation = panelCount > 0
    ? Math.min(...layout.panels.map(p => p.occupation))
    : 0;
  const wasteTotalMm2 = layout.panels.reduce(
    (acc, p) => acc + (p.shW * p.shH - p.usedArea),
    0,
  );
  return {
    preset,
    algo,
    panelCount,
    meanOccupation: layout.meanOccupation,
    minOccupation,
    wasteTotalM2: wasteTotalMm2 / 1e6,
    overflowCount: layout.overflow.length,
    elapsedMs,
  };
}

function writeArtifactSvg(outDir: string, preset: PresetKey, algo: AlgoKey, layout: CutLayout): string {
  const idTrans = (k: string): string => k;
  const svgs = layout.panels.map((panel, i) => {
    const inner = generatePlanSVG(panel, idTrans);
    return `<!-- Panel ${i + 1} -->\n${inner}`;
  });
  const aggregated = svgs.length > 0 ? svgs.join('\n\n') : '<!-- 0 panels -->';
  const fname = `preset-${preset}-${algo}.svg`;
  writeFileSync(join(outDir, fname), aggregated, 'utf8');
  return fname;
}

function formatTable(metrics: Metrics[]): string {
  const header = '| Preset | Algo     | Panneaux | Occup. moy. | Occup. min | Gaspillage (m²) | Overflow | Temps (ms) |\n';
  const sep    = '|--------|----------|---------:|------------:|-----------:|----------------:|---------:|-----------:|\n';
  const rows = metrics.map(m =>
    `| ${m.preset}      | ${m.algo.padEnd(8)} | ${String(m.panelCount).padStart(8)} | ${(m.meanOccupation * 100).toFixed(1).padStart(10)}% | ${(m.minOccupation * 100).toFixed(1).padStart(9)}% | ${m.wasteTotalM2.toFixed(4).padStart(15)} | ${String(m.overflowCount).padStart(8)} | ${m.elapsedMs.toFixed(3).padStart(10)} |`,
  ).join('\n');
  return header + sep + rows;
}

function aggregateByAlgo(metrics: Metrics[], algo: AlgoKey, field: 'panelCount' | 'meanOccupation' | 'minOccupation' | 'wasteTotalM2' | 'elapsedMs'): { sum: number; mean: number } {
  const vals = metrics.filter(m => m.algo === algo).map(m => m[field]);
  const sum = vals.reduce((a, b) => a + b, 0);
  return { sum, mean: vals.length > 0 ? sum / vals.length : 0 };
}

function formatResult(metrics: Metrics[]): string {
  const shelfPanels = aggregateByAlgo(metrics, 'shelf', 'panelCount');
  const rectPanels  = aggregateByAlgo(metrics, 'rectpack', 'panelCount');
  const shelfOcc    = aggregateByAlgo(metrics, 'shelf', 'meanOccupation');
  const rectOcc     = aggregateByAlgo(metrics, 'rectpack', 'meanOccupation');
  const shelfMinOcc = aggregateByAlgo(metrics, 'shelf', 'minOccupation');
  const rectMinOcc  = aggregateByAlgo(metrics, 'rectpack', 'minOccupation');
  const shelfWaste  = aggregateByAlgo(metrics, 'shelf', 'wasteTotalM2');
  const rectWaste   = aggregateByAlgo(metrics, 'rectpack', 'wasteTotalM2');
  const shelfMs     = aggregateByAlgo(metrics, 'shelf', 'elapsedMs');
  const rectMs      = aggregateByAlgo(metrics, 'rectpack', 'elapsedMs');

  const fmt = (v: number, dec = 2): string => v.toFixed(dec);
  const winner = (shelfVal: number, rectVal: number, lowerIsBetter: boolean): string => {
    if (Math.abs(shelfVal - rectVal) < 1e-6) return 'égalité';
    const shelfWins = lowerIsBetter ? shelfVal < rectVal : shelfVal > rectVal;
    return shelfWins ? '**shelf**' : '**rectpack**';
  };

  return `# Benchmark — shelf-packing multi-bin vs rectangle-packer multi-bin

**Date** : 2026-04-23
**Machine** : ${process.platform} ${process.arch}, Node ${process.version}

## Problème
Deux algorithmes 2D disponibles dans \`@nichoir/core\`. Critère : meilleure
répartition sur les 5 presets de référence A-E.

## Matériaux examinés
- \`packages/nichoir-core/src/cut-plan.ts\` — shelf-packing (multi-bin)
- \`packages/nichoir-core/src/cut-plan-rectpack.ts\` — rectangle-packer wrapper
- 5 fixtures \`preset{A..E}.snapshot.json\`
- \`rectangle-packer@1.0.4\` (npm, MIT, zero deps)

## Résultats bruts

${formatTable(metrics)}

## Résultats par critère

### Nb panneaux (moins = mieux)
- shelf    : somme = ${shelfPanels.sum}, moyenne = ${fmt(shelfPanels.mean)}
- rectpack : somme = ${rectPanels.sum}, moyenne = ${fmt(rectPanels.mean)}
- gagnant  : ${winner(shelfPanels.mean, rectPanels.mean, true)}

### Occupation moyenne (plus = mieux)
- shelf    : moyenne = ${fmt(shelfOcc.mean * 100)}%
- rectpack : moyenne = ${fmt(rectOcc.mean * 100)}%
- gagnant  : ${winner(shelfOcc.mean, rectOcc.mean, false)}

### Occupation minimale (plus = mieux)
- shelf    : moyenne = ${fmt(shelfMinOcc.mean * 100)}%
- rectpack : moyenne = ${fmt(rectMinOcc.mean * 100)}%
- gagnant  : ${winner(shelfMinOcc.mean, rectMinOcc.mean, false)}

### Gaspillage total (moins = mieux)
- shelf    : somme = ${fmt(shelfWaste.sum, 4)} m²
- rectpack : somme = ${fmt(rectWaste.sum, 4)} m²
- gagnant  : ${winner(shelfWaste.sum, rectWaste.sum, true)}

### Temps d'exécution (information)
- shelf    : moyenne = ${fmt(shelfMs.mean, 3)} ms
- rectpack : moyenne = ${fmt(rectMs.mean, 3)} ms

## Cause racine du verdict
[à compléter après inspection visuelle des SVG dans \`artifacts/\`]

Éléments objectifs :
- rectangle-packer utilise l'heuristique RectBestAreaFit + SplitShorterLeftoverAxis.
- shelf-packing utilise le tri par hauteur desc + placement shelf classique.
- Les deux algos reçoivent la même cut list (façades en boîte englobante).

## Verdict candidat
- [ ] shelf gagne
- [ ] rectpack gagne
- [ ] égalité — je garde le plus simple (shelf, pas de dépendance externe)

## Incertitude résiduelle
- Les 5 presets ne couvrent pas tous les cas atypiques (panneaux très
  petits, configurations extrêmes de taperX ou ridge=miter).
- Temps machine-dépendant, pas comparable cross-platform.
- rectangle-packer est peu maintenu (v1.0.4 stable depuis années) — si
  retenu, on assume le maintien.
`;
}

async function main(): Promise<void> {
  const outDir = join(ROOT, 'runs/2026-04-23-coupe');
  const artifactsDir = join(outDir, 'artifacts');
  const stateDir = join(outDir, 'state');
  if (!existsSync(artifactsDir)) mkdirSync(artifactsDir, { recursive: true });
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });

  const allMetrics: Metrics[] = [];
  const artifactsManifest: Array<{ path: string; preset: PresetKey; algo: AlgoKey }> = [];

  for (const preset of PRESETS) {
    const params = loadPresetParams(preset);
    for (const algo of ALGOS) {
      console.log(`Running preset=${preset} algo=${algo}…`);
      const { layout, elapsedMs } = runAlgo(algo, params);
      const m = computeMetrics(preset, algo, layout, elapsedMs);
      allMetrics.push(m);
      const fname = writeArtifactSvg(artifactsDir, preset, algo, layout);
      artifactsManifest.push({ path: fname, preset, algo });
    }
  }

  const resultMd = formatResult(allMetrics);
  writeFileSync(join(outDir, 'RESULT.md'), resultMd, 'utf8');

  writeFileSync(
    join(stateDir, 'metrics.json'),
    JSON.stringify(
      {
        task_id: 'coupe-benchmark',
        status: 'completed',
        runs: allMetrics,
        machine: { platform: process.platform, arch: process.arch, node: process.version },
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(artifactsDir, 'manifest.json'),
    JSON.stringify({ entries: artifactsManifest }, null, 2),
    'utf8',
  );

  writeFileSync(
    join(stateDir, 'NOTES.md'),
    `# NOTES — coupe benchmark\n\n## Observations\n\n(à compléter)\n`,
    'utf8',
  );

  console.log(`\nDone. See ${join(outDir, 'RESULT.md')}.`);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
```

- [ ] **Step 8.3: Add `benchmark:cut-plan` script to root `package.json`**

Open `package.json` (root). In the `"scripts"` section, add:

```json
"benchmark:cut-plan": "node --experimental-strip-types scripts/benchmark-cut-plan.ts"
```

**Note on execution**: Node 22+ supports `--experimental-strip-types` for running `.ts` files directly. If the user's Node is older (20), install `tsx` as a devDependency and use `"benchmark:cut-plan": "tsx scripts/benchmark-cut-plan.ts"` instead. Check `node --version` before deciding. If tsx is needed:
```bash
pnpm add -D -w tsx
```
Then use the `tsx` script form.

- [ ] **Step 8.4: Rebuild core dist (benchmark reads from dist)**

```bash
pnpm -C packages/nichoir-core build
```

- [ ] **Step 8.5: Run benchmark**

```bash
pnpm benchmark:cut-plan
```

Expected:
- 10 `Running preset=X algo=Y…` log lines.
- `Done. See …/RESULT.md.`
- `runs/2026-04-23-coupe/RESULT.md` written.
- `runs/2026-04-23-coupe/state/metrics.json` written.
- `runs/2026-04-23-coupe/artifacts/` contains 10 SVG files + `manifest.json`.

Inspect the RESULT.md:
```bash
cat runs/2026-04-23-coupe/RESULT.md | head -40
```

Verify the table has 10 rows (5 presets × 2 algos), all filled.

- [ ] **Step 8.6: Commit**

```bash
git add scripts/benchmark-cut-plan.ts scripts/tsconfig.json package.json
# pnpm-lock.yaml if tsx was added

git commit -m "feat(scripts) — benchmark-cut-plan script (shelf vs rectpack sur 5 presets)

Charge les 5 fixtures, execute les 2 algos avec warmup + moyenne 10 runs,
compute metrics (panels, occupation moyenne/min, gaspillage m², temps),
écrit RESULT.md + metrics.json + SVG par combinaison.

Réexécutable : pnpm benchmark:cut-plan."
```

Note: the `runs/2026-04-23-coupe/` artifacts are committed in Task 9 (after they exist).

---

## Task 9: Commit benchmark artifacts

**Files:**
- `runs/2026-04-23-coupe/RESULT.md` (written by Task 8)
- `runs/2026-04-23-coupe/state/metrics.json`
- `runs/2026-04-23-coupe/state/NOTES.md`
- `runs/2026-04-23-coupe/artifacts/*.svg` (10 files)
- `runs/2026-04-23-coupe/artifacts/manifest.json`

- [ ] **Step 9.1: Verify artifacts exist**

```bash
ls runs/2026-04-23-coupe/
ls runs/2026-04-23-coupe/artifacts/
ls runs/2026-04-23-coupe/state/
```

Expected:
- `TASK.md`, `PLAN.md`, `RESULT.md`, `artifacts/`, `state/`.
- `artifacts/`: 10 SVG files + `manifest.json`.
- `state/`: `metrics.json`, `NOTES.md`.

- [ ] **Step 9.2: Commit**

```bash
git add runs/2026-04-23-coupe/
git commit -m "docs(evidence) — RESULT.md + metrics + 10 SVG benchmark (shelf vs rectpack)

5 presets × 2 algos = 10 SVG d'artifacts. metrics.json au format harness
projet. RESULT.md avec tableau + agrégats par critère + verdict candidat
à cocher."
```

---

## Task 10: Update README.md and HANDOVER.md

**Files:**
- Modify: `README.md`
- Modify: `HANDOVER.md`

- [ ] **Step 10.1: Edit `README.md`**

Find the line (roughly) that says `- **PLAN** — plan de coupe 2D multi-bin avec layout shelf-packing, export ZIP (1 SVG par panneau)`.

Below that line, add:
```
  - **PLAN 2** — même rendu que PLAN, mais utilise `rectangle-packer` (MIT) au lieu du shelf-packing. Permet une comparaison visuelle directe. Voir `runs/2026-04-23-coupe/RESULT.md` pour le benchmark chiffré.
```

Find the existing "Roadmap" section. Move `Benchmark comparatif shelf-packing vs rectangle-packer (branche coupe à venir)` from the "Ouvert" bucket to the "Dette fermée" bucket if it's there; or add a new line there:
```
  - Benchmark shelf vs rectpack (branche `coupe`) — évidence chiffrée produite par `pnpm benchmark:cut-plan`.
```

- [ ] **Step 10.2: Edit `HANDOVER.md`**

Add a new section at the end:

```markdown

---

## Branche `coupe` (2026-04-23)

Installe `rectangle-packer@1.0.4` + ajoute l'onglet "Plan de coupe 2" + produit le benchmark comparatif.

**Commits** : voir `git log --oneline multi-bin..coupe`.

**Evidence** : `runs/2026-04-23-coupe/RESULT.md` (+ 10 SVG dans `artifacts/`).

**Décision** : à la charge de l'utilisateur après inspection du RESULT.md.
Le verdict coche l'option dans la section "Verdict candidat". Sur branche
future `cleanup-cut-plan`, suppression de l'algo perdant + son tab.
```

- [ ] **Step 10.3: Commit**

```bash
git add README.md HANDOVER.md
git commit -m "docs — mention PlanTab2 + benchmark coupe (tableau comparatif)"
```

---

## Task 11: Final validation + handoff

**Files:** none modified.

- [ ] **Step 11.1: Run all checks clean**

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```

All must be green. Test count should be ~494-497 (489 baseline + 8 rectpack + 3 PlanTab2 ≈ 500).

- [ ] **Step 11.2: Summary diff stat**

```bash
git log --oneline main..HEAD | head -20
git diff --stat main..HEAD | tail -3
```

Record output.

- [ ] **Step 11.3: Report to user**

Tell the user:

```
Branche `coupe` prête à review.

Commits : [git log multi-bin..HEAD]

Prochaine action utilisateur :
1. Lire runs/2026-04-23-coupe/RESULT.md (tableau + gagnants par critère).
2. Cocher l'option verdict (shelf / rectpack / égalité).
3. Décider : merger multi-bin puis coupe, OU rester en local pour tester.

Le dev server peut être lancé (cd apps/demo && pnpm dev) pour comparer
visuellement les 2 onglets PLAN / PLAN 2 sur des configs custom.
```

Do NOT push, do NOT merge. Wait for user instruction.

---

## Self-Review

Completed inline after writing the plan:

**1. Spec coverage**
- §5.1 rectangle-packer install → Task 3.
- §5.2 cut-plan-rectpack.ts → Tasks 4, 5.
- §5.3 PlanTab2.tsx → Task 6.
- §5.4 sidebar + store + i18n → Tasks 1, 7.
- §5.5 files created/modified → covered across all tasks.
- §6 benchmark CLI → Task 8.
- §6.2 RESULT.md format → Task 8 `formatResult` function.
- §6.3 metrics → Task 8 `computeMetrics`.
- §7 tests (core + UI + smoke) → Tasks 4 (core), 6 (UI), 8 (smoke via benchmark execution).
- §8 acceptance criteria → Task 11.
- §9 risks (esp. ESM/CJS interop) → Task 3 spike.
- §10 open questions → addressed:
  - `buildCutList` extraction: yes, Task 2 (minimal, validated).
  - Heuristic: `RectBestAreaFit + SplitShorterLeftoverAxis` per Task 4.
  - Tab name: "Plan de coupe 2" / "Cut plan 2" per Task 7 i18n.

**2. Placeholder scan**
- Task 4 heuristic constants `3`/`3` are flagged as guesses — the note explicitly says to verify after spike. This is an *investigative* step with adapt-after-check guidance, not a placeholder.
- Task 8 step 8.3 Node/tsx decision is explicit runtime check, not a placeholder.
- Task 8.2 `[à compléter après inspection visuelle…]` in the RESULT.md template is the user's manual step (verdict), not a plan placeholder.

No "TBD"/"TODO"/"add validation" generic placeholders.

**3. Type consistency**
- `TabKey` extended to include `'plan2'` in Task 1, consumed in Task 7.
- `CutLayout` signature unchanged (already `{ panels, overflow, totalUsedArea, meanOccupation }` from multi-bin).
- `buildCutList` exported in Task 2, imported in Task 4 as `import { buildCutList } from './cut-plan.js';`.
- `computeCutLayoutRectpack` defined in Task 4, exported in Task 5, imported in Task 6 (`@nichoir/core`), used in Task 8.

**4. Ambiguity check**
- Task 3 scenario-based approach (A/B/C) handles the ESM/CJS interop uncertainty explicitly. Implementer picks based on spike output.
- Task 4 heuristic constants are explicitly flagged as guesses; implementer verifies after spike.
- Task 6.2 deviation from spec (keep PlanSizeSection/PlanStatsSection) is documented inline.

Plan complete.
