# Nichoir — Calculateur 3D de nichoir

Module de calcul et visualisation 3D pour concevoir un nichoir (maison d'oiseau), prêt à être intégré dans un host SaaS.

Application de démo déployable : **Next.js 15 + React 19 + Three.js r160**. Architecture contract-first en monorepo pnpm : le cœur métier (`@nichoir/core`) est pur (zéro DOM), la UI (`@nichoir/ui`) expose un composant React autonome, les ports d'intégration SaaS (`@nichoir/adapters`) sont des interfaces TypeScript prêtes à être câblées par le host.

---

## Fonctionnalités utilisateur

- **6 onglets** :
  - **DIM** — dimensions, plancher, toiture, crête (left/right/miter), matériau, porte (type + taille + position + face de porte), accessoires (perchoir, suspension 4 trous)
  - **VUE** — mode d'affichage (solide / wireframe / xray / edges), vue éclatée, plans de coupe X/Y/Z, palette de couleurs (4 thèmes : Bois naturel / Bois contrasté / Couleurs distinctes / Monochrome)
  - **DÉCOR** — upload SVG / PNG / JPG par panneau, mode vectoriel (extrusion + bevel) ou heightmap (relief depuis image), **découpe traversante** (motif SVG → vrai trou watertight dans le panneau, laser/CNC-ready), contrôles dimensions / relief / clip
  - **CALCUL** — volumes (ext/int/matériau), surfaces, liste des pièces à découper
  - **PLAN** — plan de coupe 2D **multi-bin** avec layout shelf-packing (répartit automatiquement les pièces sur N panneaux physiques), export ZIP (1 SVG par panneau)
  - **PLAN 2** — même rendu que PLAN mais avec l'algorithme `rectangle-packer` (MIT) au lieu du shelf-packing. Permet une comparaison visuelle directe. Voir `runs/2026-04-23-coupe/RESULT.md` pour le benchmark chiffré.
  - **EXPORT** — STL maison + porte (orientation Z-up, plancher à Z=0 prêt pour slicer), ZIP par panneau, capture 3D (.png du viewport)
- **3D interactif** — rotation (drag gauche), pan (drag droit), zoom (molette) via `THREE.OrbitControls`. La caméra est préservée lors des changements de paramètres UI.
- **Porte sur 3 faces** — devant / gauche / droite via un toggle sous le type de porte.
- **Trous de suspension** — 4 trous dans les débordements du toit (2 par panneau), symétriques front/back, position + diamètre réglables.
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
│   │   │   ├── cut-plan.ts               ← layout shelf-packing 2D multi-bin
│   │   │   ├── palettes.ts               ← 4 palettes de couleurs (wood / wood-contrast / colorful / mono)
│   │   │   ├── geometry/{panels,deco}.ts ← construction 3D + décors (incl. through-cut, hang holes, deco 2D boolean)
│   │   │   └── exporters/{stl,zip,svg,plan-zip}.ts  ← STL Z-up, ZIP STL panels, SVG par panneau, ZIP multi-SVG plan
│   │   ├── CONTRACTS.md                  ← source d'autorité des types publics (v0.2.0 multi-bin)
│   │   └── tests/                        ← 168 tests + 5 snapshot fixtures
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
│   │   ├── VIEWPORT.md                   ← contrat ViewportAdapter (V1-V7 + captureAsPng pour export PNG 3D)
│   │   └── tests/                        ← 317 tests React Testing Library + axe-core
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
pnpm -r test          # 489 tests verts (168 core + 4 adapters + 317 ui)
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
- Vitest + jsdom. 317 tests UI couvrent primitives, tabs, viewport (mocks WebGLRenderer/ResizeObserver), accessibility (axe-core), i18n.
- Tests matériels imposés par review : `expect(bytes.byteLength).toBeGreaterThan(X)` + cross-check vs appel direct core, pas juste call count.
- 5 fixtures snapshot `presetA…E.snapshot.json` verrouillent la parité geometry/STL sur 5 configurations de référence (régénérées en branche `multi-bin` pour le nouveau contrat `CutLayout` + orientation Z-up du STL).

### Géométrie des trous (door / perch / hang / through-cut)
- Pattern uniforme : `THREE.Shape` + `THREE.Path` holes + `THREE.ExtrudeGeometry` → watertight par construction (pas de CSG).
- **Porte** : forme (round / square / pentagon) soustraite via Path dans la Shape du mur porteur.
- **Perchoir** : cercle soustrait dans la façade, prisme cylindrique ajouté comme pièce séparée.
- **Trous de suspension** (4 au toit) : cercles soustraits dans les panneaux de toit via `buildRoofPanelWithHoles`. Quand ridge='miter' + hang=true, le panneau se construit en 2 pièces (corps principal avec trous + bandelette chanfrein) pour préserver le miter.
- **Découpe traversante déco** (Phase 1 MVP) : motif SVG projeté en 2D dans le frame local du mur, ajouté comme Paths aux holes de la Shape du panneau → vrai trou through-the-panel, pas un mesh déco séparé. Applicable aux 4 murs (front/back/left/right) en mode vector. Roof + heightmap à venir en Phase 2.

### Orientation STL (Z-up)
- Transformation `(x, y, z)_three → (x, -z, y)_stl` + translation pour min Z=0 appliquée dans `generateHouseSTL` / `generateDoorSTL` / `generatePanelsZIP` (helper `_applyPrintTransform` dans `exporters/stl.ts`).
- Cabane debout sur le build plate du slicer 3D (Cura, PrusaSlicer, Bambu).

### CI
- `.github/workflows/ci.yml` : typecheck → lint → test → build packages → build apps/demo. Le build apps/demo garantit l'intégration end-to-end (pas juste les packages isolés).

---

## Roadmap

- **Dette fermée** :
  - FOUC / hydration mismatch (B2), letterbox DÉCOR (B3), Error Boundary WebGL (B1), `lastParseWarning` langue figée.
  - Plan de coupe multi-bin (v0.2.0, branche `multi-bin`).
  - STL Z-up orientation (cabane debout sur build plate slicer).
  - Capture 3D PNG depuis le viewport Three.js.
  - 4 trous de suspension dans le toit (pattern Shape+holes+Extrude).
  - Sélecteur de palette 4 couleurs (3D + plan de coupe 2D).
  - HIG Level 1 : section labels discoverables + groupe ACCESSOIRES.
  - Through-cut SVG pattern (Phase 1 MVP) : motif SVG → vrai trou dans le mur, laser/CNC-ready.
  - Benchmark shelf vs rectpack (branche `coupe`) — égalité sur les 5 presets (tous tiennent sur 1 panneau), évidence chiffrée dans `runs/2026-04-23-coupe/RESULT.md`.
- **Ouvert** :
  - Câblage des ports `AuthContext` / `CreditGate` / `ProjectStore` / `Telemetry` dans la UI pour enabler l'intégration SaaS facturable.
  - Phase 2 through-cut : mode "deboss/pocket" (gravure peu profonde, pas à travers) via builder 2-layer watertight dédié (pas un simple merge).
  - Phase 2 through-cut : extension aux panneaux de toit (roofL/roofR) et au mode heightmap.
  - HIG Level 2 : sections DIM collapsibles (accordions) ; Level 3 : split DIM → Structure / Accessoires.

Voir `HANDOVER.md` pour l'état détaillé par phase, `runs/` pour les evidence documents + artefacts (screenshots, traces, metrics).

---

## Licence

Privé (projet personnel + intégration SaaS prévue).
