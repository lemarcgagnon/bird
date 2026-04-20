# ACCEPTANCE — Critères P1 et P2

> Document de gouvernance. Chaque case à cocher est un critère mesurable.
> La phase n'est pas considérée complète tant qu'une case reste non-cochée
> sans justification écrite et validation orchestrateur + revue.

---

## Presets de référence (utilisés par P1 et P2)

Les 5 presets listés ci-dessous couvrent les branches fonctionnelles principales.
Ils sont capturés en deux vagues selon le support deco nécessaire :
- **P1.0** : A, B, C (aucune déco active, pures calculs/géométrie/exports)
- **P1.2** : D, E (nécessitent des ressources heightmap + SVG de déco)

| # | Nom | Overrides explicites (vs `createInitialState()`) | Capturé en | Motivation |
|---|---|---|---|---|
| A | `default` | (aucun) | ✅ P1.0 | parité sur le cas nominal |
| B | `pentagon-door-tapered` | `W=180, H=260, D=160, taperX=-20, door='pentagon', doorW=45, doorH=60, doorFollowTaper=true, perch=true, perchDiam=8, perchLen=30, perchOff=15` | ✅ P1.0 | taper négatif + pentagon dimensionné + perch |
| C | `steep-miter` | `slope=60, ridge='miter', overhang=50, T=18` | ✅ P1.0 | angles extrêmes + miter |
| D | `pose-heightmap-deco` | `floor='pose', ridge='right'` + `decos.front = { enabled:true, mode:'heightmap', ...}` | ⏳ P1.2 | floor alternatif + déco heightmap |
| E | `all-decos-vector` | `ridge='left', doorPanel=true` + 4 décos vectorielles actives | ⏳ P1.2 | branches vector + door panel séparé |

---

### Source d'autorité des fixtures (décision P1.0)

**Source retenue** : `src/*` modular refactor (racine du projet).

**Chemin de capture** : `packages/nichoir-core/tests/fixtures/capture-reference.mjs`
importe dynamiquement `src/state.js`, `src/calculations.js`, `src/cut-plan.js`,
`src/geometry/panels.js` et reproduit en Node la logique des exporters DOM-bound
(`exportHouseSTL`, `exportPlanSVG`) sans appel au DOM.

**Justification du choix** :
- `src/*` est le refactor modulaire ES de `nichoir_v15.html`, prouvé **visuellement
  équivalent** à v15 via `http://localhost:8765/` vs `http://localhost:8765/nichoir_v15.html`
  (phase 0 de cette session — le serveur http-server tourne toujours).
- `src/*` expose ses fonctions comme ES modules → capture directe en Node, sans
  puppeteer ni DOM scraping sur v15.
- Les fonctions `src/*` sont des transcriptions 1:1 du `<script>` inline de v15
  (même ordre, mêmes algorithmes, mêmes constantes). Toute divergence src/↔v15
  aurait été visible au spot-check visuel.

**Limites assumées** :
- La référence **n'est pas indépendante** du travail de refactoring déjà fait.
  Si `src/*` contient un bug hérité de v15, la fixture reproduit ce bug, et
  le port TS reproduit ce bug → parité "verte" cache un défaut réel.
- Mitigation : **spot-check navigateur obligatoire une fois par phase** — ouvrir
  `localhost:8765/nichoir_v15.html` avec les overrides A/B/C (sliders manuels),
  vérifier que `volumes.ext` affiché dans CALC tab correspond aux anchor values :
    - A = 6 349 012.5 mm³
    - B = 7 563 469.0 mm³
    - C = 7 405 620.0 mm³
  Cette étape est à faire AVANT P1.1 par l'orchestrateur (ou user).

**Alternative rejetée (Option B)** : capture puppeteer headless depuis
`nichoir_v15.html`. Rejetée parce que : (a) v15 n'expose aucune fonction
globalement (script inline en closure), (b) DOM scraping des sliders + lecture
des textes affichés est fragile, (c) le bénéfice d'indépendance est marginal vs
`src/*` visuellement équivalent à v15.

Si un écart src/↔v15 est découvert en cours de port, la fixture est invalidée
et le travail s'arrête jusqu'à clarification conjointe orchestrateur + revue externe.

---

### MD5 des fixtures P1.0 + P1.2.β (immutables, idempotentes)

| Fixture | Source | MD5 |
|---|---|---|
| `presetA.snapshot.json` | `src/*` (P1.0, 2026-04-16) | `b0081bb3209d57d3a5b702d9b095ef7c` |
| `presetB.snapshot.json` | `src/*` (P1.0, 2026-04-16) | `a8a8c4793d832cee0917dd1217c58053` |
| `presetC.snapshot.json` | `src/*` (P1.0, 2026-04-16) | `3e4c95a38b3d6c72ae8911a881b16598` |
| `presetD.snapshot.json` | **mixte TS+src** (P1.2.β, 2026-04-17) | `e104c1c81b0afac00b8da8884f0d97eb` |
| `presetE.snapshot.json` | **mixte TS+src** (P1.2.β, 2026-04-17) | `a5ed18ed689d39dea02e0e90edafdd81` |

**⚠️ Limite assumée pour D/E — capture mixte TS+src** :
- `state` + `buildPanelDefs` (et donc STL house/door/zip dérivés) → **TS port**. Raison :
  la branche heightmap de `src/geometry/deco.js:143` utilise `document.createElement('canvas')` →
  non-exécutable en Node.
- `computeCalculations` + `computeCutList` + `computeCutLayout` (et donc `planSvg`) → **src/***
  (par inertie ; parité 1e-6 prouvée en P1.1 entre src et TS, donc numériquement équivalent).

D/E sont des **snapshots de régression du port**, pas des références indépendantes vs v15.

Les fixtures sont idempotentes — le script `capture-reference.mjs` les regénère
bit-à-bit identiques (le champ `capturedAt` a été retiré en remédiation).
Tout changement de MD5 sans modification explicite du script ou de `src/*` =
alerte gouvernance à investiguer.

---

## P1 — Port du core pur

### Entrées
- Monorepo P0 validé
- `packages/nichoir-core/CONTRACTS.md` figé v0.1.0
- `packages/nichoir-core/src/types.ts` (extrait en P0)
- Source v15 dans `/home/marc/Documents/cabane/nichoir/src/**` (référence)

### Sorties attendues
- `packages/nichoir-core/src/` rempli avec :
  - `state.ts` (`createInitialState`)
  - `calculations.ts` (`computeCalculations`, `computeCutList`)
  - `cut-plan.ts` (`computeCutLayout` uniquement — pas de `drawCutPlan`)
  - `geometry/panels.ts` (`mkPent`, `mkHexPanel`, `buildPanelDefs`)
  - `geometry/deco.ts` (`buildDecoGeoVector`, `buildDecoGeoHeightmap`, `placeDecoOnPanel`, `buildPanelClipPlanes`)
  - `exporters/stl.ts` (`generateHouseSTL`, `generateDoorSTL`)
  - `exporters/zip.ts` (`generatePanelsZIP` avec JSZip bundlé)
  - `exporters/svg.ts` (`generatePlanSVG`)
  - Tous re-exportés depuis `src/index.ts`

### Critères mesurables (doivent tous être cochés)

**Compilation / qualité code** :
- [ ] `pnpm --filter @nichoir/core typecheck` vert, 0 erreur, 0 `any` dans la surface publique
- [ ] `pnpm --filter @nichoir/core build` vert, produit `dist/` avec `.d.ts` complets
- [ ] `pnpm --filter @nichoir/core lint` vert (0 warning accepté)

**Invariants de contrat** :
- [ ] `grep -rE "\b(document|window|HTMLCanvas|HTMLElement|DOMParser|requestAnimationFrame|Image)\b" packages/nichoir-core/src` retourne **0 match**
- [ ] `grep -rE "\b(Blob|URL\.createObjectURL|URL\.revokeObjectURL)\b" packages/nichoir-core/src` retourne **0 match**
- [ ] `grep -rE "from ['\"]react['\"]|from ['\"]next/" packages/nichoir-core/src` retourne **0 match**
- [ ] `grep -rE "from ['\"].*i18n|import.*translations" packages/nichoir-core/src` retourne **0 match**

**Parité numérique stricte (tolérance 1e-6)** :
- [ ] Pour chaque preset A-E : `computeCalculations(preset.params)` retourne `volumes`, `surfaces`, `derived` identiques à la fixture de référence (tolérance relative 1e-6)
- [ ] Pour chaque preset A-E : `computeCutList(preset.params, derived)` retourne des éléments avec `qty`, `dim` (string), `nameKey` identiques à la référence (`doorShape` inclus si applicable)
- [ ] Pour chaque preset A-E : `computeCutLayout(preset.params)` retourne `pieces[]` (noms + bbox + orientation + overflow), `shW`, `shH`, `totalArea` identiques (tolérance 1e-6)

**Parité structurelle géométrique** :
- [ ] Pour chaque preset A-E : snapshot JSON de `buildPanelDefs(preset).defs` normalisé (hash trié par `key`, triangle count, bbox par `PanelDef`) identique à la référence
- [ ] Pour chaque preset A-E : `buildPanelDefs(preset).derived` (fields `wallH`, `rH`, `sL`, etc.) identique (tolérance 1e-6)

**Parité artifacts d'export** :
- [ ] Pour chaque preset A-E : `generateHouseSTL` produit un `Uint8Array` dont :
  - triangle count identique à la référence v15 (exact)
  - bbox (min/max X/Y/Z agrégés sur tous triangles) dans ±0.1 mm de la référence
- [ ] Pour chaque preset A-E : `generateDoorSTL` retourne `null` ou un `Uint8Array` cohérent avec la présence du `doorPanel`
- [ ] Pour chaque preset A-E : `generatePanelsZIP` produit un ZIP dont la liste de fichiers (noms + compte) correspond à la référence ; le contenu des STL internes respecte triangle count + bbox
- [ ] Pour chaque preset A-E : `generatePlanSVG` produit une string dont (a) elle est un SVG valide (parsable), (b) le nombre de `<polygon>`/`<rect>`/`<text>` correspond à la référence v15, (c) tous les placeholders `translate()` ont été résolus

**Robustesse / nature STL** :
- [ ] Test explicite : sur preset sans décos (presets A, B, C), chaque panneau primitif individuellement est watertight (Euler χ=2 sur chaque `PanelDef` pris isolément)
- [ ] Test explicite : sur preset D (heightmap), le panneau `front` n'est PAS watertight (comportement attendu, documenté)
- [ ] Tests STL s'exécutent en Node pur (`environment: 'node'`), 0 `jsdom`

**Tests d'ambiguïté (résoudre les cas bordures)** :
- [ ] Test : `heightmapData` de taille incorrecte (ex: 63×63 fourni pour resolution=64) → **`buildDecoGeoHeightmap` throw `TypeError`** (conformément au contrat CONTRACTS.md, pas de comportement silencieux)
- [ ] Test : `heightmapResolution <= 0` ou non-entier → **`buildDecoGeoHeightmap` throw `TypeError`**
- [ ] Test : `doorFollowTaper` avec `taperX=0` → rendu identique à `doorFollowTaper=false` (pas de bug de division)

> Note : le test "`translate` retourne undefined" est explicitement **hors-scope P1** —
> le contrat `Translator` exige `string` en retour, c'est une responsabilité de l'appelant.
> Un test de robustesse "useT ne casse pas sur clé manquante" est porté par P2 (UI).

**Gouvernance** :
- [ ] `CONTRACTS.md` est inchangé vs P0 (MD5 stable). Tout changement nécessaire de contrat = bloquant tant que codex + orchestrateur n'ont pas validé.
- [x] Fixtures A, B, C commit dans `packages/nichoir-core/tests/fixtures/` avec MD5 notés ci-dessus (P1.0 fermé sous Option A+ mitigation renforcée — voir `RESULT.md`).
- [ ] Fixtures D, E (décorations heightmap + vector) commit en P1.2 après port de `geometry/deco.ts`. MD5 à ajouter ici à ce moment.
- [ ] Aucun code UI, aucun code React, aucun import de DOM dans `@nichoir/core`.

### Non-goals explicites P1

- Pas de composant React
- Pas de Next.js
- Pas d'adaptateurs réels (les interfaces existent depuis P0, c'est tout)
- Pas de drawCutPlan (preview canvas = P2)
- Pas de generatePlanPNG (raster = P2 via canvas)
- Pas de visualisation Three.js de la scène (viewport = P2)
- Pas de R3F (hors-scope permanent du port)

### Failure modes à surveiller P1

- `patch_too_large` : agent qui porte tout d'un coup au lieu de module-par-module
- `wrong_scope` : agent qui écrit `materializeDefs` (UI) ou `drawCutPlan` (UI)
- `false_success` : tests qui passent mais les fixtures de référence sont issues d'une v15 subtilement cassée (donc la "parité" = bug reproduit). Mitigation : chaque fixture a un test d'ancrage sur des valeurs connues (ex: preset A : volume ext > 0, volume int < volume ext, etc.)
- `confound_identified` : si 2 ports indépendants échouent au même check, l'hypothèse "changement commun" doit être testée (ex: bug dans `computeCalculations` invisible jusqu'à ce que 3 presets échouent)

---

## P2 — UI shell standalone

### Entrées
- P1 validé (core complet, tous checks verts)
- `packages/nichoir-ui/` vide (sauf scaffold P0)
- `apps/demo/` Next.js 15 App Router
- Adapters fakes depuis P0
- **Prérequis bloquant** : `ViewportAdapter` formalisé dans `packages/nichoir-ui/VIEWPORT.md` (interface TS canonique `mount/update/unmount`, nature des updates, ownership du DOM element, cycle de vie, stratégie de clean-up). Ce document est validé par orchestrateur + codex AVANT que la première class `ImperativeThreeViewport.ts` soit écrite.

### Sorties attendues
- `packages/nichoir-ui/src/` rempli avec :
  - `NichoirApp.tsx` (racine `"use client"`)
  - `store.ts` (Zustand, shape = `NichoirState`)
  - `i18n/{messages.ts, useT.ts}` (messages plats depuis `translations.js` v15, hook `useT`)
  - `viewports/ImperativeThreeViewport.ts` (class TS pure impl Three.js impératif derrière `ViewportAdapter`)
  - `rendering/drawCutPlan.ts` (canvas 2D)
  - `rendering/rasterizePNG.ts` (canvas → Uint8Array)
  - `parsers/parseSVGInBrowser.ts` (DOMParser + getPointAtLength)
  - `parsers/rasterizeImageToHeightmap.ts` (Image + canvas.getImageData)
  - `components/sidebar/` (6 onglets + primitives HIG)
  - `components/primitives/` (Slider, ToggleBar, Checkbox, Tabs, LangSwitcher, ThemeToggle)
- `apps/demo/app/tools/nichoir/page.tsx` qui monte `<NichoirApp>`
- `apps/demo/lib/nichoir-env.ts` avec factory des 5 fakes

### Critères mesurables

**Compilation / qualité code** :
- [ ] `pnpm --filter @nichoir/ui typecheck + build + lint` verts
- [ ] `pnpm --filter demo build` vert (Next.js production build)
- [ ] 0 `any` dans la surface publique de `@nichoir/ui`

**Parité visuelle** :
- [ ] Captures d'écran automatisées (Playwright ou équivalent) de `/tools/nichoir` sur les presets disponibles au moment du check (A/B/C minimum ; D/E si P1.2 est terminé), comparées à des captures de référence de `nichoir_v15.html` : diff pixel **< 2%** par preset (tolérance pour anti-aliasing + fonts)
- [ ] Les 6 onglets (DIM, VUE, DÉCOR, CALCUL, PLAN, EXPORT) affichent les mêmes contrôles et valeurs initiales que v15
- [ ] Theme toggle (clair/sombre) fonctionne, persistance localStorage préservée

**Parité fonctionnelle** :
- [ ] Tous les sliders acceptent la même plage min/max/step que v15
- [ ] Tous les toggle bars (floor, ridge, door, deco mode) fonctionnent et mutent le store
- [ ] Le viewport Three.js affiche un nichoir sur charge initiale (preset A = défaut)
- [ ] Clip planes X/Y/Z fonctionnent et mettent à jour le viewport
- [ ] Mode d'affichage (solid/wireframe/xray/edges) fonctionne
- [ ] Vue éclatée (explode 0-100%) fonctionne
- [ ] Caméra orbitale (drag, pan, zoom, double-clic recentrage) fonctionne
- [ ] Upload d'un SVG/PNG/JPG en DÉCOR, rendu heightmap + vectoriel fonctionnent
- [ ] Live preview du plan de coupe en canvas 2D se rafraîchit à chaque changement
- [ ] Les 5 boutons d'export fonctionnent et déclenchent un téléchargement valide (STL, ZIP, PNG, SVG)
- [ ] Switch FR↔EN met à jour tous les textes, persistance préservée

**Accessibilité (HIG)** :
- [ ] `axe-core` lancé sur `/tools/nichoir` retourne 0 violation `serious` ou `critical`
- [ ] Tous les contrôles interactifs sont focusables au clavier (tab order cohérent)
- [ ] Les sliders ont `aria-label` (dérivé du label visible)
- [ ] Les toggle bars ont `role="radiogroup"` et `aria-checked` sur les boutons
- [ ] Les tabs ont `role="tablist"`/`"tab"`/`"tabpanel"` et `aria-selected`
- [ ] Contraste WCAG AA vérifié sur text (4.5:1) et UI elements (3:1) en light et dark mode

**Intégration fakes (structure adapter)** :
- [ ] `useCredits().canExport()` est awaité avant chaque export (call-site existe, même si fake retourne `true`)
- [ ] `useProject().save()` est appelable depuis un bouton "Sauvegarder" (fonctionnel contre `InMemoryProjectStore`)
- [ ] `useDownload()` est utilisé pour tous les téléchargements (pas de `URL.createObjectURL` direct dans les composants)
- [ ] `useTelemetry()` track chaque export (`nichoir.export.started/succeeded/failed`)
- [ ] `useAuth().isAuthenticated` est lu par le shell (mais pas bloquant en P2)

**Test harness** :
- [ ] Tests unitaires Vitest + React Testing Library pour primitives HIG (Slider, ToggleBar, Tabs)
- [ ] Tests d'intégration (Playwright ou Vitest+jsdom) pour tous les presets alors commit (A/B/C minimum ; D/E si P1.2 terminé) → chargement d'un preset et vérification que le store s'initialise correctement
- [ ] Coverage > 70% sur `packages/nichoir-ui/src/` (indicatif, pas bloquant)

**Gouvernance** :
- [ ] `CONTRACTS.md` et `ADAPTERS.md` inchangés vs P0 (MD5 stables)
- [ ] Aucun bypass des adapters : 0 appel direct à `URL.createObjectURL` ou `document.createElement('a')` dans `components/` (autorisé uniquement dans `fakes/BrowserDownloadService.ts`)
- [ ] Aucun `"use server"` dans le module (P2 = pur client)

### Non-goals explicites P2

- Pas d'auth réelle (fakes suffisent)
- Pas de persistance serveur (in-memory seulement)
- Pas de paiement / Stripe
- Pas de gate crédit serveur (fake permissive)
- Pas de R3F (impératif Three.js seulement)
- Pas de migration i18n vers next-intl
- Pas de multi-utilisateur / multi-projet UI

### Failure modes à surveiller P2

- `patch_too_large` : refactor UI en un seul commit = ingérable
- `wrong_scope` : composant UI qui réimplémente un calcul du core au lieu d'importer
- `false_success` : tests Playwright qui passent mais captures divergent visuellement sur des presets non-testés
- `environment_issue` : `jsdom` insuffisant pour Three.js (nécessitera `@playwright/test` pour les viewport tests)
- `missing_context` : agent qui crée des composants shadcn/ui alors qu'on n'a pas validé de design system

---

## Gouvernance transverse P1 + P2

**Règle 1 — Contract-first** : tout changement de signature publique dans `@nichoir/core` passe par un diff explicite sur `CONTRACTS.md` approuvé par orchestrateur + revue externe (codex) AVANT la modification du code.

**Règle 2 — Parity-first** : chaque phase démarre par la génération des artifacts de référence v15 et s'achève par la comparaison. Pas de "feeling" : que des nombres.

**Règle 3 — Incrémentalité** : P1 se décompose en sous-phases (P1.1 state/calc/cut-plan → P1.2 geometry → P1.3 exporters). Chaque sous-phase a sa revue avant de démarrer la suivante.

**Règle 4 — Delegation + supervision** : chaque agent enfant livre dans un format qui permet à l'orchestrateur de (a) relancer les commandes de vérification lui-même, (b) diff les artifacts de référence, (c) décider GO/NO-GO/REMEDIATION sans relecture complète.

**Règle 5 — No-scope-creep** : tout ce qui n'est pas dans la liste des critères mesurables ci-dessus est hors-scope. Si un besoin émerge, il passe par un avenant formel à ce document.
