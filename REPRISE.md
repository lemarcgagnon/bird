# Reprise Nichoir

Date: 2026-04-18

## État actuel

L'app Next.js existe et tourne sur `/tools/nichoir`.

Phases validées:
- `P2.1` socle UI/store/i18n/viewport wrapper
- `P2.2a` shell, tabs, thème, langue
- `P2.2b` onglet `DIM`
- `P2.3` onglet `VUE`
- `P2.4` onglet `CALC`
- `P2.5` onglet `PLAN`
- `P2.5.5` `ViewportBoundary` pour survivre à un crash WebGL

Travail local déjà présent dans le workspace:
- `P2.6 EXPORT` semble codé localement
- fichiers présents:
  - [ExportTab.tsx](/home/marc/Documents/cabane/nichoir/packages/nichoir-ui/src/components/tabs/ExportTab.tsx)
  - [ExportStlSection.tsx](/home/marc/Documents/cabane/nichoir/packages/nichoir-ui/src/components/tabs/ExportStlSection.tsx)
  - [ExportPlanSection.tsx](/home/marc/Documents/cabane/nichoir/packages/nichoir-ui/src/components/tabs/ExportPlanSection.tsx)
  - [DownloadServiceContext.tsx](/home/marc/Documents/cabane/nichoir/packages/nichoir-ui/src/adapters/DownloadServiceContext.tsx)
  - [ExportButton.tsx](/home/marc/Documents/cabane/nichoir/packages/nichoir-ui/src/components/primitives/ExportButton.tsx)
  - [ExportTab.test.tsx](/home/marc/Documents/cabane/nichoir/packages/nichoir-ui/tests/ExportTab.test.tsx)
  - [DownloadServiceContext.test.tsx](/home/marc/Documents/cabane/nichoir/packages/nichoir-ui/tests/DownloadServiceContext.test.tsx)

Important: `P2.6` n'a pas encore été relu formellement ici. Le prochain geste recommandé est donc une review codex de l'implémentation locale `EXPORT`, puis une passe navigateur.

## Vérifications relancées juste avant fermeture

Vert:
- `pnpm -r typecheck`
- `pnpm -r test -- --run`
- `pnpm -r lint`
- `pnpm --filter @nichoir/demo build`

Détail utile:
- `pnpm -C packages/nichoir-ui test -- --run` -> `177` tests UI verts
- build demo -> route `/tools/nichoir` statique, `282 kB` first load JS

## Décisions déjà prises

Pour `P2.6 EXPORT`:
- `PNG` différé à `P3`
- `DownloadService` injecté via `Context React`
- `BrowserDownloadService` ne doit pas être passé depuis [page.tsx](/home/marc/Documents/cabane/nichoir/apps/demo/app/tools/nichoir/page.tsx:1)
  - la page est un `Server Component`
  - le fallback browser doit être instancié côté client dans [NichoirApp.tsx](/home/marc/Documents/cabane/nichoir/packages/nichoir-ui/src/NichoirApp.tsx:1)
- `buildPanelDefs` doit être appelé avec la vraie signature:
  - `buildPanelDefs(state)`
  - pas `buildPanelDefs(params, decos, t)`
- UX validée:
  - bouton `Door STL` désactivé si `door === 'none'` ou `!doorPanel`
  - erreurs runtime en message inline `role="alert"`
- structure validée:
  - `▸ EXPORT STL`
  - `▸ EXPORT PLAN`
- `export.plan` est une clé additive justifiée

Pour les dettes restantes:
- `B2` hydration mismatch `data-theme` reste reporté
- centralisation/memoization des calculs dérivés reste reportée après `P2.6`
- `PNG plan` reporté à `P3`
- `DÉCOR` reste la grosse phase finale

## Prochain geste recommandé

1. Relire `P2.6 EXPORT` contre le scope validé.
2. Vérifier en priorité:
   - que `BrowserDownloadService` est bien créé côté client
   - que `buildPanelDefs(state)` est bien utilisé
   - que les tests vérifient du contenu matériel exporté, pas juste des appels
3. Si la review est bonne:
   - lancer une passe navigateur manuelle sur `EXPORT`
   - screenshots prod
   - vérifier `STL house`, `STL door`, `ZIP`, `SVG plan`
4. Ensuite seulement:
   - valider `P2.6`
   - scoper `DÉCOR`

## Commandes de reprise

Checks:
```bash
pnpm -r typecheck
pnpm -r test -- --run
pnpm -r lint
pnpm --filter @nichoir/demo build
```

Serveur local:
```bash
pnpm -C apps/demo dev
```

URL:
```text
http://localhost:3000/tools/nichoir
```

## Prompt de reprise conseillé

```text
Relis l'implémentation locale de P2.6 EXPORT avant toute autre chose.

Contexte:
- P2.1 -> P2.5.5 déjà validés
- P2.6 semble codé localement mais pas encore revu
- checks automatiques verts au moment de la reprise

Points de contrôle:
- BrowserDownloadService instancié côté client, pas injecté depuis page.tsx server
- buildPanelDefs(state) utilisé avec la vraie signature
- DownloadServiceContext correct
- ExportTab tests matériels sur le contenu exporté
- puis passe navigateur EXPORT
```

## Note pratique

Depuis ce dossier, `git` n'était pas disponible au moment de la fermeture:
- `git status` -> `fatal: not a git repository`

Donc si tu veux aussi reprendre avec historique/branche, il faudra d'abord retrouver la racine git correcte ou confirmer que ce snapshot n'est pas dans un repo git.
