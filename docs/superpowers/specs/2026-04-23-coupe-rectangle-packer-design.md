# Design — Install de rectangle-packer + onglet "Plan de coupe 2" + benchmark comparatif

**Date** : 2026-04-23
**Branche cible** : `coupe`
**Dépendances** : branche `multi-bin` mergée dans `main` (voir `2026-04-23-multi-bin-cut-plan-design.md`)
**Bloque** : branche `cleanup-cut-plan` future (suppression de l'algo perdant, hors scope)

---

## 1. But

Installer `rectangle-packer` (npm, repo `SilenceLeo/rectangle-packer`, MIT, v1.0.4) dans `@nichoir/core`, l'exposer via un **nouvel onglet "Plan de coupe 2"** parallèle au PlanTab existant, et produire un **benchmark documenté** qui permette de trancher objectivement lequel des deux algorithmes donne la meilleure répartition sur les 5 presets de référence.

L'onglet existant "Plan de coupe" continue d'utiliser le shelf-packing multi-bin (issu de la branche `multi-bin`). Les deux algos sont **isolés** : chacun dans son fichier core, chacun dans son tab, seul le rendu SVG est partagé (composant `CutLayoutRenderer` créé en `multi-bin`).

## 2. Motivation

- **Evidence avant décision** : plutôt qu'adopter un algo par opinion, les deux tournent en parallèle, un benchmark chiffré tranche.
- **rectangle-packer** propose des heuristiques (Guillotine BestAreaFit, SplitShorterLeftoverAxis) théoriquement supérieures au shelf-packing naïf pour les pièces hétérogènes — à vérifier empiriquement.
- **Isolation** : les deux algos coexistent sans interaction, donc un bug dans l'un n'affecte pas l'autre. Le gagnant sera retenu après la décision, sur une branche ultérieure.

## 3. Non-goals

- **Pas de modification fonctionnelle de `cut-plan.ts`** (shelf-packing). Une extraction pure de helper (`buildCutList`) est autorisée *si et seulement si* elle est sans changement de comportement et validée par les 5 snapshots. Sinon, duplication dans `cut-plan-rectpack.ts`.
- **Pas de modification de `PlanTab.tsx`** existant. Il reste sur shelf-packing.
- **Pas de suppression d'algo**. La suppression du perdant se fera sur une branche future (`cleanup-cut-plan`) après que l'utilisateur ait tranché sur la base du `RESULT.md`.
- **Pas de feature flag / toggle intra-tab**. Les algos sont séparés par tabs, pas par toggle.
- **Pas de décomposition de la façade pentagonale** — les deux algos reçoivent la même cut list avec façade en boîte englobante (armes strictement égales). Optimisation indépendante, hors scope.

## 4. Dépendance critique

Cette branche **présuppose** que `multi-bin` est mergée. Raison : le contrat `CutLayout` est `{ panels: Panel[], overflow, totalUsedArea, meanOccupation }` (nouveau format). Sans ce contrat, rectangle-packer n'a pas de sortie cohérente à produire.

Si `multi-bin` n'est pas mergé au moment d'ouvrir `coupe`, **bloquer** jusqu'à résolution.

## 5. Architecture

### 5.1 Installation

`packages/nichoir-core/package.json` :
```json
"dependencies": {
  "jszip": "^3.10.1",
  "rectangle-packer": "^1.0.4",
  "three": "^0.160.0"
}
```

Vérifier après install :
- Taille bundle : rectangle-packer est "zero dependencies" selon son README, check `pnpm why`.
- Compatibilité ESM : le package publie `main: "lib/index.js"` et `types: "type/index.d.ts"`. Si import cassé avec `"type": "module"` de `@nichoir/core`, appliquer wrapper CJS ou tsup avec externals.
- Licence MIT confirmée à l'install (compatible projet privé).

### 5.2 Nouveau fichier core

Fichier : `packages/nichoir-core/src/cut-plan-rectpack.ts`

```ts
import type { Params, CutLayout, Panel, LayoutPiece } from './types.js';
// eslint-disable-next-line import/no-unresolved
import GuillotineBinPack, { Rect } from 'rectangle-packer';

export function computeCutLayoutRectpack(params: Params): CutLayout {
  // 1. Construire la même cut list que computeCutLayout (réutiliser helper extrait ou dupliquer)
  // 2. Boucle multi-bin :
  //    pending = cut list
  //    panels = []
  //    tant que pending non-vide :
  //      bin = new GuillotineBinPack(shW, shH)
  //      placés = bin.InsertSizes(pending, rotation=true, RectBestAreaFit, SplitShorterLeftoverAxis)
  //      si placés vide : (cas pièce > panel) overflow + retirer de pending
  //      sinon : panels.push(panel), retirer les placés de pending
  // 3. Calculer occupation par panel, meanOccupation global
  // 4. Retourner CutLayout
}
```

**Point d'attention** : la construction de la cut list (les 7 rectangles dimensionnés à partir de `Params`) est actuellement inline dans `cut-plan.ts`. **Option recommandée** : extraire un helper partagé `buildCutList(params): LayoutPiece[]` dans `cut-plan.ts` (exporté), et le consommer depuis `cut-plan-rectpack.ts`. Garantit que les deux algos reçoivent la même cut list, comparaison à armes égales.

Si l'extraction du helper touche trop le shelf-packing (risque de régression), alternative : dupliquer la construction dans `cut-plan-rectpack.ts`. Moins DRY mais isolation plus stricte. **À trancher au moment de l'implémentation selon la taille de la modif.**

### 5.3 Nouveau composant UI

Fichier : `packages/nichoir-ui/src/components/tabs/PlanTab2.tsx`

```tsx
import { computeCutLayoutRectpack } from '@nichoir/core';
import { CutLayoutRenderer } from '../cut-plan/CutLayoutRenderer';

export function PlanTab2() {
  const params = useStore(s => s.params);
  const layout = useMemo(() => computeCutLayoutRectpack(params), [params]);
  return (
    <CutLayoutRenderer
      layout={layout}
      algoLabel="rectangle-packer"
      algoBadge="algo: rectangle-packer"
    />
  );
}
```

**Rendu 100 % identique** à PlanTab. Seul change : l'appel de fonction et les badges.

Symétriquement, ajouter le badge `algo: shelf-packing` dans `PlanTab.tsx` existant (la seule modif côté PlanTab, cosmétique, pour éviter la confusion utilisateur).

### 5.4 Intégration sidebar / store / i18n

`packages/nichoir-ui/src/store.ts` :
```ts
type TabId = 'dim' | 'vue' | 'deco' | 'calc' | 'plan' | 'plan2' | 'export';
```

`packages/nichoir-ui/src/components/Sidebar.tsx` :
- Ajouter un 7ᵉ bouton entre "PLAN" et "EXPORT".
- Ordre final : `DIM | VUE | DÉCOR | CALCUL | PLAN | PLAN 2 | EXPORT`.

`packages/nichoir-ui/src/i18n/messages.ts` :
```ts
fr: { tabs: { ..., plan2: 'Plan de coupe 2', ... } }
en: { tabs: { ..., plan2: 'Cut plan 2',     ... } }
```

### 5.5 Fichiers créés / modifiés

| Fichier | Nature |
|---|---|
| `packages/nichoir-core/package.json` | `rectangle-packer` ajouté |
| `packages/nichoir-core/src/cut-plan-rectpack.ts` | **nouveau** |
| `packages/nichoir-core/src/cut-plan.ts` | *optionnel* — extraction `buildCutList` si retenu |
| `packages/nichoir-core/src/index.ts` | réexport `computeCutLayoutRectpack` |
| `packages/nichoir-core/tests/cut-plan-rectpack.test.ts` | **nouveau** |
| `packages/nichoir-core/CONTRACTS.md` | doc `computeCutLayoutRectpack` |
| `packages/nichoir-ui/src/components/tabs/PlanTab2.tsx` | **nouveau** |
| `packages/nichoir-ui/src/components/tabs/PlanTab.tsx` | ajout badge cosmétique |
| `packages/nichoir-ui/src/components/Sidebar.tsx` | 7ᵉ onglet |
| `packages/nichoir-ui/src/store.ts` | `TabId` étendu |
| `packages/nichoir-ui/src/i18n/messages.ts` | libellé `tabs.plan2` |
| `packages/nichoir-ui/tests/tabs/PlanTab2.test.tsx` | **nouveau** |
| `scripts/benchmark-cut-plan.ts` | **nouveau** |
| `scripts/tsconfig.json` | config pour exécuter scripts TS (si absent) |
| `package.json` (root) | script `"benchmark:cut-plan": "tsx scripts/benchmark-cut-plan.ts"` |
| `README.md`, `HANDOVER.md` | mention algo alternatif + benchmark |

## 6. Benchmark CLI

### 6.1 Script `scripts/benchmark-cut-plan.ts`

Exécution : `pnpm benchmark:cut-plan`

Flux :
1. Lire les 5 fixtures `packages/nichoir-core/tests/fixtures/preset{A..E}.snapshot.json`.
2. Pour chaque fixture, extraire `params`.
3. Pour chaque algo (`computeCutLayout`, `computeCutLayoutRectpack`) :
   - Mesurer temps moyen sur 10 runs (via `performance.now()`).
   - Calculer : `panelCount`, `meanOccupation`, `minOccupation`, `wasteTotal`, `overflowCount`, `elapsedMs`.
   - Exporter le SVG du layout dans `runs/<date>-coupe-benchmark/artifacts/preset-{A..E}-{shelf,rectpack}.svg`.
4. Générer `RESULT.md` avec tableau markdown + narratif causal.
5. Générer `state/metrics.json` conforme au format harness projet.
6. Générer `state/NOTES.md` avec observations éventuelles.

### 6.2 Format `RESULT.md`

```markdown
# Benchmark — shelf-packing multi-bin vs rectangle-packer multi-bin

## Problème
Deux algorithmes 2D disponibles. Critère : meilleure répartition sur les 5 presets.

## Matériaux examinés
- packages/nichoir-core/src/cut-plan.ts — shelf (commit <sha>)
- packages/nichoir-core/src/cut-plan-rectpack.ts — rectpack (commit <sha>)
- 5 fixtures preset A–E (commit <sha>)
- rectangle-packer@1.0.4 (npm)
- Machine : <os>, <cpu>, node <v>

## Résultats bruts

| Preset | Algo     | Panneaux | Occup. moy. | Occup. min | Gaspillage (m²) | Overflow | Temps (ms) |
|--------|----------|----------|-------------|------------|-----------------|----------|------------|
| A      | shelf    |          |             |            |                 |          |            |
| A      | rectpack |          |             |            |                 |          |            |
| B      | shelf    |          |             |            |                 |          |            |
| ...    |          |          |             |            |                 |          |            |

## Résultats par critère

### Nb panneaux (moins = mieux)
- shelf: somme=X, moyenne=Y
- rectpack: somme=X', moyenne=Y'
- gagnant: ...

### Occupation moyenne (plus = mieux)
- shelf: moyenne=...
- rectpack: moyenne=...
- gagnant: ...

### Occupation minimale (plus = mieux)
- ...

### Gaspillage total (moins = mieux)
- ...

## Cause racine du verdict
[observation | inférence] Expliquer POURQUOI un algo gagne.

## Verdict candidat
- [ ] shelf gagne
- [ ] rectpack gagne
- [ ] égalité, je garde le plus simple (shelf, pas de dep externe)

## Incertitude résiduelle
- Les 5 presets ne couvrent pas tous les cas atypiques.
- Temps machine-dépendant, non représentatif cross-platform.
```

### 6.3 Métriques définies

Par `(preset, algo)` :
1. `panelCount` = `layout.panels.length`
2. `meanOccupation` = `layout.meanOccupation` ∈ [0, 1]
3. `minOccupation` = `Math.min(...panels.map(p => p.occupation))`
4. `wasteTotal` = somme de `(shW * shH - usedArea)` sur tous les panels, en m² (division par 1e6 depuis mm²)
5. `overflowCount` = `layout.overflow.length` (doit être 0 sur les 5 presets, sinon anomalie)
6. `elapsedMs` = `performance.now()` moyen sur 10 runs

## 7. Tests

### 7.1 Core (vitest)
- `computeCutLayoutRectpack(params)` retourne un `CutLayout` conforme au type.
- Pas de chevauchement, pas de débord du panneau.
- `overflow` vide sur les 5 presets.
- Parité structurelle avec shelf : `layout.totalUsedArea` est cohérent (somme des areas = somme des (w*h) des pièces placées).
- Test dédié : pièce > panneau → `overflow`.

### 7.2 UI (vitest + RTL)
- `PlanTab2` rend via `CutLayoutRenderer`, badge `algo: rectangle-packer` visible.
- Switch de tab entre `plan` et `plan2` : rendu différent (algo différent), structure identique (même `CutLayoutRenderer`).
- Axe-core : zéro violation.

### 7.3 Benchmark smoke-test
- Script `benchmark-cut-plan.ts` s'exécute sans erreur.
- `RESULT.md` écrit avec les 10 lignes de tableau (5 presets × 2 algos).
- `artifacts/` contient 10 SVG + `manifest.json`.

## 8. Critères d'acceptance

- [ ] `rectangle-packer@^1.0.4` dans `packages/nichoir-core/package.json`, `pnpm install` sans warning critique.
- [ ] `computeCutLayoutRectpack(params)` retourne un `CutLayout` valide pour les 5 presets.
- [ ] Onglet "Plan de coupe 2" visible dans `apps/demo`, rend les 5 presets sans erreur console.
- [ ] `pnpm benchmark:cut-plan` s'exécute, produit `runs/2026-04-XX-coupe-benchmark/RESULT.md` + SVG dans `artifacts/`.
- [ ] `RESULT.md` inclut la cause racine du verdict (pas seulement les chiffres).
- [ ] `pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build` vert.
- [ ] `CONTRACTS.md`, `README.md`, `HANDOVER.md` à jour (mention de l'algo alternatif + benchmark).
- [ ] L'utilisateur a lu `RESULT.md` et tranché (coche dans le verdict candidat).

## 9. Risques

1. **API rectangle-packer mal adaptée** — `GuillotineBinPack` est single-bin ; multi-bin à implémenter côté `cut-plan-rectpack.ts` via boucle. Si l'API ne retourne pas les rectangles rejetés, il faut faire une diff avant/après. À valider par un spike de 30 minutes au début de l'implémentation.
2. **Problème ESM/CJS à l'install** — `rectangle-packer` publie CJS (`lib/index.js`). Compatibilité avec `"type": "module"` de `@nichoir/core` à vérifier. Solutions possibles : `createRequire`, wrapper TypeScript, dynamic import.
3. **Résultat inattendu du benchmark** — rectangle-packer peut être plus lent d'un ordre de magnitude (il traite plus de cas). C'est acceptable si la qualité gagne ; à signaler dans le RESULT.md mais pas disqualifiant.
4. **`rectangle-packer` est peu maintenu** — v1.0.4 stable depuis plusieurs années, ce qui est positif (stabilité) ou négatif (abandon). À noter dans la décision : si on retient rectangle-packer, on assume le maintien. Fallback : fork ou réimplémentation interne.
5. **Extraction du helper `buildCutList`** — si on choisit de l'extraire, c'est une modif à `cut-plan.ts` en contradiction avec la règle "pas de modification". À reformuler : "modification minimale de type *extract method*, 0 changement de comportement, vérifié par les snapshots". Si risque perçu trop élevé → duplication acceptable.
6. **Naming du 7ᵉ onglet** — "Plan de coupe 2" est descriptif mais peut être perçu comme version supérieure (alors que c'est juste "algo alternatif"). Alternative si problématique : "Plan de coupe (algo 2)" ou "Cut plan (rectpack)". Décision cosmétique, non-bloquante.

## 10. Questions ouvertes (à clôturer pendant l'implémentation)

- **Extraction `buildCutList`** : oui/non.
  → Proposition : **oui** si la cut list fait moins de 30 lignes (quick, sûr). Sinon, duplication.
- **Heuristique rectangle-packer** : quelle combinaison `FreeRectChoiceHeuristic × GuillotineSplitHeuristic` utiliser ?
  → Proposition : **RectBestAreaFit + SplitShorterLeftoverAxis** (citées dans la doc du repo comme défaut raisonnable).
- **Nom de l'onglet** : "Plan de coupe 2" ou autre ?
  → Proposition : **"Plan de coupe 2"**, validé par l'utilisateur en brainstorming.

---

## 11. Evidence document attendu à la fin

`runs/2026-04-XX-coupe-benchmark/RESULT.md` (voir format section 6.2) **est** l'evidence document terminal de cette branche. Le harness projet (`CLAUDE.md`) impose qu'il soit écrit avant de déclarer succès. Le verdict candidat reste ouvert — c'est l'utilisateur qui le clôture.

Post-décision, une branche ultérieure (`cleanup-cut-plan`) supprimera l'algo perdant + son tab + son fichier core. Hors scope de `coupe`.
