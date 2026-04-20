// src/viewports/ViewportAdapter.ts
//
// Interface canonique de l'abstraction de rendu 3D, définie dans VIEWPORT.md.
// Ce fichier est le reflet TS exact du contrat. Toute évolution passe par diff
// sur VIEWPORT.md avant modification ici.
//
// Invariants (voir VIEWPORT.md §"Invariants" V1-V7) :
//   V1. Pas de leak React dans l'interface
//   V2. Pas de leak moteur graphique (Three.js) dans l'interface
//   V3. Ownership DOM explicite — l'adapter ne touche qu'à son canvas enfant
//   V4. Cycle de vie déterministe mount → N×update → unmount
//   V5. Pas d'état partagé entre instances
//   V6. Idempotence de unmount() — appel multiple = no-op
//   V7. Resize interne à l'adapter (ResizeObserver recommandé)

import type { NichoirState } from '@nichoir/core';

export interface ViewportAdapter {
  /**
   * Attache l'adapter à `el` et initialise la scène 3D.
   * Crée un `<canvas>` enfant de `el`.
   *
   * @throws si `el` est déjà hôte d'un autre adapter actif (impl-defined check)
   * @throws si appelé deux fois sans unmount() intermédiaire
   */
  mount(el: HTMLElement, initialState: NichoirState): void;

  /**
   * Met à jour la scène pour refléter `state`.
   * Pour P2, un rebuild complet du panelGroup est attendu.
   *
   * @throws si l'adapter n'est pas monté
   */
  update(state: NichoirState): void;

  /**
   * Détache l'adapter : dispose geometries/materials/renderer, retire le canvas,
   * désabonne observers et events. Idempotent.
   */
  unmount(): void;

  /**
   * Snapshot caméra pour persistance lors d'un remount React parent.
   *
   * @throws si l'adapter n'est pas monté
   */
  readCameraState(): NichoirState['camera'];
}
