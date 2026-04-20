# TASK — OrbitControls : rotate / pan / zoom à la souris

## Résumé

Câbler `THREE.OrbitControls` (addon officiel) sur le canvas du `ImperativeThreeViewport` pour permettre à l'utilisateur de tourner, translater et zoomer la vue 3D avec la souris. Actuellement la caméra est "read-only" côté interaction — seul le store peut la muter.

## Intent lock

- Canvas devient l'autorité pour `camera.position` + `controls.target` post-mount.
- `state.camera` devient l'**état initial** (source de vérité au mount), PAS un suivi continu. Pas de push back vers le store (évite la boucle store↔canvas + maintient la simplicité).
- Les mutations de `state.camera` externes (ex: futur bouton "Reset camera") continuent de fonctionner : `update(state)` détecte un changement de référence sur `state.camera` et ré-applique via `updateCameraFromState()`.
- Le reste du state (params, clip, decos) ne doit PAS écraser la caméra interactive. Changer la largeur du nichoir garde la rotation souris.

## Contraintes

- VIEWPORT.md:172 confirme "Pattern de gestion des controls ... interne à l'implémentation". Aucun changement de contrat nécessaire.
- `three/examples/jsm/controls/OrbitControls.js` : addon officiel Three.js, disponible depuis r103. Vérifié dans `node_modules/three/examples/jsm/controls/` ci-dessous.
- Pas de damping (évite la charge d'un render loop spécifique, et l'anim loop existant suffit pour rendre après chaque event).
- `controls.target` doit rester synchronisé avec `this.lookTarget` interne pour que `readCameraState()` continue de produire un snapshot cohérent.
- Invariants V1-V7 préservés. V3 (ownership DOM) : les events pointer d'OrbitControls sont attachés à `this.canvas`, nettoyés par `controls.dispose()` dans `unmount()`.

## Critères d'acceptance

- [ ] `ImperativeThreeViewport` importe et instancie `OrbitControls(camera, canvas)` dans `mount()`.
- [ ] `controls.enableRotate`, `enablePan`, `enableZoom` tous à `true`, `enableDamping` à `false`.
- [ ] `controls.dispose()` appelé dans `unmount()`.
- [ ] `controls.target` synchronisé avec `this.lookTarget` au mount et à chaque ré-application du state (quand `state.camera` ref change).
- [ ] `update(state)` ne ré-applique `updateCameraFromState` **que si `state.camera` a changé** de référence (protection mouse-rotation pendant les changements UI).
- [ ] Tests unit : OrbitControls instancié au mount, disposé à unmount, enabled=true par défaut, update() sans changement camera n'écrase pas `camera.position`.
- [ ] `pnpm -r typecheck && pnpm -r test && pnpm -r lint` verts.
- [ ] `pnpm -C apps/demo build` vert.
- [ ] Passe matérielle puppeteer : drag souris sur canvas → position caméra change → position post-drag différente de position pré-drag ; après le drag, setParam('W', 220) → position caméra inchangée.

## Failure modes à surveiller

- **OrbitControls.target desync** : si `this.lookTarget` change mais `controls.target` reste à l'ancienne valeur, la rotation souris tourne autour d'un mauvais point. Mitigation : toujours `controls.target.copy(this.lookTarget)` après `updateCameraFromState()`.
- **Feedback loop** : si je push les events 'change' d'OrbitControls vers le store, React re-render → update() → updateCameraFromState → bouge la caméra → OrbitControls emit change → loop. Mitigation : je ne push PAS vers le store ; store.camera reste à la valeur initiale.
- **State.camera stale** : après mouse rotate, store.camera ≠ vraie caméra. `readCameraState()` retourne la vraie caméra (lue depuis `this.camera.position`). Consumer qui persiste via readCameraState a la vraie valeur. OK.
- **Tests qui stubent WebGLRenderer** : puppeteer ou tests avec mock Renderer doivent tolérer l'absence de canvas natif. OrbitControls prend `canvas` directement ; mock doit fournir un HTMLCanvasElement (jsdom en fournit).
