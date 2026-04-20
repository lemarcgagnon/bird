# NOTES — session state

## Décisions verrouillées (Claude ↔ codex ↔ user)

- Architecture 3 packages : `nichoir-core` / `nichoir-ui` / `nichoir-adapters`
- Three.js impératif au premier passage, wrappé derrière `ViewportAdapter`
- i18n plat conservé (`translations.js` → `messages.ts` + `useT()`)
- `generatePlanPNG` EXCLU du core (zéro DOM)
- `CreditGate.canExport() → Promise<boolean>` même en fake (server-authoritative par défaut)
- `CONTRACTS.md` vit dans `packages/nichoir-core/`, pas dans runs/
- Les fake impls sont du vrai code dans `nichoir-adapters/src/fakes/`, pas dans les .md

## Assumptions (à valider avec user)

- Package manager = **pnpm** (le plus courant pour monorepo, aligné Next.js).
  Si le SaaS utilise npm/yarn, on s'alignera en P3.
- Emplacement = dans `/home/marc/Documents/cabane/nichoir/` au niveau racine.
  Les fichiers existants (v15, refactor) restent intacts.
- Next.js **15** + React **19** + App Router.
- Three.js **r160+** (bundlé npm, pas CDN). v15 reste en r128 via CDN.
- TypeScript **strict**: true, noUncheckedIndexedAccess: true.
- Node **20+**.

## Failure modes identifiés

- Agent qui écrit du code métier en P0 (drift de scope)
- Agent qui invente des types au lieu d'extraire (missing_context)
- tsconfig global qui casse le build existant (environment_issue)
- Pnpm workspace qui matche `index.html` accidentellement (wrong_scope)
