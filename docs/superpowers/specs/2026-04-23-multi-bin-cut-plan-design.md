# Design — Migration du shelf-packing vers le multi-bin

**Date** : 2026-04-23
**Branche cible** : `multi-bin`
**Dépendances** : aucune (branche autonome, à merger dans `main` en premier)
**Bloque** : branche `coupe` (install rectangle-packer + benchmark)

---

## 1. But

Corriger une dette architecturale du calcul de plan de coupe : l'algorithme actuel `computeCutLayout` place toutes les pièces sur **un seul panneau** et flague les pièces débordantes avec `overflow=true` sans les re-placer ailleurs. En atelier, ce comportement est une imposture — on achète plusieurs panneaux de contreplaqué, on ne repasse pas les pièces "qui dépassent".

Cette branche fait passer le shelf-packing au **multi-bin** : quand une pièce ne rentre pas sur le panneau courant, un nouveau panneau est ouvert et la pièce y est placée. Une pièce est flaguée en overflow **uniquement** si elle est elle-même plus grande que le panneau (cas dimensionnel impossible, pas un échec de placement).

Cette branche ne touche **pas** à rectangle-packer ni à la comparaison d'algos. C'est une correction indépendante qui aurait dû exister au V1.

## 2. Motivation

- L'utilisateur exploite effectivement les plans de coupe en atelier.
- Le flag `overflow=true` actuel laisse une pièce visuellement hors-panneau, sans action utilisateur possible → aucune valeur réelle.
- Le changement rend aussi possible la comparaison honnête avec rectangle-packer (branche `coupe`), qui sera implémenté en multi-bin natif.

## 3. Non-goals

- **Pas d'install de rectangle-packer** dans cette branche. Strictement hors scope.
- **Pas de nouveau tab** "Plan de coupe 2". Reporté à la branche `coupe`.
- **Pas de refonte du tri** ou des heuristiques de packing. On préserve le tri actuel (hauteur desc) ; les expérimentations de tri sont une question séparée.
- **Pas de suppression de l'algorithme shelf-packing**. Il reste la référence après cette migration.

## 4. Architecture

### 4.1 Contrat core — nouveau `CutLayout`

Fichier : `packages/nichoir-core/src/types.ts`

```ts
export type Panel = {
  pieces: LayoutPiece[];     // pièces placées sur CE panneau
  shW: number;               // largeur panneau (identique entre tous les panneaux)
  shH: number;               // hauteur panneau
  usedArea: number;          // somme des areas des pièces placées (w * h par pièce)
  occupation: number;        // usedArea / (shW * shH), ∈ [0, 1]
};

export type CutLayout = {
  panels: Panel[];           // 1..N panneaux ; 0 possible uniquement si tous les pieces overflow
  overflow: LayoutPiece[];   // pièces plus grandes que le panneau ; ne sont pas dans panels[]
  totalUsedArea: number;     // somme sur tous les panneaux
  meanOccupation: number;    // moyenne arithmétique des panel.occupation
};
```

**Changements** :
- `LayoutPiece.overflow?: boolean` → retiré. Les pièces overflow sont dans `CutLayout.overflow`, pas dans les panneaux.
- Les coordonnées `px, py` d'une pièce sont **relatives au panneau auquel elle appartient**.

### 4.2 Algorithme shelf-packing multi-bin

Fichier : `packages/nichoir-core/src/cut-plan.ts`

Pseudo-algorithme :
```
pieces = computePieces(params)  // identique à l'actuel
sorted = trier par hauteur desc (préserver tri actuel)

overflow = []
panels = []
panelCourant = null

pour chaque p dans sorted:
  si p.w > shW && p.h > shW  // même en rotation, ça ne rentre pas
    overflow.push(p)
    continue

  si panelCourant == null:
    panelCourant = nouveau Panel vide

  tenter de placer p dans panelCourant (avec rotation comme avant)
  si échec:
    panels.push(panelCourant)
    panelCourant = nouveau Panel vide
    placer p dans panelCourant (doit réussir car p rentre dans un panneau vide)

si panelCourant non-vide:
  panels.push(panelCourant)

calculer usedArea, occupation par panel
calculer totalUsedArea, meanOccupation global
return { panels, overflow, totalUsedArea, meanOccupation }
```

**Invariants** :
- Chaque `Panel` a au moins une pièce (on ne retourne pas de panneau vide).
- `p.px + p.w ≤ shW` et `p.py + p.h ≤ shH` pour toute pièce dans `panel.pieces` (sauf overflow).
- `gap = 5` (valeur actuelle) préservé.

### 4.3 Fichiers modifiés

| Fichier | Nature de la modif |
|---|---|
| `packages/nichoir-core/src/types.ts` | Ajout `Panel`, modif `CutLayout`, retrait `LayoutPiece.overflow` |
| `packages/nichoir-core/src/cut-plan.ts` | Boucle multi-bin |
| `packages/nichoir-core/src/exporters/svg.ts` | Export SVG multi-panneaux (un fichier par panneau) |
| `packages/nichoir-core/src/exporters/zip.ts` | Nouveau wrapper pour ZIP de SVG plan de coupe |
| `packages/nichoir-core/src/index.ts` | Réexports cohérents |
| `packages/nichoir-core/CONTRACTS.md` | Doc du nouveau contrat |
| `packages/nichoir-core/tests/fixtures/preset{A..E}.snapshot.json` | Régénérés |
| `packages/nichoir-core/tests/*.test.ts` | Adaptation aux nouveaux types |
| `packages/nichoir-ui/src/components/tabs/PlanTab.tsx` | Rendu N panneaux |
| `packages/nichoir-ui/src/components/cut-plan/CutLayoutRenderer.tsx` | Nouveau composant (rendu multi-panneaux) |
| `packages/nichoir-ui/src/components/cut-plan/PanelCard.tsx` | Nouveau composant (carte par panneau) |
| `packages/nichoir-ui/src/components/cut-plan/OverflowBanner.tsx` | Nouveau composant (avertissement) |
| `packages/nichoir-ui/src/i18n/messages.ts` | Libellés "Panneau N", "X panneaux", bannière overflow |
| `packages/nichoir-ui/tests/*.test.tsx` | Adaptation |
| `README.md`, `HANDOVER.md` | Mention du multi-bin |

## 5. UI — rendu des N panneaux

Layout adopté : **scroll vertical, carte par panneau**.

```
┌────────────────────────────────────────────────┐
│ Plan de coupe — 3 panneaux, occupation 78 %    │
│ ⚠ 1 pièce hors panneau : facade 1 trop grande  │  ← si overflow > 0
├────────────────────────────────────────────────┤
│ Panneau 1 — 84 % occupation                    │
│ ┌────────────────────────┐                     │
│ │   [SVG rendu panel 1]  │                     │
│ └────────────────────────┘                     │
├────────────────────────────────────────────────┤
│ Panneau 2 — 72 % occupation                    │
│ ┌────────────────────────┐                     │
│ │   [SVG rendu panel 2]  │                     │
│ └────────────────────────┘                     │
└────────────────────────────────────────────────┘
```

- Le composant `CutLayoutRenderer` reçoit un `CutLayout` et rend la bannière overflow (si nécessaire) + une liste de `PanelCard`.
- Chaque `PanelCard` affiche le header "Panneau N — X % occupation" + un SVG inline responsive.
- Le composant est prévu dès maintenant pour être **partagé** avec `PlanTab2` (branche `coupe`), sans avoir besoin de duplication.

## 6. Export SVG

- Un bouton "Export SVG" dans le PlanTab.
- Produit un **ZIP** (via JSZip, déjà dépendance) contenant :
  - `panneau-1.svg`
  - `panneau-2.svg`
  - ... jusqu'à `panneau-N.svg`
- Chaque SVG a ses dimensions physiques en mm, directement utilisable en atelier (éditeur SVG, logiciel CNC, découpe laser).

## 7. Tests

### 7.1 Core (vitest)
- `computeCutLayout` retourne `{ panels, overflow, totalUsedArea, meanOccupation }` conforme au nouveau type pour les 5 presets.
- Chaque `panel.pieces` respecte les bornes `[0, shW] × [0, shH]` (pas de chevauchement avec le bord).
- Pas de chevauchement entre pièces d'un même panneau.
- `overflow` vide sur les 5 presets (les presets sont dimensionnés raisonnablement).
- Test dédié : pièce surdimensionnée (w > shW && h > shW) → atterrit dans `overflow`, pas dans un panneau.
- Test de non-régression : `meanOccupation` d'un preset connu reste stable (±1 %) — le tri n'a pas changé, seule la gestion du débord change.

### 7.2 UI (vitest + React Testing Library)
- `PlanTab` rend N cards quand `panels.length = N`.
- Bannière overflow affichée quand `overflow.length > 0`, masquée sinon.
- Libellés FR/EN corrects.
- Axe-core : zéro violation sur le rendu multi-panneaux.

### 7.3 Fixtures snapshots
- Les 5 `presetA..E.snapshot.json` sont régénérés avec le nouveau format.
- **Validation manuelle** avant de figer : tu lances `pnpm -C apps/demo dev`, tu visites les 5 presets via console (snippet de setParam), tu screenshots. Les screenshots vont dans `runs/2026-04-XX-multibin/artifacts/`.

## 8. Critères d'acceptance

- [ ] `packages/nichoir-core/src/types.ts` exporte `Panel` et `CutLayout` conformes à la section 4.1.
- [ ] `computeCutLayout(params)` retourne `panels.length ≥ 1` pour les 5 presets.
- [ ] `CutLayout.overflow` non-vide uniquement si pièce > panneau.
- [ ] `PlanTab` rend N panneaux + header + bannière overflow.
- [ ] Export ZIP multi-SVG produit, chaque SVG ouvrable dans un éditeur.
- [ ] 5 fixtures snapshot régénérées après validation manuelle (screenshots archivés).
- [ ] `pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build` vert.
- [ ] `apps/demo` dev mode : parcours manuel 5 presets sans erreur console.
- [ ] `CONTRACTS.md`, `README.md`, `HANDOVER.md` mis à jour.
- [ ] `runs/2026-04-XX-multibin/RESULT.md` écrit avec cause racine, matériaux examinés, verdict.

## 9. Risques

1. **Régression visuelle des 5 presets** — un preset peut passer de "tout tient sur 1 panneau" à "2 panneaux" avec 1 seule pièce sur le 2ᵉ. Ce n'est pas un bug, c'est le comportement attendu. À valider humainement.
2. **Breaking change du contrat `CutLayout`** — tout consommateur externe (SaaS host) qui lit `CutLayout` cassera. Aujourd'hui, seul `apps/demo` consomme → impact limité. À signaler dans `HANDOVER.md` comme **breaking change à noter pour future intégration SaaS**, bumper la version de `@nichoir/core` à `0.2.0`.
3. **Tests UI à adapter en masse** — 302 tests UI dont une partie touche le PlanTab. Prévoir une demi-journée de tri.
4. **Export SVG : nommage** — `panneau-1.svg` en français / `panel-1.svg` en anglais ? Le ZIP étant à usage atelier, je propose **toujours `panel-N.svg`** (neutre, évite les i18n dans un nom de fichier). À confirmer si tu préfères la variante française.

## 10. Questions ouvertes (à clôturer pendant l'implémentation)

- **Ordre de tri** : maintenu en hauteur desc ? Tester aire desc ?
  → Décidé : **hauteur desc conservé** (équivalence avec l'actuel pour minimiser la surface de changement).
- **Nom des fichiers SVG exportés** : `panel-N.svg` ou `panneau-N.svg` ?
  → Proposition : **`panel-N.svg`**, neutre.
- **Version de `@nichoir/core`** : rester en `0.1.0` ou bumper `0.2.0` ?
  → Proposition : **`0.2.0`**, reflète le breaking change.

---

## 11. Evidence document attendu à la fin

`runs/2026-04-XX-multibin/RESULT.md` :
- Problème (copié de la section 1)
- Matériaux examinés (commits, fichiers, fixtures)
- Symptômes observés avant la migration (si pertinent)
- Cause racine (conception initiale single-bin)
- Résolution appliquée (diff résumé)
- Validation (screenshots 5 presets, metrics tests, CI vert)
- Incertitude résiduelle (cas non testés)
