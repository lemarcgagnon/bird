# Nichoir — Calculateur 3D de nichoir

Module de calcul et visualisation 3D pour concevoir un nichoir (maison d'oiseau), prêt à être intégré dans un host SaaS.

Application de démo déployable : **Next.js 15 + React 19 + Three.js r160**. Architecture contract-first en monorepo pnpm : le cœur métier (`@nichoir/core`) est pur (zéro DOM), la UI (`@nichoir/ui`) expose un composant React autonome, les ports d'intégration SaaS (`@nichoir/adapters`) sont des interfaces TypeScript prêtes à être câblées par le host.

---

## Fonctionnalités utilisateur

- **6 onglets** :
  - **DIM** — dimensions, plancher, toiture, crête, matériau, porte (type + taille + position), perchoir
  - **VUE** — mode d'affichage (solide / wireframe / xray / edges), vue éclatée, plans de coupe X/Y/Z
  - **DÉCOR** — upload SVG / PNG / JPG par panneau, mode vectoriel (extrusion + bevel) ou heightmap (relief depuis image), contrôles dimensions / relief / clip
  - **CALCUL** — volumes (ext/int/matériau), surfaces, liste des pièces à découper
  - **PLAN** — plan de coupe 2D avec layout shelf-packing, export SVG
  - **EXPORT** — STL maison + porte, ZIP par panneau
- **3D interactif** — rotation (drag gauche), pan (drag droit), zoom (molette) via `THREE.OrbitControls`. La caméra est préservée lors des changements de paramètres UI.
- **Porte sur 3 faces** — devant / gauche / droite via un toggle sous le type de porte.
- **Bilingue FR / EN** — switch en bas de sidebar, thème clair / sombre (cookie SSR, zéro FOUC).

---

## Stack & architecture

```
nichoir/                                  ← monorepo pnpm workspace
├── packages/
│   ├── nichoir-core/                     ← logique pure : géométrie, calculs, exporters (STL/ZIP/SVG)
│   │   ├── src/
│   │   │   ├── types.ts                  ← contrats TS publics
│   │   │   ├── state.ts                  ← createInitialState
│   │   │   ├── calculations.ts           ← volumes, surfaces, cut list
│   │   │   ├── cut-plan.ts               ← layout shelf-packing 2D
│   │   │   ├── geometry/{panels,deco}.ts ← construction 3D + décors
│   │   │   └── exporters/{stl,zip,svg}.ts
│   │   ├── CONTRACTS.md                  ← source d'autorité des types publics
│   │   └── tests/                        ← 135 tests + 5 snapshot fixtures
│   │
│   ├── nichoir-ui/                       ← React + Three.js impératif
│   │   ├── src/
│   │   │   ├── NichoirApp.tsx            ← composant racine (export principal)
│   │   │   ├── components/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Viewport.tsx          ← wrapper React autour de ViewportAdapter
│   │   │   │   ├── ViewportBoundary.tsx  ← Error Boundary pour WebGL crash
│   │   │   │   ├── primitives/           ← Tabs, ToggleBar, Slider, Checkbox, ThemeToggle…
│   │   │   │   └── tabs/                 ← DimTab, VueTab, DecoTab, CalcTab, PlanTab, ExportTab + sections
│   │   │   ├── viewports/
│   │   │   │   ├── ViewportAdapter.ts    ← interface
│   │   │   │   └── ImperativeThreeViewport.ts ← implémentation Three.js + OrbitControls
│   │   │   ├── utils/parseDecoFile.ts    ← upload SVG/PNG + rasterisation + letterbox
│   │   │   ├── store.ts                  ← Zustand
│   │   │   └── i18n/{messages,useT}.ts
│   │   ├── VIEWPORT.md                   ← contrat ViewportAdapter (V1-V7)
│   │   └── tests/                        ← 302 tests React Testing Library + axe-core
│   │
│   └── nichoir-adapters/                 ← ports pour intégration SaaS
│       ├── src/ports/                    ← 5 interfaces : CreditGate, ProjectStore, AuthContext, Telemetry, DownloadService
│       ├── src/fakes/                    ← impls de référence (InMemory, Browser, Fake…)
│       └── ADAPTERS.md
│
├── apps/
│   └── demo/                             ← Next.js 15 App Router
│       ├── app/
│       │   ├── layout.tsx                ← RSC, lit cookie nichoir-theme server-side
│       │   ├── theme-resolver.ts         ← helper pur (pas de dép Next)
│       │   └── tools/nichoir/page.tsx    ← route /tools/nichoir
│       └── next.config.ts                ← transpilePackages workspace
│
└── runs/                                 ← evidence documents par phase (TASK/PLAN/RESULT + artifacts)
```

**Invariants enforced** :
- `@nichoir/core` ne référence ni DOM, ni React, ni Next — testable en Node pur. Vérifié par `grep DOM|window|React` = 0 match en runtime.
- `@nichoir/adapters/src/ports/*` ne contiennent que des interfaces TS — les fakes sont séparés.
- `@nichoir/ui` est consommable comme composant React : `<NichoirApp />` suffit pour avoir le calculateur complet.

---

## Utilisation locale

### Prérequis
- Node.js 20+
- pnpm 10+

### Lancer la démo

```bash
pnpm install
pnpm -C apps/demo dev
# ouvre http://localhost:3000/tools/nichoir
```

Le hook `predev` rebuild automatiquement les 3 packages workspace avant de lancer Next — évite le piège classique « dist stale ».

### Tests + lint + typecheck

```bash
pnpm -r typecheck     # 4/4 packages
pnpm -r test          # 441 tests verts (135 core + 4 adapters + 302 ui)
pnpm -r lint          # 4/4 packages
```

### Build prod

```bash
pnpm -C apps/demo build && pnpm -C apps/demo start
```

`/tools/nichoir` est rendu dynamique (`ƒ` dans l'output Next) parce que le layout lit un cookie server-side pour le thème. Coût négligeable, élimine tout hydration mismatch et FOUC.

---

## Intégration dans un SaaS hôte

Le module est pensé pour être embarqué dans une app Next.js existante :

```tsx
// Dans votre host SaaS :
import { NichoirApp } from '@nichoir/ui';
import '@nichoir/ui/theme.css';

export default function BirdhousePage() {
  return <NichoirApp />;
}
```

### Ports SaaS (adapters)

`@nichoir/adapters` définit 5 interfaces que le host peut implémenter :

| Port              | Rôle                                           | État dans la UI      |
|-------------------|------------------------------------------------|----------------------|
| `AuthContext`     | qui est le user connecté                       | défini, non-câblé    |
| `CreditGate`      | `canExport(): Promise<boolean>` — gating export| défini, non-câblé    |
| `ProjectStore`    | persistance des projets user                   | défini, non-câblé    |
| `Telemetry`       | events facturables / usage                     | défini, non-câblé    |
| `DownloadService` | hand-off du fichier exporté                    | **câblé** via React Context (`DownloadServiceProvider`), fallback `BrowserDownloadService` |

Le wiring complet des 4 ports non-câblés dans la UI (≈ 3–5 jours) reste ouvert — voir section "Roadmap" du `HANDOVER.md`.

---

## Patterns & décisions clés

### State / store
- **Zustand** pour le store UI. Mutations atomiques via actions typées (`setParam`, `setClipAxis`, `setDecoSlot`, `setActiveDecoKey`, `setLang`, `setActiveTab`).
- `@nichoir/core`/`createInitialState()` retourne un `NichoirState` conforme au contrat.

### Thème
- Cookie `nichoir-theme` lu server-side dans `app/layout.tsx` → `<html data-theme={theme}>` rendu directement par le SSR. Pas de script anti-FOUC, pas de `suppressHydrationWarning`, zéro mismatch possible.
- Toggle `ThemeToggle` écrit le cookie + mute `dataset.theme` côté client.

### i18n
- Plat, `messages.ts` fr / en. Hook `useT()` retourne `t(key, params?)`.
- Warnings de parse deco stockés structurés `{ key, params }` et traduits au render → suivent la langue active même après parse.

### Viewport 3D
- `ImperativeThreeViewport` (class TS pure) derrière l'interface `ViewportAdapter` — découplé de React. R3F déférable sans toucher aux composants.
- `OrbitControls` instancié au `mount()`, disposé au `unmount()`. `update(state)` ne ré-applique la caméra **que si `state.camera` change de référence** — sinon la rotation souris persiste à travers les autres changements UI.

### Tests
- Vitest + jsdom. 302 tests UI couvrent primitives, tabs, viewport (mocks WebGLRenderer/ResizeObserver), accessibility (axe-core), i18n.
- Tests matériels imposés par review : `expect(bytes.byteLength).toBeGreaterThan(X)` + cross-check vs appel direct core, pas juste call count.
- 5 fixtures snapshot `presetA…E.snapshot.json` verrouillent la parité geometry/STL sur 5 configurations de référence.

### CI
- `.github/workflows/ci.yml` : typecheck → lint → test → build packages → build apps/demo. Le build apps/demo garantit l'intégration end-to-end (pas juste les packages isolés).

---

## Roadmap

- **Dette fermée** : FOUC / hydration mismatch (B2), letterbox DÉCOR (B3), Error Boundary WebGL (B1), `lastParseWarning` langue figée.
- **Ouvert** : câblage des ports `AuthContext` / `CreditGate` / `ProjectStore` / `Telemetry` dans la UI pour enabler l'intégration SaaS facturable. PNG plan raster (reporté, SVG couvre la découpe CNC).

Voir `HANDOVER.md` pour l'état détaillé par phase, `runs/` pour les evidence documents + artefacts (screenshots, traces, metrics).

---

## Licence

Privé (projet personnel + intégration SaaS prévue).
