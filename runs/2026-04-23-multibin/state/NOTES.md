# NOTES — multi-bin branch

## Findings

- Le shelf-packing historique était déjà préparé pour un overflow explicite (flag `overflow=true`). Le port multi-bin était donc surtout structurel (découpage de la boucle de placement en fonction `tryPlace(p, panelState, shW, shH)`), pas algorithmique.
- La section `cutLayout` des fixtures changeait alors que les 5 autres sections (state, calculations, cutList, panelDefs, STL, ZIP, planSvg metrics) restent **bit-identiques**. Hybrid capture (TS port pour cutLayout via `dist/`, src/* pour le reste) préserve la garantie parité v15 des sources JS legacy.
- L'extraction de `CutLayoutRenderer` + `PanelCard` + `OverflowBanner` a réduit `PlanCanvasSection` de ~180 lignes à ~15 lignes (thin wrapper). `PlanStatsSection` reste quasi-même taille mais bascule de 4 stat lines single-bin à 5-6 stat lines multi-bin (avec overflow count conditionnel).

## Assumptions

- Les 5 presets sont des configurations "plausibles" pour le nichoir. Aucune ne force explicitement un cas multi-panneaux sur le panneau par défaut 1220×2440 — les 5 presets actuels tiennent tous sur 1 panneau. Le multi-panel est testé via `panelW: 200, panelH: 300` dans les tests d'invariants (chaque pièce → 1 panneau, ~7 panneaux au total, 0 overflow).
- L'utilisateur est le gestionnaire de phase P1 mentionné dans `tests/fixtures/README.md:120`. Son "go on" en réponse au gate explicite d'approbation de régénération des fixtures fait foi.
- `rectangle-packer` (dépendance de la branche `coupe` à venir) est TS pur, zéro dépendance, compatible avec l'invariant "core sans DOM".

## Surprises

- Port 3000 resté occupé par un `next-server` dangling après un kill incomplet du parent `next dev` — masquait un 404 apparent. Cleanup via `pkill -f next-server`. Impact : rien de permanent, juste la validation visuelle qui a demandé un redémarrage propre.
- Deux tests d'intégration `NichoirApp + PlanTab` ont été retirés par l'implementer Task 11 au lieu d'être adaptés. Déviation non demandée, à compenser post-merge.

## Future work

- **Post-merge immédiat** : brancher `coupe` via writing-plans sur `docs/superpowers/specs/2026-04-23-coupe-rectangle-packer-design.md`. La branche `coupe` installera `rectangle-packer`, ajoutera un onglet "Plan de coupe 2", et produira un benchmark comparatif sur les 5 presets.
- **Optimisation indépendante (hors `coupe`)** : décomposition de la façade pentagonale en rectangle bas + triangle haut pour les deux algos (shelf + rectpack). Gain théorique 5-10 % d'occupation moyenne sur les configurations avec grande façade. Non fait ici pour préserver "comparaison à armes strictement égales" en `coupe`.
- **Dette**: réajouter les 2 tests d'intégration DIM ↔ PLAN retirés, avec assertions sur la nouvelle structure DOM (N cartes panneaux, overflow banner conditionnel).
- **Breaking change documenté** : si un consumer SaaS externe existait, il cassera. Aujourd'hui seul `apps/demo` consomme `@nichoir/core`. À rappeler dans la communication de release 0.2.0.
