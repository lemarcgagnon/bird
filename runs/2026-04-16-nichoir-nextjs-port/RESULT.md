# RESULT — P0 bootstrap + contracts freeze

**Status** : ✅ COMPLÉTÉ avec remédiation
**Date** : 2026-04-16
**Orchestrateur** : Claude (Opus 4.7)

---

## Evidence Document

### Problème

Porter le calculateur Nichoir (vanilla ES + Three.js r128 CDN) vers un monorepo
Next.js structuré en 3 packages (`nichoir-core`, `nichoir-ui`, `nichoir-adapters`),
avec contrats publics figés avant tout code métier. Sans casser l'application
existante servie sur `http://localhost:8765/`.

### Matériaux examinés

- **Revue Claude ↔ codex** (3 itérations) → convergence sur architecture 3 packages,
  Three.js impératif + `ViewportAdapter`, i18n plat conservé, server-authoritative
  par défaut, `generatePlanPNG` exclu du core (raster = UI).
- **Code source v15** : `src/state.js`, `src/calculations.js`, `src/cut-plan.js`,
  `src/geometry/panels.js`, `src/geometry/deco.js`, `src/exporters/stl.js`,
  `src/exporters/plan.js` — lus directement par Agent A et cross-checkés par orchestrateur.

### Symptômes / contraintes

- L'application existante (`index.html` + `src/**/*.js`) doit rester intacte et fonctionnelle.
- Les contrats publics doivent être figés avant toute ligne de code métier.
- Le core doit être zéro DOM, zéro React, zéro Next, testable en Node pur.
- TypeScript strict obligatoire.

### Cause racine (Assumption)

Les décisions architecturales ne sont pas des « causes » au sens d'un bug ;
elles sont le résultat de la convergence Claude↔codex↔user. L'ambiguïté initiale
— mélanger en un seul effort 4 chantiers (migration Next.js + React + 3D + SaaS)
— a été levée par codex qui a proposé un découpage 3 packages + 4 phases.

### Résolution appliquée

**Vague 1** — Agent Explore (sonnet) a produit un inventaire exhaustif de 46 types
et signatures depuis 8 fichiers source.

**Vague 2 (synthèse)** — Orchestrateur a rédigé 2 documents d'autorité :
- `packages/nichoir-core/CONTRACTS.md` (6 invariants, surface publique complète)
- `packages/nichoir-adapters/ADAPTERS.md` (5 ports + politique des fakes)

**Vague 2 (revue)** — Code-reviewer (sonnet) a validé les contrats avec 3 écarts
critiques + 5 mineurs + 4 risques. Corrections appliquées :
1. `buildDecoGeoHeightmap` — layout RGBA explicite ajouté (sinon ambiguïté silencieuse)
2. `generateHouseSTL` — invariant "ignore explodeDistance" documenté
3. Grep `\bt(` remplacé par regex précise (faux positifs évités)
4. `BuildDerived` — champs préservés fidèlement au source
5. `LayoutPiece.nameKey` — note "clé opaque i18n, résolue par caller"
6. `placeDecoOnPanel` — mutation in-place documentée
7. `PanelDef.key` — typage strict via `PanelDefKey` literal union
8. `buildPanelDefs` — déps explicitées (lit params/clip/decos uniquement)
9. ADAPTERS : erreur factuelle sur `JSON.stringify(Uint8ClampedArray)` corrigée (retournait `{}`, pas `[...]`)
10. `FakeAuthContext` clarifié comme objet littéral (non-classe)
11. `DownloadService` — dette de contrat acceptée documentée

**Vague 3** — Agent bootstrap (general-purpose sonnet) a créé la structure monorepo.

**Vague 4** — Code-reviewer a identifié 3 écarts résiduels.

**Remédiation** — Agent E (general-purpose sonnet) a fermé les 3 écarts :
- Extraction de 236 lignes de types depuis CONTRACTS.md vers `nichoir-core/src/types.ts`
- Création des 5 ports (interfaces) + 5 fakes (impls)
- Correction `next.config.ts` (`outputFileTracingRoot`)
- Ajout `"DOM"` au lib de `nichoir-adapters` (requis pour `BrowserDownloadService`)

### Validation

Commandes exécutées par l'orchestrateur (evidence directe, pas déléguée) :

| Commande | Résultat | Citation |
|---|---|---|
| `pnpm -r typecheck` | ✅ 4/4 | `packages/nichoir-core typecheck: Done ... apps/demo typecheck: Done` |
| `pnpm -r test` | ✅ 6 tests | core 1, adapters 4, ui 1 — tous passent |
| `pnpm -r --filter './packages/*' build` | ✅ 3/3 | `packages/nichoir-core build: Done ...` |
| `grep -rE "\|document\|window\|HTMLCanvas..."` dans `core/src` | ✅ zéro match | invariant I1 respecté |
| `grep DOM dans adapters/src/ports` | ✅ zéro match (hors JSDoc) | invariant A3 respecté |
| `grep DOM dans BrowserDownloadService.ts` | 6 matches (attendus) | usage scoped au fake browser |
| MD5 CONTRACTS.md + ADAPTERS.md | stable post-remédiation | contrats intacts |

### Incertitude résiduelle

1. **pnpm version** — bootstrap fait avec pnpm 10.31, CI pointe pnpm 9 via action-setup.
   Non-bloquant pour P0 mais à aligner avant que la CI soit utilisée en prod.
2. **`DOM` lib au niveau package de `nichoir-adapters`** — compromis pragmatique.
   L'alternative (tsconfig par fichier) est trop lourde pour P0. L'invariant A3
   est maintenu par grep-check dans la checklist ADAPTERS.md, pas par le compilateur.
3. **Three.js r160 vs r128** — le core utilise r160 (npm), le v15 utilise r128 (CDN).
   La parité numérique des BufferGeometry devra être validée en P1 avec snapshots
   sur 5 presets (documenté dans PLAN.md P1).
4. **`next lint` dépréciée (Next 15)** — warning préexistant, migration vers ESLint CLI
   direct à prévoir avant Next 16.
5. **Types `NichoirState` avec `Uint8ClampedArray`** — le `ProjectStore` réel (P3)
   devra implémenter une sérialisation dédiée. La fake in-memory évite le problème
   (références directes).

### Critères d'acceptance — status

- [x] Monorepo bootstrappé, TS strict, Vitest, lint, CI (verts)
- [x] `packages/nichoir-core/CONTRACTS.md` figé et validé par 2 revues
- [x] `packages/nichoir-adapters/ADAPTERS.md` figé et validé par 2 revues
- [x] Types extraits 1:1 de v15 (236 lignes dans `types.ts`)
- [x] `pnpm install/test/build/lint` verts sur les 3 packages
- [x] Fichiers existants intacts (aucun match de glob sur `src/`, `index.html`, etc.)

---

## Artifacts promus

| Path | Description |
|---|---|
| `packages/nichoir-core/CONTRACTS.md` | Contrat public du core (source d'autorité) |
| `packages/nichoir-adapters/ADAPTERS.md` | Contrats des 5 ports SaaS |
| `packages/nichoir-core/src/types.ts` | 236 lignes de types TypeScript stricts |
| `packages/nichoir-adapters/src/ports/*.ts` | 5 interfaces de ports |
| `packages/nichoir-adapters/src/fakes/*.ts` | 5 impls de référence |
| `.github/workflows/ci.yml` | Pipeline typecheck+lint+test+build |

---

## P1.0 — Capture fixtures (addendum post-P0)

**Status** : ✅ FERMÉ sous **Option A+ mitigation renforcée** (décidé conjointement user↔codex 2026-04-16)

**Décision d'architecture** : la source d'autorité opérationnelle pour P1 est `src/*` modular refactor. Cette source n'est pas indépendante de v15 — mitigation via garde-fou automatisé indépendant.

**Garde-fou `verify-v15-anchors.mjs`** : script Node + puppeteer-core + Chromium système qui :
- Ouvre `http://localhost:8765/nichoir_v15.html` dans un vrai navigateur headless
- Applique les 3 presets A/B/C via manipulation DOM
- Lit `volumes.ext`, `volumes.int`, `surfaces.total`, et la présence/absence de `doorPanel` dans le CALC tab
- Compare aux fixtures avec tolérance 1% (justifiée par l'arrondi d'affichage `.toFixed(2)` en L)

**Résultat** : 3/3 presets GREEN, tous les deltas < 0.1% (bien sous la tolérance 1%).

```
Preset A: Δrel max 0.0582% ✓ (4 checks)
Preset B: Δrel max 0.0701% ✓ (4 checks)
Preset C: Δrel max 0.0591% ✓ (4 checks)
```

**Correction post-revue** : script initialement avec `waitUntil: 'networkidle0'` timeoutait sur les runs subséquents (CDN cdnjs variable). Corrigé en `waitUntil: 'domcontentloaded'` + attente explicite de `window.THREE`. MD5 des fixtures inchangé.

**Limites documentées** :
- Le garde-fou vérifie 4 anchors par preset (volumes×2, surfaces total, doorPanel). D n'exerce pas toutes les fonctions de parité (triangle count STL, SVG structure).
- La rigueur de la mitigation est **suffisante pour démarrer P1.1** mais peut être étendue si un delta est découvert pendant le port.

## P1 — Fermé intégralement (addendum post-P1.3)

**Status** : ✅ COMPLÉTÉ — **parité A/B/C avec src, parité snapshot-régression D/E avec TS port**

### Modules portés

| Module | Lignes | Tests | Statut |
|---|---|---|---|
| `state.ts` | 77 | 3 | Port fidèle (+3 champs DecoSlotCore) |
| `calculations.ts` | 149 | 6 | Port fidèle (omission `T` unused) |
| `cut-plan.ts` | 77 | 6 | Port fidèle (drawCutPlan exclu) |
| `geometry/panels.ts` | 489 | 69 | Port fidèle (tuple→objet, emptiness check, door.type guard) |
| `geometry/deco.ts` | 292 | 23 | Port fidèle (scission vector/heightmap, throw [16,128], no DOM) |
| `exporters/stl.ts` | 153 | 11 | Port fidèle (geometryTriangles au lieu de mesh, pas de DL) |
| `exporters/zip.ts` | 63 | 5 | Port fidèle (JSZip bundlé, translate injecté) |
| `exporters/svg.ts` | 74 | 6 | Port fidèle (retour string, translate injecté) |

**Total** : **130 tests verts** dans 7 test files.

### Invariants maintenus (runtime code, excluant commentaires doc)

```
grep DOM (document|window|HTMLCanvas|…|Image)    → 0 match
grep Blob/URL (Blob|URL.createObjectURL|…)       → 0 match
grep React/Next (from 'react'|from 'next/')      → 0 match
grep i18n (from '*i18n'|import *translations)    → 0 match
```

### Parité vérifiée

| Preset | Source | Couverture |
|---|---|---|
| A, B, C | src/* (parité visuelle v15 + garde-fou puppeteer A+) | 45 tests panels + 6 calc + 6 cutLayout + 3 state + 15 STL/ZIP/SVG exports |
| D, E | Capture mixte TS+src | 24 tests panels + 8 STL/ZIP/SVG (même couverture structurelle que A/B/C) |

### MD5 stables (idempotence confirmée)

```
b0081bb3209d57d3a5b702d9b095ef7c  presetA.snapshot.json
a8a8c4793d832cee0917dd1217c58053  presetB.snapshot.json
3e4c95a38b3d6c72ae8911a881b16598  presetC.snapshot.json
e104c1c81b0afac00b8da8884f0d97eb  presetD.snapshot.json
a5ed18ed689d39dea02e0e90edafdd81  presetE.snapshot.json
b500f62b97413c9776f0cd528d20e9a9  CONTRACTS.md
1664618fb8e4bd2b7db3963f6d8d899d  ADAPTERS.md
```

### Limites assumées (documentées)

1. **D/E = capture mixte** (TS port pour geometry+STL, src/* pour calculations+cutLayout+SVG). Raison : src.buildDecoGeo heightmap branch DOM-bound ⇒ incapturable en Node.
2. **D/E = snapshots de régression du port TS**, pas références indépendantes vs v15. Le spot-check browser reste possible en UI P2.
3. **Packing layout overflow paths** : couverts par 3 tests dédiés mais pas sur les 5 presets de référence (le panneau 1220×2440 les accommode tous).

### Prérequis pour P2 (bloquant)

Per ACCEPTANCE-P1-P2.md section P2 Entrées :
> `ViewportAdapter` formalisé dans `packages/nichoir-ui/VIEWPORT.md` (interface TS canonique mount/update/unmount, nature des updates, ownership du DOM element, cycle de vie, stratégie de clean-up). Validé par orchestrateur + codex AVANT que le premier composant `ImperativeThreeViewport.tsx` soit écrit.

## Prochaines étapes (P1)

Porter la logique pure de v15 vers `@nichoir/core` :
1. `state.ts` + `calculations.ts` (pur data, parité numérique stricte)
2. `cut-plan.ts` (layout pur)
3. `geometry/panels.ts` + `geometry/deco.ts` (avec branches pures vector/heightmap)
4. `exporters/stl.ts` + `exporters/zip.ts` + `exporters/svg.ts` (pur bytes/string)
5. Tests de référence : snapshots JSON de `buildPanelDefs` sur 5 presets

Hors P1 : UI React, Three.js viewport, adaptateurs SaaS réels.
