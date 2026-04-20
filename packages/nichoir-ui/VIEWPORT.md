# `@nichoir/ui` — ViewportAdapter contract

> **Source d'autorité pour l'abstraction de rendu 3D entre la couche React et le moteur graphique (Three.js impératif pour P2, R3F déférable en Pn).**
>
> Toute modification de ce document doit précéder l'ajout d'une nouvelle implémentation ou une évolution de signature.

**Version du contrat** : 0.1.0 (figée pour P2)
**Statut** : signé-off par codex 2026-04-17. Implémentation livrée dans `ImperativeThreeViewport.ts` (class TS pure, pas de JSX → extension `.ts`).

---

## Intent

Isoler le code React (hooks, composants, store) du moteur graphique concret. La même interface `ViewportAdapter` doit permettre :
1. **P2** : une implémentation `ImperativeThreeViewport` qui wrappe Three.js impératif dans un cycle de vie React (`useEffect` mount/unmount, update sur changement de state).
2. **Pn conditionnel** : une implémentation alternative `R3FViewport` qui utilise react-three-fiber sans toucher au reste de `nichoir-ui`. Le swap est un remplacement de module, pas une réécriture des composants.

---

## Invariants

**V1 — Pas de leak React dans l'adapter.** L'interface ne référence ni JSX, ni `ReactElement`, ni hooks. Elle est consommable par du code non-React (tests purs, benchmarks).

**V2 — Pas de leak moteur graphique dans la UI.** Les composants React qui consomment un `ViewportAdapter` ne doivent pas importer `three` directement pour mettre à jour la scène. Toute mutation passe par `update(state)`.

**V3 — Ownership DOM explicite.** L'adapter reçoit un `HTMLElement` via `mount()`. Il attache son canvas comme enfant. Il ne touche pas au parent, ne modifie pas ses styles, ne s'abonne pas à des events globaux sans les nettoyer à `unmount()`.

**V4 — Cycle de vie déterministe.** `mount()` → N × `update()` → `unmount()`. Appeler `update()` avant `mount()` ou après `unmount()` est une erreur de l'appelant (throw).

**V5 — Pas d'état partagé entre instances.** Deux viewports montés côte à côte sur le même document produisent deux scènes indépendantes (pas de singleton Three.js).

**V6 — Idempotence de `unmount`.** Appeler `unmount()` deux fois est un no-op (pas de throw, pas d'erreur de ressource déjà libérée).

**V7 — Resize interne à l'adapter.** L'adapter est **responsable de détecter les changements de taille de son host element** et d'y répondre (update de `camera.aspect`, `camera.updateProjectionMatrix()`, `renderer.setSize()`). La UI React ne propage PAS les changements de taille manuellement.

Implémentation recommandée : `ResizeObserver` sur le host element attaché dans `mount()`, disconnect dans `unmount()`.
- `ResizeObserver` est préféré à `window.addEventListener('resize')` car il capte aussi les resize non-liés à la window (collapse sidebar, tab change, responsive grid, etc.).
- `window` resize listener acceptable en fallback si ResizeObserver indisponible, à condition d'être cleanup par `unmount()`.

**Aucune listener global ne doit survivre un `unmount()`.** L'adapter est propre à son cycle de vie.

**Hors du contrat** : le *debounce* ou *throttle* du resize est laissé à l'implémentation (v15 n'en avait pas ; P2 peut en ajouter sans changer la signature).

---

## Interface TypeScript

```ts
import type { NichoirState } from '@nichoir/core';

export interface ViewportAdapter {
  /**
   * Attache l'adapter à l'élément DOM fourni et initialise la scène 3D.
   * L'adapter crée son propre <canvas> comme enfant de `el`.
   *
   * @throws si `el` est déjà hôte d'un autre ViewportAdapter actif
   * @throws si `mount()` est appelé deux fois sans `unmount()` intermédiaire
   */
  mount(el: HTMLElement, initialState: NichoirState): void;

  /**
   * Met à jour la scène pour refléter le nouveau state.
   * L'implémentation décide de son granularité (rebuild complet ou patch).
   * Pour P2 (Three.js impératif), un rebuild complet de `panelGroup` est attendu.
   *
   * @throws si l'adapter n'est pas dans l'état "monté"
   */
  update(state: NichoirState): void;

  /**
   * Détache l'adapter : libère les ressources Three.js (geometries, materials,
   * renderer), retire le canvas du DOM, désabonne tous les events.
   *
   * Idempotent : appel en l'absence de mount préalable = no-op silencieux.
   */
  unmount(): void;

  /**
   * Retourne un snapshot de l'état de la caméra courante (pour persistance
   * du zoom/rotation lors d'un rerender React parent).
   *
   * @throws si l'adapter n'est pas monté
   */
  readCameraState(): NichoirState['camera'];
}
```

---

## Contrat d'usage côté React

**Pattern canonique** :

```tsx
import { useEffect, useRef } from 'react';
import { ImperativeThreeViewport } from './viewports/ImperativeThreeViewport';
import { useStore } from '../store';

function Viewport() {
  const hostRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<ViewportAdapter | null>(null);
  const state = useStore(s => s);

  // Mount / unmount
  useEffect(() => {
    if (!hostRef.current) return;
    const adapter = new ImperativeThreeViewport();
    adapter.mount(hostRef.current, state);
    adapterRef.current = adapter;
    return () => {
      adapter.unmount();
      adapterRef.current = null;
    };
  }, []); // empty deps : mount once

  // Update
  useEffect(() => {
    adapterRef.current?.update(state);
  }, [state]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
}
```

**Contre-exemples interdits** :
- Recréer l'adapter à chaque rerender (perf, clignotement)
- Appeler `mount()` dans le corps du composant (hors `useEffect`)
- Oublier `unmount()` dans le cleanup (leak Three.js + canvas orphelins)
- Mettre `state` dans les deps du premier `useEffect` (remount à chaque changement)

---

## Implémentations prévues

### `ImperativeThreeViewport` (P2)

- Wrappe la logique de `src/three-scene.js` + `src/geometry/panels.materializeDefs` (v15 monolithique, à porter).
- Rebuild complet du `panelGroup` à chaque `update(state)` via `buildPanelDefs(state)` → `materializeDefs(group, buildResult, mode, clipPlanes)`.
- Expose `readCameraState()` en lisant `camera.position` + inverse mapping vers `{theta, phi, dist, tx, ty, tz}`.
- **Resize** : `ResizeObserver` attaché au host element dans `mount()`, disconnect dans `unmount()`. Chaque callback :
  - lit `el.clientWidth` / `el.clientHeight`
  - met à jour `camera.aspect` + `camera.updateProjectionMatrix()`
  - appelle `renderer.setSize(w, h, false)` — le 3e argument `updateStyle: boolean = false` empêche Three.js de modifier `canvas.style.width/height` (respecte V3 : l'adapter ne doit pas écrire dans les styles DOM en dehors du canvas interne). Signature exacte : `WebGLRenderer.setSize(width, height, updateStyle?)`.
- Lives dans `packages/nichoir-ui/src/viewports/ImperativeThreeViewport.ts` (extension `.ts` car class TS pure, pas de JSX).

**Non-goal P2** : optimisation incrémentale (diff granulaire des panels). Le rebuild complet est performant à l'échelle du nichoir (~10 meshes, <5ms).

### `R3FViewport` (Pn conditionnel)

Remplacement futur potentiel. Ne sera envisagé que si :
- Un besoin perf mesuré justifie l'incrémentalité native de R3F, OU
- Le SaaS hôte utilise déjà R3F ailleurs (uniformité stack).

Même interface `ViewportAdapter`, changement de moteur invisible côté consumers.

---

## Checklist de validation (pour code-reviewer avant fermeture P2 entry)

- [ ] `VIEWPORT.md` validé par orchestrateur **ET** codex (revue externe)
- [ ] Signature TS strictement conforme au contrat ci-dessus
- [ ] Aucune référence React / JSX dans l'interface
- [ ] Aucune référence à Three.js dans l'interface (types `NichoirState` uniquement)
- [ ] Les invariants V1–V7 sont vérifiés par au moins un test unitaire chacun une fois l'implémentation écrite (V7 : stub ResizeObserver en jsdom + assert disconnect au unmount)
- [ ] La doc d'usage React est claire sur le placement des appels (useEffect deps, cleanup)
- [ ] Aucun `window.addEventListener('resize')` qui survit à `unmount()` (V7)

---

## Non-goals (hors VIEWPORT.md)

- Pattern de gestion des controls (OrbitControls, pan/zoom) — interne à l'implémentation
- Stratégie de clipping planes — interne (l'adapter lit `state.clip` et applique)
- Export STL/ZIP/SVG — fourni par `@nichoir/core`, consommé par UI via bouton, pas via ViewportAdapter
- Rendering de décos en temps réel — interne à l'implémentation (rebuild via buildPanelDefs)
