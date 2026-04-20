# TASK — Nichoir → Next.js SaaS module

## Résumé
Porter le calculateur Nichoir (vanilla ES + Three.js r128 CDN) vers un monorepo
Next.js + TypeScript strict, en 3 packages séparés : `nichoir-core` (pur),
`nichoir-ui` (React + Three.js impératif), `nichoir-adapters` (ports SaaS).

## Contraintes (issues de la revue Claude ↔ codex)

- **Contract-first** : `CONTRACTS.md` (core) et `ADAPTERS.md` (ports) figés
  AVANT toute ligne de code. Diff sur les .md avant diff sur le code.
- **Zéro entorse au core pur** : `nichoir-core` = zéro DOM, zéro React, zéro Next,
  testable en Node. En particulier `generatePlanPNG` N'EST PAS dans le core.
- **Three.js impératif au premier passage** — pas de R3F. Encapsulé derrière
  un `ViewportAdapter { mount / update / unmount }` pour rendre R3F déferrable.
- **i18n plat conservé** : `translations.js` → `messages.ts` + hook `useT()`.
  Aucune migration de format.
- **Server-authoritative par défaut** : `CreditGate.canExport()` est `Promise<boolean>`
  dès la fake impl. Pas d'interface sync à asynchroniser plus tard.
- **Parité visée** :
  - calculs (volumes/surfaces/cut list) : parité numérique stricte vs v15 (tolérance 1e-6)
  - STL : parité **structurelle** — même bbox (±0.1 mm), même triangle count par panneau
    primitif, même matrice de transformation. **PAS** de promesse watertight globale :
    les panneaux extrudés et les décos vectorielles sont des solides fermés individuellement,
    mais les décos **heightmap** sont des surfaces simples (non-watertight), et le STL maison
    est une **concaténation** de triangles (pas une union CSG).
  - géométrie : 5 snapshots JSON de référence (`buildPanelDefs` output normalisé) sur presets connus
- **R3F / refonte React long-terme = hors-scope.** Phase 4 conditionnelle.

## Critères d'acceptance

1. Monorepo pnpm (ou équivalent) bootstrappé, TS strict, Vitest, lint, CI
   minimale, les 3 packages vides buildent.
2. `packages/nichoir-core/CONTRACTS.md` figé et validé.
3. `packages/nichoir-adapters/ADAPTERS.md` figé et validé.
4. Les types TypeScript du core sont extraits 1:1 de `src/state.js`,
   `src/geometry/panels.js`, `src/calculations.js`, `src/cut-plan.js`.
5. `pnpm test` et `pnpm build` verts sur les 3 packages (même vides).

## Périmètre

### Inclus (P0 seulement)
- Bootstrap monorepo
- Contrats publics figés
- Scaffolding des 3 packages
- Configuration outillage (TS, Vitest, lint, CI)

### Exclus (P1–P3, plus tard)
- Port du code métier → P1
- UI React → P2
- Adaptateurs SaaS réels → P3
- R3F → P4 conditionnelle

## Emplacement cible
Monorepo créé dans `/home/marc/Documents/cabane/nichoir/` aux côtés des
fichiers existants (qui restent intacts). Layout :
```
/home/marc/Documents/cabane/nichoir/
  {index.html, src/, styles/, nichoir_v15.html, ...}  ← EXISTANT (intact)
  packages/
    nichoir-core/, nichoir-ui/, nichoir-adapters/      ← NOUVEAU
  apps/
    demo/                                               ← NOUVEAU (Next.js)
  runs/2026-04-16-nichoir-nextjs-port/                  ← SESSION
```

## Failure modes à surveiller (inspirés des échecs historiques)

- **false_success** : le `pnpm build` passe mais un package importe quelque chose
  qu'il ne devrait pas (core qui touche au DOM, UI qui contourne les ports).
- **patch_too_large** : agents qui dérivent et écrivent du code métier pendant P0.
- **missing_context** : agents qui inventent des types au lieu d'extraire ceux de v15.
