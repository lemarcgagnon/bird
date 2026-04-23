# HANDOVER — Nichoir port monorepo

**Date dernière session :** 2026-04-19
**Dernière phase clôturée :** P2.7c DÉCOR mode/dims/relief/clip + passe navigateur ciblée B3
**Phase en cours :** aucune — **DÉCOR 100 % livré et validé en navigateur**.

---

## TL;DR (30 s)

- 6/6 onglets livrés dans Sidebar. **DÉCOR complet** (P2.7a + P2.7b + P2.7c all GO codex après corrections).
- **422 tests workspace verts** (130 core + 4 adapters + 288 ui).
- `/tools/nichoir` prerendered static, build Next.js vert.
- **Passe navigateur DÉCOR exécutée et verte** :
  1. Letterboxing landscape/portrait/SVG wide validé matériellement
  2. Flow complet : upload SVG → toggle mode → slide dims/relief → viewport 3D OK
  3. Resample async au slide resolution validé
  4. Concurrence par slot validée
  5. Upload pendant resample validé
  6. Absence de fuite UI entre slots validée
- Artefacts : `/tmp/nichoir-screenshots/capture-deco.mjs` + screenshots `deco-*.png`.

---

## État précis au moment de la pause

### Livré cette session (2026-04-19)

**P2.6 EXPORT correction** (GO sans réserve après correction) :
- ExportStlSection : erreur runtime → inline `role="alert"`
- Tests matériels renforcés : byte-à-byte STL + JSZip.loadAsync + test erreur runtime + test ZIP doorPanel
- Dépendance : `jszip@^3.10.1` en devDep ui

**P2.7a DÉCOR orchestrateur + target + enable** (GO sans réserve) :
- `DecoTab`, `DecoTargetSection`, `DecoEnableSection`
- `setActiveDecoKey` + `setDecoSlot(key, patch)` générique dans store
- i18n +8 clés × 2 langues
- Tests d'isolation par slot

**P2.7b DÉCOR file + status + verrou + Supprimer** (GO avec risque résiduel letterbox B3) :
- Helper `src/utils/parseDecoFile.ts` (API unique, resample immédiat aligné contrat core, letterbox v15-fidèle après correction codex)
- `DecoFileSection` (upload + Supprimer reset hybride) + `DecoStatusSection` (port v15)
- Verrou `source===null` sur checkbox enable
- i18n +12 clés × 2 langues
- Tests : parseDecoFile (27 dont 4 letterbox), DecoFileSection (10), DecoStatusSection (12), updates DecoTab + a11y

**P2.7c DÉCOR mode/dims/relief/clip** (GO après correction 3 findings codex) :
- 4 sections : `DecoModeSection` (ToggleBar + warning 4s + parseFallback permanent), `DecoDimensionsSection` (5 sliders w/h/posX/posY/rotation), `DecoReliefSection` (depth/bevel/invert + resolution avec resample async), `DecoClipSection` (checkbox + hint)
- Helper `resampleHeightmapFromSource(source, sourceType, targetRes)` exporté depuis `parseDecoFile.ts`
- Debounce resolution 200ms **par slot** (`Partial<Record<DecoKey, setTimeout>>`)
- Token de génération **par slot** (`Partial<Record<DecoKey, number>>`) pour protéger contre races concurrentes
- Capture `sourceAtStart + sourceTypeAtStart` au start du resample → ignore résultat périmé si upload pendant resample
- `useEffect(..., [activeDecoKey])` dans DecoModeSection + DecoReliefSection pour clear les états UI locaux (transientWarning, error) au switch de slot
- i18n +27 clés × 2 langues (26 v15 + 1 nouvelle `deco.error.resample`)
- Tests : DecoModeSection (12), DecoDimensionsSection (9), DecoReliefSection (12 dont token, upload pendant resample, debounce par slot), DecoClipSection (5), 4 fixes codex couverts par tests matériels

**Corrections codex P2.7c** (3 findings importants tranchés pragmatiquement) :
1. Debounce global → par slot (finding #1)
2. Upload pendant resample → capture source au start (finding #2)
3. Fuite UI locale transientWarning/error → clear au switch slot (finding #3)
4. Claim "ordre port v15" corrigée → commentaire documente la divergence UX assumée (finding #4, pas bloquant)

---

## Reprendre en 2 minutes

```bash
cd /home/marc/Documents/cabane/nichoir

# 1. Vérifier l'état vert
pnpm -r typecheck && pnpm -r test && pnpm -r lint
# Attendu : 422 tests verts (130 core + 4 adapters + 288 ui)

# 2. Lire la dernière décision codex dans l'historique Claude
#    (B3 clôturé, DÉCOR validé en navigateur)

# 3. Aucune action bloquante restante sur P2
```

## Passe navigateur ciblée DÉCOR (clôturée)

**Objectif unique** : valider visuellement ce que les tests unit ne peuvent pas prouver (pixels rendus, flow end-to-end, races concurrentes réelles).

**Checklist minimale à couvrir en une seule passe** :
1. **Letterbox B3 (P2.7b)** : charger 1 PNG landscape (ex: 200×100) + 1 PNG portrait (100×200) + 1 SVG non carré sur un même panneau DÉCOR. Vérifier via capture DOM + screenshot que le heightmap n'est pas étiré (bbox rendue dans viewport 3D est cohérente avec aspect ratio).
2. **Flow DÉCOR c complet** : charger un SVG avec shapes, switch mode vector → vérifier extrusion 3D, slide depth/bevel/w/h/posX/posY/rotation → vérifier impact visible dans viewport.
3. **Resample async (fix #1)** : slide resolution rapide 32→64→128 → vérifier qu'aucun glitch visuel (pas d'ancien heightmap qui remplace le nouveau).
4. **Concurrence slot (fix #1 debounce par slot)** : slide resolution sur front, switch vers back, slide resolution sur back → vérifier que front.heightmap finit à sa nouvelle resolution (check via DOM des valeurs slot).
5. **Upload pendant resample (fix #2)** : slide resolution, charger un nouveau fichier immédiatement → vérifier que heightmapData garde le nouveau fichier.
6. **Fuite UI (fix #3)** : déclencher warning mode vector sans shapes, switch slot → vérifier que le warning disparaît.

**Scripts/helpers dispos** :
```bash
pnpm -C apps/demo build && pnpm -C apps/demo start
# Puis Chrome headless avec flag WebGL :
# chrome --headless --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
# Scripts puppeteer-core dans /tmp/nichoir-screenshots/ :
#   - capture-plan.mjs, capture-boundary.mjs, capture-export.mjs (références)
#   - à créer : capture-deco.mjs pour P2.7
```

**Résultat** : OK. DÉCOR clôturé officiellement ; B3 retiré de la dette ouverte.

Pour relancer le serveur et revoir visuellement (utile pour la passe navigateur DÉCOR de fin de P2.7c) :
```bash
pnpm -C apps/demo build && pnpm -C apps/demo start
# Chrome nécessite --use-gl=angle --use-angle=swiftshader en headless
# (sans quoi WebGL indispo → le ViewportBoundary catch, app reste utilisable mais pas de viewport 3D)
```

---

## Roadmap restante (ordre codex validé)

| Phase | Scope | Status | Notes |
|---|---|---|---|
| P2.7c | DÉCOR mode/dims/relief/clip | **Clôturé** | Toggle `vector`/`heightmap`, sliders `w/h/posX/posY/rotation`, `depth/bevel/invert/resolution`, checkbox `clipToPanel`, intégration viewport 3D. |
| Passe nav. DÉCOR | validation visuelle transversale | **Clôturée** | Exécutée en headless Chrome sur `localhost:3001` avec captures `deco-*.png` et checklist 6 cas verte. |
| P3 | Feature `doorFace` (porte devant/gauche/droite) | **Clôturé** | Nouveau param `Params.doorFace: 'front' \| 'left' \| 'right'` (défaut 'front'). Nouvelle fonction `mkSidePanelWithDoor` pour trou dans mur latéral. UI ToggleBar dans `DimDoorSection.tsx`. Fixtures MD5 intactes (default='front' = comportement historique). Artefacts `runs/2026-04-19-feature-doorFace/`. |
| P3 | OrbitControls souris (rotate/pan/zoom) | **Clôturé** | `ImperativeThreeViewport` instancie `THREE.OrbitControls` sur le canvas dans `mount()`, dispose dans `unmount()`. `update(state)` ne ré-applique `updateCameraFromState` que si `state.camera` a changé de référence — évite d'écraser la rotation souris lors des changements UI. Preuve matérielle par puppeteer : drag + wheel + setParam door=round, caméra préservée. Artefacts `runs/2026-04-19-feature-orbitControls/`. |
| P3 | PNG plan de coupe (raster browser) | Reporté volontairement | Pas essentiel, SVG couvre la découpe CNC |
| P3 | `data-theme` hydration mismatch (B2) | **Clôturé** | Refactor cookie-based SSR : `apps/demo/app/layout.tsx` lit `cookies()` + `resolveTheme()` → rend `<html data-theme={theme}>` directement. Suppression de `theme-boot.ts` (script inline anti-FOUC), `suppressHydrationWarning`, localStorage theme. Trade-off : `/tools/nichoir` passe de ○ Static à ƒ Dynamic. Artefacts `runs/2026-04-19-B2-cookie-theme-ssr/`. |
| P3 | `lastParseWarning` stocké traduit (fidélité v15) | **Clôturé** | Refactor vers `DecoWarning = { key, params? }` + traduction au render dans `DecoModeSection`. Test explicite de switch fr↔en dans `DecoModeSection.test.tsx`. `parseDecoFile` perd son paramètre `t`. |

---

## Rituel de travail (OBLIGATOIRE — validé par usage)

**Pour chaque phase Pn.m :**

1. **Je (Claude) propose un scope détaillé** : fichiers, clés i18n, structure rendu, stratégie tests, critères d'acceptance, divergences v15, points à trancher.
2. **User relaie à codex**, codex rend findings + GO/NOGO + garde-fous.
3. **Je code** en respectant strictement les garde-fous codex.
4. **Je self-review matériellement** avant rapport (pas de sur-vente, preuves concrètes citées avec file:line).
5. **User relaie le rapport à codex** pour review finale.
6. **Codex valide** ou liste des écarts à corriger.
7. **Si écarts** : je corrige honnêtement (pas de défense), re-rapport.

**IMPORTANT : le user a insisté — c'est à MOI de m'assurer que mon code est bon, pas à codex de rattraper mes oublis.**

---

## Garde-fous récurrents codex (accumulés sur P2.1 → P2.6)

### Sur le code

- **Signature réelle `buildPanelDefs(state: NichoirState)`**, pas `(params, decos, t)`
- **Injection adapter depuis Client Component SEULEMENT** (pas RSC ; instances de classe pas sérialisables + dépendance `document`)
- **Class ErrorBoundary NE PEUT PAS utiliser `useT`** : split class générique + fallback fonctionnel
- **Mutations atomiques** : `setState({ params: {...} })` plutôt que 2 `setParam` séparés quand on mute 2 params liés (ex: panelW + panelH)
- **Unmount pattern** pour contrôles conditionnels (pas de `display: none` CSS) : `{condition && <Component/>}`
- **`clip.pos` normalisé 0..1 dans le store**, UI travaille en 0..100 avec `*100` / `/100` explicite
- **Ne PAS réutiliser `generatePlanSVG`** pour l'inline display (il est pensé pour export avec prolog XML, fond blanc)

### Sur les tests

- **Dériver les attendus** du core : `const expected = computeCutList(params, derived).cuts.length`, pas `expect(rows).toBe(5)` hardcodé
- **Tests matériels sur contenu**, pas juste call count : `expect(bytes.byteLength).toBeGreaterThan(100)` + crosscheck vs appel direct core
- **Intégration réelle obligatoire** par phase : monter `<NichoirApp />` + click UI réel + assert store/DOM
- **Test d'intégration après crash utilise un onglet NON-default** (CALC/PLAN, pas DIM qui est déjà actif par défaut)
- **Tests a11y axe-core** : un test par tab avec activeTab pré-muté avant render

### Sur les rapports

- **Matérialité vraie** : chaque claim doit être référencé par `file:line` concret
- **Pas de sur-vente** : si un test ne prouve pas ce qu'on dit, le noter comme gap
- **Divergences documentées dans les headers** des fichiers concernés, pas juste dans le chat

### Sur la revue visuelle

- Chrome headless sans WebGL crash le Viewport (B1 résolu en P2.5.5 mais ViewportBoundary capture le crash)
- Flag magique pour WebGL headless : `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`
- Puppeteer-core installé dans `/tmp/nichoir-screenshots/`, scripts de capture existants réutilisables (`capture-plan.mjs`, `capture-boundary.mjs`, `capture-export.mjs`)

---

## Totaux actuels

```
Tests:      422 (130 core + 4 adapters + 288 ui)
Typecheck:  vert (4/4 packages)
Lint:       vert (4/4)
Build:      next build vert, /tools/nichoir prerendered static
```

Progression tests cette session : 311 (début) → 313 (P2.6 correction +2) → 325 (P2.7a +12) → 374 (P2.7b +49) → 378 (P2.7b letterbox +4) → 418 (P2.7c +40) → **422 (P2.7c corrections +4)**.

---

## Dette connue (reste, assumée)

| # | Dette | Sévérité | Décidé |
|---|---|---|---|
| B1 | Crash WebGL sans Error Boundary | CRITIQUE | **RÉSOLU en P2.5.5** |
| B2 | Hydration mismatch `data-theme` | Basse (dev-only) | **RÉSOLU — cookie-based SSR (voir P3 item dans Roadmap ; artefacts `runs/2026-04-19-B2-cookie-theme-ssr/`)** |
| — | `/tools/nichoir` passe de Static à Dynamic | Négligeable | Trade-off assumé du fix B2. Coût : résolution cookie par requête (<1 ms). Gain : zéro hydration mismatch, zéro FOUC. |
| **B3** | **Parité visuelle letterbox + flow DÉCOR c + races concurrence** | **Moyenne** | **RÉSOLU — passe navigateur ciblée exécutée et verte** |
| — | `lastParseWarning` stocké traduit (bug langue figée) | Basse | **RÉSOLU — refactor `{ key, params }` + traduction au render (P3)** |
| — | Double recompute `computeCalculations` | Négligeable (<100 µs) | À réévaluer si la recompute devient coûteuse |
| — | PNG plan raster | Feature manquante | Reporté P3 |
| — | DÉCOR | — | **LIVRÉ P2.7a+b+c + passe navigateur verte** |

---

## Contacts importants

- **Codex** (reviewer externe) : user sert de relais
- **User préférences actives** :
  - Lecture intégrale des fichiers (pas partielle, jamais)
  - Français pour les explications, anglais pour le code
  - Challenge honnête avant implémentation (pas de sycophancie)
  - Pré-code : ambiguity hunt + intent lock + blast radius
  - Post-code : validation matérielle avant claim "résolu"
  - Responsabilité assumée (ne pas compter sur codex pour rattraper)

---

## Fichiers de référence rapide

- **Scope v15 source** : `/home/marc/Documents/cabane/nichoir/{index.html, src/*.js, styles/*.css}`
- **Contrats core** : `packages/nichoir-core/src/types.ts` + `state.ts`
- **Translations v15 (source de port)** : `src/translations.js`
- **Patterns de test référence** : `tests/PlanTab.test.tsx` (intégration réelle) + `tests/ExportTab.test.tsx` (tests matériels)
- **Patterns d'onglet référence** : `src/components/tabs/PlanTab.tsx` (orchestrateur) + `PlanSizeSection.tsx` (interaction)
- **ViewportBoundary** (pour référence sur le pattern fallback) : `src/components/ViewportBoundary.tsx` + `ViewportErrorFallback.tsx`

---

## Dernière action avant pause

Passe navigateur DÉCOR exécutée avec succès sur `http://localhost:3001/tools/nichoir`. Viewport WebGL headless OK (`canvas` monté), checklist 6 cas verte, artefacts conservés dans `/tmp/nichoir-screenshots/`.

Note opératoire utile : l'app Next consomme `packages/nichoir-ui/dist`, donc un rebuild `pnpm -C packages/nichoir-ui build` a été nécessaire avant la passe pour aligner le package exporté avec `src`.

**Pas d'action de reprise bloquante restante sur P2.**

---

### Breaking change 0.2.0 — CutLayout multi-bin (2026-04-23)

Le contrat `CutLayout` de `@nichoir/core` a été refait pour supporter plusieurs
panneaux. Forme avant : `{ pieces, shW, shH, totalArea }`. Forme après :
`{ panels: Panel[], overflow, totalUsedArea, meanOccupation }`.

L'ancienne export `generatePlanSVG(layout, t)` prend maintenant un `Panel`
(pas un `CutLayout`). Un nouveau helper `generatePlanZIP(layout, t)` agrège N
SVG dans un ZIP (1 fichier `panel-N.svg` par panneau).

Impact SaaS host : un consumer externe qui utilisait `CutLayout.pieces` doit
migrer vers `CutLayout.panels[i].pieces`. L'export SVG consommateur doit
passer un panneau ou utiliser `generatePlanZIP` pour un ZIP multi-panneau.

Motivation : en atelier, le single-bin (flag `overflow=true` sur pièces
débordantes sans re-placement) n'a aucune valeur actionnable. Le multi-bin
répartit automatiquement les pièces sur autant de panneaux physiques que
nécessaire. Overflow strict signale uniquement les pièces plus grandes que
le panneau lui-même (cas d'utilisateur qui a mal dimensionné panelW/panelH).

---

## Branche `coupe` (2026-04-23)

Installe `rectangle-packer@1.0.4` + ajoute l'onglet "Plan de coupe 2" + produit le benchmark comparatif.

**Commits** : voir `git log --oneline multi-bin..coupe`.

**Évidence chiffrée** : `runs/2026-04-23-coupe/RESULT.md` (+ 10 SVG dans `artifacts/`).

**Verdict empirique** :
- Les 5 presets A-E tiennent tous sur 1 seul panneau (1220×2440 mm par défaut).
- Dans ce cas single-panel, les 2 algorithmes convergent au même résultat (même occupation, même gaspillage).
- `shelf-packing` est ~5× plus rapide que `rectangle-packer` sur les 5 presets.
- **Recommandation** : garder `shelf-packing` (plus simple, zéro dépendance externe). `rectangle-packer` pourrait gagner sur des configurations multi-bin plus agressives (petit panneau forçant la répartition), mais pas testé ici.

**Décision finale (2026-04-23)** : shelf-packing gagne empiriquement en test manuel avec panneaux plus petits (multi-bin forcé) — rectangle-packer ne peut pas utiliser la rotation dans notre wrapper, ce qui lui fait perdre en densité. Suppression complète du code rectangle-packer via branche `cleanup-cut-plan` (mergée après `coupe`).

---

## Branche `cleanup-cut-plan` (2026-04-23)

Suppression complète de `rectangle-packer` du codebase après verdict "shelf gagne" (voir `runs/2026-04-23-coupe/RESULT.md`).

**Supprimé** :
- `packages/nichoir-core/src/cut-plan-rectpack.ts` + tests
- `packages/nichoir-ui/src/components/tabs/PlanTab2.tsx` + `PlanCanvasSection2.tsx` + tests
- `TabKey 'plan2'` dans core types + CONTRACTS.md
- `'tab.plan2'` i18n (fr+en) + entrée Sidebar TAB_ORDER
- `rectangle-packer` dans `@nichoir/core/package.json`
- `scripts/benchmark-cut-plan.ts` + script root `benchmark:cut-plan`
- Doc `computeCutLayoutRectpack` dans CONTRACTS.md

**Conservé** : `runs/2026-04-23-coupe/*` (evidence historique).
