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
