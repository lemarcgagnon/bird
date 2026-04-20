# RESULT — OrbitControls (rotate/pan/zoom souris)

**Status** : ✅ COMPLÉTÉ
**Date** : 2026-04-19
**Tests** : 441/441 verts (+3 nouveaux)
**Bundle** : 185 → 190 kB (+5 kB pour OrbitControls addon)

---

## Evidence Document

### Problème

Le canvas 3D de `/tools/nichoir` était "read-only" côté interaction — l'utilisateur ne pouvait ni tourner, ni zoomer, ni panner la vue. La slice `state.camera` existait mais aucun contrôle UI programmatique n'était câblé, et aucun control souris n'était attaché au canvas.

### Matériaux examinés (lectures intégrales)

- `packages/nichoir-ui/src/viewports/ImperativeThreeViewport.ts` (295 lignes, intégral)
- `packages/nichoir-ui/VIEWPORT.md` (175 lignes, intégral) — contrat V1-V7
- `packages/nichoir-ui/src/components/tabs/VueTab.tsx` (21 lignes, intégral) — confirmer absence de mutations caméra programmatiques
- `packages/nichoir-ui/tests/ImperativeThreeViewport.test.ts` (mock WebGLRenderer + ResizeObserver stub, pattern hoisté)
- `node_modules/.pnpm/three@0.160.1/node_modules/three/examples/jsm/controls/OrbitControls.js` — disponibilité du addon

### Cause racine

**Observation directe** : le constructeur `ImperativeThreeViewport` ne créait pas de contrôles interactifs. VIEWPORT.md:172 précisait "Pattern de gestion des controls... interne à l'implémentation" — donc la fonctionnalité était déléguée à l'implémentation, pas au contrat, et restait à câbler.

### Résolution appliquée

**Fichier unique modifié** : `packages/nichoir-ui/src/viewports/ImperativeThreeViewport.ts`

1. **Import** : `import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'`.

2. **Field** : `private controls: OrbitControls | null = null`.

3. **`mount()`** : après la première `update(initialState)`, instancie `new OrbitControls(this.camera, this.canvas)`, active rotate/pan/zoom, désactive damping (pas de tick loop nécessaire), et synchronise `controls.target` avec `this.lookTarget`.

4. **`update(state)`** — changement critique : la ligne `this.updateCameraFromState(state)` qui s'exécutait inconditionnellement est maintenant gardée par :
   ```ts
   const cameraChanged = !this.lastState || this.lastState.camera !== state.camera;
   if (cameraChanged) {
     this.updateCameraFromState(state);
     if (this.controls && this.lookTarget) {
       this.controls.target.copy(this.lookTarget);
     }
   }
   ```
   → le canvas conserve la position caméra interactive lorsque des sliders non-caméra (W, H, door, etc.) mutent le state. Zustand garantit une nouvelle référence sur `state.camera` uniquement sur `setState({ camera: ... })` explicite — donc la garde est fiable.

5. **`unmount()`** : `this.controls.dispose()` retire les listeners pointer attachés au canvas (respecte V3).

### Architecture : pas de push OrbitControls → store

**Décision clé** : les événements `'change'` d'OrbitControls ne sont **pas** propagés vers le store. Conséquences :
- Pas de boucle feedback store ↔ canvas.
- `state.camera` devient l'état **initial** (source de vérité au mount), pas un suivi continu.
- `readCameraState()` continue de refléter la vraie caméra (camera.position + lookTarget), utile si un consumer futur veut persister l'état post-mount.
- Les mutations programmatiques explicites (ex: futur bouton "Reset camera" via `setState({camera: ...})`) continuent de fonctionner — la garde détecte le changement de référence et ré-applique.

### Validation matérielle

| Check | Command / Evidence | Résultat |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | 4/4 Done |
| Tests | `pnpm -r test` | 441 passed (+3 OrbitControls) |
| Lint | `pnpm -r lint` | 4/4 Done |
| Build | `pnpm -C apps/demo build` | vert, `/tools/nichoir 190 kB` (+5 kB pour addon) |
| Drag souris → rotation | puppeteer `mouse.down` + `mouse.move` + `mouse.up` | `orbit-01-after-drag-right.png` montre la maison tournée (azimuth) |
| Drag vertical | idem axe vertical | `orbit-02-after-drag-up.png` angle polaire modifié |
| Wheel zoom | `page.mouse.wheel({deltaY:-200})` | `orbit-03-after-zoom.png` maison très rapprochée |
| **Préservation caméra sur UI change** | Click radio `Ronde` après drag+zoom | `orbit-04-after-setParam.png` : même angle zoomé que orbit-03 **+** trou de porte rond visible sur la façade. La caméra interactive est **préservée**. |

### Incertitude résiduelle

1. **Pan via clic-droit** (button 2 dans OrbitControls) : supporté par OrbitControls par défaut, non explicitement testé (le diag puppeteer utilise bouton gauche uniquement). Devrait fonctionner.

2. **Touch events** (mobile / tablette) : OrbitControls gère les touch natifs. Non testé dans ce diag (puppeteer simule souris). Fonctionnel attendu sans code spécifique.

3. **Reset caméra programmatique** : non présent dans la UI. Si ajouté via `setState({ camera: ... })`, le code de garde `lastState.camera !== state.camera` déclenche la ré-application. Testé par le test unit #3 "update() avec camera ref changée".

### Critères d'acceptance — status

- [x] `OrbitControls(camera, canvas)` instancié dans `mount()`
- [x] `enableRotate/Pan/Zoom=true`, `enableDamping=false`
- [x] `controls.dispose()` dans `unmount()`
- [x] `controls.target` synchronisé avec `this.lookTarget`
- [x] `update(state)` conditional — évite d'écraser la rotation souris
- [x] 3 tests unit (mount/unmount, update sans changement camera, update avec changement camera)
- [x] Typecheck + test + lint + build verts
- [x] Passe matérielle puppeteer (5 screenshots, 4 interactions validées)

## Artefacts promus

| Path | Description |
|---|---|
| `artifacts/orbit-00-initial.png` | Vue initiale (perspective par défaut, haut de la maison) |
| `artifacts/orbit-01-after-drag-right.png` | Après drag horizontal +200px : maison tournée (azimuth modifié) |
| `artifacts/orbit-02-after-drag-up.png` | Après drag vertical -100px : angle polaire modifié |
| `artifacts/orbit-03-after-zoom.png` | Après wheel -200 : maison beaucoup plus proche |
| `artifacts/orbit-04-after-setParam.png` | Après click "Ronde" : trou de porte visible **+** caméra interactive **préservée** |
