# PLAN — P0 bootstrap + contracts freeze

## 🎯 Intent lock (confirmé avec user + codex)
Livrer un monorepo Next.js scaffolding avec les 3 packages (`nichoir-core`,
`nichoir-ui`, `nichoir-adapters`), TS strict, Vitest, lint, CI minimale, et les
2 contrats publics figés (`CONTRACTS.md`, `ADAPTERS.md`).
Aucun code métier dans P0 — juste la structure et les contrats.

## 📁 Files affected (cibles P0)

### Création
```
packages/nichoir-core/
  CONTRACTS.md                  ← source d'autorité, diff avant code
  package.json
  tsconfig.json
  src/index.ts                  ← barrel, re-export types only pour P0
  src/types.ts                  ← types publics extraits 1:1 de v15
  tests/smoke.test.ts           ← placeholder qui passe
packages/nichoir-ui/
  package.json
  tsconfig.json
  src/index.ts                  ← placeholder
packages/nichoir-adapters/
  ADAPTERS.md                   ← doc des 5 ports
  package.json
  tsconfig.json
  src/index.ts                  ← barrel, re-export interfaces + fakes
  src/ports/{CreditGate,ProjectStore,AuthContext,Telemetry,DownloadService}.ts
  src/fakes/{FakeCreditGate,InMemoryProjectStore,ConsoleTelemetry,BrowserDownloadService}.ts
apps/demo/                       ← Next.js app vide (sanity check du monorepo)
  package.json
  next.config.ts
  app/page.tsx
package.json                     ← workspace root
pnpm-workspace.yaml
tsconfig.base.json
.eslintrc.cjs
vitest.config.ts (shared)
.github/workflows/ci.yml         ← lint + typecheck + test
```

### Modification
Aucune — les fichiers existants (`index.html`, `src/**`, `styles/`,
`nichoir_v15.html`) RESTENT INTACTS.

## ⚠️ Risk areas / side effects

- **Conflit pnpm workspace vs pages existantes** : `index.html` et `src/` à la
  racine ne doivent pas être accidentellement matchés par les globs du workspace.
  Les `package.json` des packages doivent scoper proprement.
- **Trois.js version drift** : le core va importer `three` npm (r160+) alors que
  v15 utilise `window.THREE` r128. Documenter, mais ne pas régler en P0 (c'est un
  enjeu P1 de parité).
- **TS strict sur les types extraits** : v15 est JS, donc les types sont implicites.
  Extraire = inférer. Risque d'erreur. Mitigation : Explore agent fait l'inventaire,
  je valide contre le code source avant de figer.
- **Side effect involontaire** : un agent pourrait écrire un `tsconfig` global qui
  casse le build du projet existant. Isoler les tsconfigs par package.

## 🤖 Plan de délégation

### Vague 1 (parallèle)
- **Agent A — Explore** (sonnet, thorough)
  - Extraire tous les types/shapes de `src/state.js`, `src/geometry/panels.js`,
    `src/geometry/deco.js`, `src/calculations.js`, `src/cut-plan.js`,
    `src/exporters/stl.js`, `src/exporters/plan.js`.
  - Livrer un rapport structuré : pour chaque fonction exportée, sa signature
    inférée + description des paramètres/retour.
  - Identifier les types transverses (Params, BuildResult, PanelDef, Derived,
    CutList, CutLayout, Calculations, NichoirState).
  - **Pas de code produit — juste un inventaire.**

### Vague 2 (séquentielle, après Vague 1)
- **Moi — synthèse**
  - Rédiger `CONTRACTS.md` (core) + `ADAPTERS.md` (adapters) à partir du rapport.
  - Ces 2 fichiers sont la gouvernance — responsabilité orchestrateur.

- **Agent B — code-reviewer** (sonnet)
  - Valider que `CONTRACTS.md` couvre 100% des exports publics actuels.
  - Vérifier qu'aucune signature ne dépend du DOM (zéro entorse).
  - Retour : go/no-go + liste des écarts.

### Vague 3 (après validation des contrats)
- **Agent C — bootstrap** (sonnet)
  - Créer la structure de fichiers listée ci-dessus.
  - Configurer pnpm workspace, TS strict, Vitest, ESLint, CI GitHub Actions.
  - Fichiers sources = placeholders qui compilent/passent les tests.
  - Livrer : arbre de fichiers créés + output de `pnpm install && pnpm -r build && pnpm -r test`.

### Vague 4 (après bootstrap)
- **Agent D — code-reviewer** (sonnet)
  - Valider que le bootstrap respecte le layout P0.
  - Vérifier que les 3 packages builden isolément.
  - Vérifier qu'aucun import inter-package n'existe encore (c'est P1+).
  - Retour : go/no-go + remédiations.

## ✅ Ready to code: YES (après Vague 1 + synthèse)

Critère de fin P0 :
- `CONTRACTS.md` + `ADAPTERS.md` ont passé code-review
- `pnpm install && pnpm -r build && pnpm -r test && pnpm -r lint` vert sur les 3 packages
- `runs/.../RESULT.md` écrit avec evidence document complet
