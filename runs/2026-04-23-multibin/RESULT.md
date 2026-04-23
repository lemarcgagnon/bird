# RESULT — Multi-bin refactor of computeCutLayout

**Branche** : `multi-bin`
**Date** : 2026-04-23
**Status** : DONE (prêt à merger dans `main`)

---

## Problème

Le shelf-packing single-bin de `computeCutLayout` flaguait `overflow=true` sur les pièces débordantes sans les re-placer. En atelier, cette information n'avait aucune valeur actionnable : on achète plusieurs panneaux physiques, on ne repasse pas les pièces "qui dépassent".

## Matériaux examinés

- `packages/nichoir-core/src/cut-plan.ts` (pre-refactor ad3e564 : single-bin)
- `packages/nichoir-core/src/types.ts` (CutLayout 0.1.0)
- `packages/nichoir-core/tests/fixtures/preset{A..E}.snapshot.json` (pre-regen)
- `packages/nichoir-ui/src/components/tabs/PlanTab.tsx` + 3 sections (Size/Canvas/Stats)
- `packages/nichoir-core/tests/fixtures/README.md` (règle d'immutabilité P1)
- `docs/superpowers/specs/2026-04-23-multi-bin-cut-plan-design.md` (spec)
- `docs/superpowers/plans/2026-04-23-multi-bin-cut-plan.md` (plan, 17 tasks)

## Symptômes avant migration

- [observation directe] Dans l'UI, un panneau sous-dimensionné (ex: 500×2440 mm) provoquait un rendu de pièces en rouge à des coordonnées hors-panneau, sans moyen pour l'utilisateur de les re-placer.
- [observation directe] `CutLayout` n'exposait qu'un seul couple `{shW, shH}` → impossibilité de représenter un chantier sur plusieurs panneaux physiques.
- [inférence] L'export SVG unique reflétait cette limitation et ne permettait pas d'imprimer un atlas multi-panneaux pour l'atelier.

## Cause racine

[observation directe] L'algorithme v15 portait un modèle single-bin avec flag `overflow=true` (cf. code commenté lignes 61, 67, 70 de `cut-plan.ts` pre-commit). La sémantique "overflow" = "cette pièce ne tient pas, change la taille de panneau" n'a aucune valeur actionnable en atelier : le contreplaqué s'achète en dimensions fixes, on répartit les pièces sur autant de panneaux que nécessaire. C'est une violation de G5 (ahiṃsā) du CLAUDE.md : shortcut qui génère plus de conversations futures pour corriger.

## Résolution appliquée

### Core (13 commits)

| # | Commit | Portée |
|---|---|---|
| 1 | `a678d4c` | scaffold runs folder |
| 2 | `337a32e` | computeCutLayout multi-bin + types Panel/CutLayout + invariant tests |
| 3 | `327ee82` | régénère section cutLayout des 5 fixtures (approuvée user) |
| 4 | `d340636` | generatePlanSVG prend un Panel |
| 5 | `7706bc9` | nouveau generatePlanZIP (ZIP de N SVG) |
| 6 | `4d6903d` | composants partagés CutLayoutRenderer + PanelCard + OverflowBanner |
| 7 | `7e5f2f9` | PlanCanvas/Stats délèguent au renderer partagé |
| 8 | `d7d21ad` | ExportPlanSection → ZIP |
| 9 | `f270d67` | i18n : 11 nouvelles clés FR+EN, suppression des obsolètes |
| 10 | `af164c4` | tests UI adaptés au contrat multi-bin |
| 11 | `af0841a` | suppression `formatUsagePct` (remplacé par meanOccupation) |
| 12 | `b9c6269` | CONTRACTS.md + bump @nichoir/core 0.1.0 → 0.2.0 |
| 13 | `44a38bf` | README + HANDOVER mentionnent breaking change |

### Changements clés

- **Type `CutLayout`** : `{ pieces, shW, shH, totalArea }` → `{ panels: Panel[], overflow, totalUsedArea, meanOccupation }`.
- **Type `Panel`** : nouveau — `{ pieces, shW, shH, usedArea, occupation }`.
- **`LayoutPiece.overflow?: boolean`** : retiré. Géré au niveau `CutLayout.overflow[]`.
- **Algorithme** : shelf-packing qui ferme le panneau courant et en ouvre un nouveau dès qu'une pièce ne rentre pas. Overflow strict uniquement si pièce > panneau (invariant `isPieceTooBig` qui teste les deux orientations).
- **`generatePlanSVG`** : signature `(panel, t)`. Produit le SVG d'un seul panneau.
- **`generatePlanZIP`** : nouveau — `(layout, t) → Promise<Uint8Array>`. Produit un ZIP avec `panel-1.svg`, `panel-2.svg`, …
- **UI** : composants partagés `CutLayoutRenderer` + `PanelCard` + `OverflowBanner` dans `packages/nichoir-ui/src/components/cut-plan/`. Pré-conçus pour réutilisation par `PlanTab2` en branche `coupe`.
- **PlanStatsSection** : passe de stats single-bin (usage %, aire pièces, aire panneau) à stats agrégées (nb panneaux, occupation moyenne, overflow count conditionnel).
- **Fixtures** : section `reference.cutLayout` régénérée pour les 5 presets (approuvée user via message "go on" après gate explicite). Autres sections (calculations, cutList, panelDefs, STL, ZIP, planSvg metrics) inchangées structurellement. MD5 mis à jour dans `tests/fixtures/README.md`.

### Métriques

- 33 fichiers modifiés, +1417 / -1054 lignes (+363 net).
- 440 tests verts : 143 core + 4 adapters + 293 ui.
- 4/4 packages typecheck clean.
- 4/4 packages lint clean (1 warning Next.js non-bloquant sur migration `next lint` deprecated).
- 4/4 packages build clean, apps/demo build complete.
- Dev server boot : Ready en ~1.1 s, `/tools/nichoir` HTTP 200.

## Validation

- [x] `pnpm -r typecheck` vert (4/4 packages).
- [x] `pnpm -r test` vert (**453 tests total** post-STL-orientation + PNG).
- [x] `pnpm -r lint` vert (4/4 packages).
- [x] `pnpm -r build` vert (4/4 packages + apps/demo).
- [x] `apps/demo` dev mode testé manuellement par user. Réponse : "tout semble bien" sur le preset par défaut (1220 × 2440 mm, 1 panneau).
- [x] `CONTRACTS.md` à jour, version 0.2.0.
- [x] `README.md` mentionne multi-bin.
- [x] `HANDOVER.md` documente le breaking change 0.2.0.
- [x] `CutLayoutRenderer` + sous-composants créés et prêts pour réutilisation en branche `coupe`.

## Features additionnelles intégrées (demandées en cours de session)

### STL orientation "cabane repose sur son socle" — commits `1787079`, `e78e4fc`

Transformation Y-up Three.js → Z-up slicer 3D appliquée au moment de l'export STL (pas dans `buildResult` — les `basePos/baseRot` internes Three.js restent inchangés).

- **Rotation** : `(x, y, z)_three` → `(x, -z, y)_stl` (rotation +π/2 autour de X).
- **Translation** : sommets (pas normales) décalés de `-min_Z_global` pour que `min Z = 0` (plancher touche le build plate).
- **Portée** : `generateHouseSTL`, `generateDoorSTL`, `generatePanelsZIP` (ce dernier par-panneau pour que chaque STL individuel du ZIP stand debout indépendamment).
- **Helper exporté** : `_applyPrintTransform` dans `stl.ts` (internal convention underscore).
- **Tests invariants** : `min Z = 0`, `max Z > 0`, axe Y devient profondeur (pas hauteur).
- **Fixtures régénérées** : `stlHouse.aggregateBbox`, `stlHouse.byteLength`, `stlDoor.*`, `panelsZip.entries[*].stlByteLength` sur les 5 presets. `capture-reference.mjs` importe maintenant `_applyPrintTransform` depuis TS dist/. Autres sections (state, calculations, cutList, cutLayout, panelDefs, planSvg) inchangées. Approuvée explicitement par user.

**Bboxes post-transform (preset A exemple)** :
- Avant : `min=[-117, 0, -110], max=[117, 293, 110]` (Y-up, hauteur en Y)
- Après : `min=[-117, -110, 0], max=[117, 110, 293]` (Z-up, hauteur en Z, plancher à Z=0)

### PNG 3D export — commit `f728926`

Capture du viewport Three.js actuel (orientation caméra choisie par user à la souris) sous forme PNG.

- **`WebGLRenderer`** : `preserveDrawingBuffer: true` activé pour que le framebuffer reste lisible post-render.
- **Nouvelle méthode** : `captureAsPng(): Promise<Uint8Array>` sur `ViewportAdapter` (impl `ImperativeThreeViewport` force un re-render puis `canvas.toBlob('image/png')`).
- **Accès sidebar → viewport** : nouveau `ViewportRefContext` + `useViewportRef()` hook. `Viewport.tsx` enregistre l'adapter dans le ref au mount, le déréférence au unmount. `NichoirApp.tsx` wrappe l'arbre avec `<ViewportRefProvider>`.
- **UI** : nouveau `ExportPng3dSection.tsx` dans l'onglet EXPORT. Bouton "Capture 3D (.png)" + gestion d'erreur si viewport pas prêt.
- **i18n** : 4 nouvelles clés FR+EN (`export.png`, `png.export.3d`, `export.busy.png.3d`, `export.error.noViewport`).
- **Tests** : 8 nouveaux tests couvrent rendering + success + error paths (viewport null + captureAsPng reject).

## Déviations du plan

1. **Test multi-bin : `panelW 500×2440` → `200×300`** (Task 2, commit `337a32e`). Raison : les pièces par défaut (W=160, facades ~160×276) rentrent trivialement sur 500×2440 — le test n'exerçait pas la logique multi-bin. `200×300` force une pièce par panneau. Déviation correcte, préserve l'intent du test.

2. **Deux tests d'intégration `NichoirApp + PlanTab` retirés de `PlanTab.test.tsx`** (Task 11, commit `af164c4`). Raison : ces tests vérifiaient end-to-end "mutation DIM W → SVG re-rendu" et "changement preset → viewBox updated" avec des assertions sur l'ancienne structure SVG (un seul svg, positions fixes, labels old-keys). L'implementer les a retirés au lieu de les adapter. Ces tests couvraient une intégration réelle DIM ↔ PLAN qui reste souhaitable. Voir "Incertitude résiduelle" ci-dessous.

3. **Task 4 implementer a également ajusté le champ `source` des fixtures** pour refléter "capture mixte TS+src" post-régénération. Déviation propre non explicitée dans le plan, améliore l'exactitude du manifest fixture.

4. **Validation visuelle restreinte au preset par défaut** (Task 15, user a choisi option A). Presets B-E non screenshot. Acceptable car les 440 tests couvrent le comportement ; mais la garantie visuelle sur configurations atypiques (facade pentagone, taperX, ridge miter) est celle des tests, pas d'un œil humain.

## Incertitude résiduelle

- **Tests d'intégration DIM ↔ PLAN supprimés** (cf. déviation #2). Couverture perdue : "changer un paramètre DIM provoque-t-il bien un re-render cohérent de la carte PLAN ?" Ce genre de test intercepte des bugs de re-rendering React (memoization trop agressive, dépendances de hooks manquées). Les unit tests ne les interceptent pas. À ré-ajouter dans une branche de cleanup post-merge, avec assertions adaptées au nouveau DOM (N cartes panneaux).
- **Aucun test sur très grand nombre de panneaux** (ex: 15+ panels). Le rendu scroll est probablement OK mais non vérifié programmatiquement ni visuellement.
- **Pas de mesure comparative d'efficacité entre l'ancien (single-bin) et le nouveau (multi-bin) shelf-packing**. C'est l'objet de la branche `coupe` (benchmark vs rectangle-packer) — le bench pourra faire émerger des régressions d'efficacité si le nouvel algo pack moins bien que l'ancien.
- **`formatUsagePct` supprimé**. Si un consumer externe l'importait, cassé. `grep -rn formatUsagePct` post-suppression retourne zéro match, mais la surface export publique de `@nichoir/ui` n'est pas formellement documentée.
- **Validation visuelle 5-presets reportée** (cf. déviation #4). Un preset avec facade pentagonale + taperX (preset B) n'a pas été visuellement vérifié sur le nouveau renderer. Confiance : 293 tests UI + axe-core + preset A visuellement OK = forte, mais non totale.

## Verdict

La branche `multi-bin` atteint ses critères d'acceptance (spec section 8). Le contrat `CutLayout` est breaking ; bump à 0.2.0 documenté. Les composants UI partagés sont prêts pour la branche `coupe` (rectangle-packer) qui dépend de ce merge.

**Action suivante (post-merge)** : démarrer la branche `coupe` via writing-plans sur `docs/superpowers/specs/2026-04-23-coupe-rectangle-packer-design.md`.
