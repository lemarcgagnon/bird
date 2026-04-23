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
