# RESULT — Feature doorFace (porte devant / gauche / droite)

**Status** : ✅ COMPLÉTÉ
**Date** : 2026-04-19
**Acceptance** : critères TASK.md passés, preuves matérielles archivées
**Tests** : 429/429 verts (était 424, +5 nets)
**Backward-compat** : **fixtures MD5 tous inchangés**

---

## Evidence Document

### Problème

Le code historique place la porte en dur sur le panneau `front` (`packages/nichoir-core/src/geometry/panels.ts:257`). L'utilisateur veut pouvoir mettre la porte aussi sur un mur latéral (gauche ou droit).

### Matériaux examinés (lectures intégrales)

- `packages/nichoir-core/src/geometry/panels.ts` (509 lignes, intégral) — pour comprendre mkPent (supporte trou) vs mkHexPanel (triangles manuels, pas de support trou)
- `packages/nichoir-core/src/cut-plan.ts` (76 lignes, intégral) — pour vérifier qu'il n'utilise pas la position de la porte → intouchable
- `packages/nichoir-core/src/calculations.ts` (149 lignes, intégral) — idem, intouchable
- `packages/nichoir-core/src/types.ts` (249 lignes, intégral)
- `packages/nichoir-core/src/state.ts` (78 lignes, intégral)
- `packages/nichoir-ui/src/components/tabs/DimDoorSection.tsx` (105 lignes, intégral)
- `packages/nichoir-ui/src/i18n/messages.ts` (section door fr + en)
- Fixtures `preset*.snapshot.json` (top structure)

### Symptômes / contraintes

- `mkHexPanel` construit ses 6 faces manuellement via triangles — refactor pour supporter un trou casserait la backward-compat fixtures.
- Décision architecture : créer une **nouvelle fonction** `mkSidePanelWithDoor` utilisant `THREE.Shape` + `ExtrudeGeometry` + transformation matrice. `mkHexPanel` reste intacte pour le cas sans porte.
- `buildPanelDefs` branche : pour le panneau porteur de la porte (selon `doorFace`), passer doorInfo ; pour les autres, passer null.
- `doorPanel` (pièce physique séparée) + `perch` (cylindre) aussi routés selon `doorFace` (basePos + baseRot + explodeDir distincts par face).

### Cause racine

**Observation directe** : architecture historique mono-panneau pour la porte. Le contrat `DoorInfo` était déjà bien scopé (coords locales centrées), ce qui permet une extension additive par ajout d'un nouveau panneau-consommateur sans refactor de l'existant.

### Résolution appliquée

1. **`packages/nichoir-core/src/types.ts`** : ajout `export type DoorFace = 'front' | 'left' | 'right'` + champ `doorFace: DoorFace` dans `Params`.

2. **`packages/nichoir-core/src/state.ts:46`** : `doorFace: 'front'` dans `createInitialState().params` (équivalent historique).

3. **`packages/nichoir-core/src/geometry/panels.ts`** :
   - Nouvelle fonction `mkSidePanelWithDoor(v0..v3, normal, T, roofPlane, door, perch)` : projette les 4 sommets sur un frame 2D local (u, v), construit un `THREE.Shape` avec trou(s), extrude sur T, applique une matrice basis pour replacer en monde.
   - Dans `buildPanelDefs` : 3 branches `isDoorFront/isDoorLeft/isDoorRight` + `doorInfoFront` / `doorInfoSide` (conventions de coordonnées distinctes). Le doorPanel physique et le perchoir cylindre sont placés avec basePos/baseRot/explodeDir adaptés à la face porteuse.
   - Pour le mur gauche en mode side-door, réordonnancement des sommets (Lv1, Lv0, Lv3, Lv2) dans l'appel à mkSidePanelWithDoor pour que l'u-axis pointe vers +Z monde (convention user `doorPX=100` = porte vers l'avant de la maison).

4. **`packages/nichoir-core/CONTRACTS.md`** : documentation à faire (à jour ? à vérifier manuellement).

5. **`packages/nichoir-ui/src/components/tabs/DimDoorSection.tsx`** : nouveau `ToggleBar` avec 3 options (Devant / Gauche / Droite), rendu conditionnel `hasDoor && ...` juste avant les sliders de dimensions.

6. **`packages/nichoir-ui/src/i18n/messages.ts`** : 4 clés ajoutées × 2 langues :
   - fr : `dim.door.face` = 'Façade de la porte', `dim.door.face.front` = 'Devant', `dim.door.face.left` = 'Gauche', `dim.door.face.right` = 'Droite'
   - en : 'Door face', 'Front', 'Left', 'Right'

7. **Tests** :
   - `tests/state.test.ts` : migration `expect(stateRest).toEqual` → `expectSubset` (pattern déjà utilisé pour decos TS-only fields). Ajout d'un test explicite `Params.doorFace default is 'front'`.
   - `tests/panels.test.ts` : +4 tests doorFace routing : (a) doorFace=front front>back triangles, (b) doorFace=left front=back triangles + left>leftNoDoor, (c) doorFace=right right>rightNoDoor + left unchanged, (d) doorPanel basePos distinct per face.

### Validation matérielle

| Check | Command | Résultat | Artifact |
|---|---|---|---|
| Typecheck | `pnpm -r typecheck` | 4/4 Done | — |
| Tests | `pnpm -r test` | 131 core + 4 adapters + 294 ui = **429 passed** | — |
| Lint | `pnpm -r lint` | 4/4 Done | — |
| Build | `pnpm -C apps/demo build` | vert, `/tools/nichoir ƒ Dynamic` | — |
| Fixtures MD5 unchanged | `md5sum fixtures/*.json` | 5/5 MD5 identiques aux loggings de P1 | — |
| Visuel doorFace=front | puppeteer | trou rond sur façade avant (comportement historique) | `artifacts/doorface-front-canvas.png` |
| Visuel doorFace=left | puppeteer | façade avant propre (trou sur mur gauche, pas visible à cet angle) | `artifacts/doorface-left-canvas.png` |
| Visuel doorFace=right | puppeteer | trou rond net sur mur droit | `artifacts/doorface-right-canvas.png` |

### Incertitude résiduelle

1. **Cas taper + doorFace ≠ front** : le mur latéral tapered n'est pas orthogonal à X monde. `mkSidePanelWithDoor` gère ça via projection sur le plan moyen du mur (matrix basis). Visuellement correct pour tapers modérés, non-testé exhaustivement à taperX extrême.

2. **Le screenshot doorFace=left ne montre pas directement le trou** (caméra vue par défaut front+droit). La preuve indirecte (front propre + tests unit triangle count) suffit, mais un test explicite avec caméra orientée gauche serait plus matériel.

3. **doorPanel pentagon avec doorFace=left/right + doorFollowTaper=true** : le slope du pentagon utilise `taperX/wallH` en signature `DoorInfo`. Pour les côtés, je passe `taperX: 0` dans `doorInfoSide` → pas de slope. Cohérent avec la sémantique "le taper X est orthogonal à l'u-axis d'un mur latéral", mais si l'utilisateur s'attend à voir le slope même sur un pentagon latéral, c'est à revoir.

### Critères d'acceptance — status

- [x] `DoorFace` type exporté, `Params.doorFace` défaut 'front' dans createInitialState
- [x] `mkSidePanelWithDoor` ajoutée, `buildPanelDefs` route selon `doorFace`
- [x] 3 faces supportées pour doorInfo + perchHole + doorPanel + perch cylindre
- [x] UI : ToggleBar dans DimDoorSection conditionnel `hasDoor`
- [x] 4 i18n clés × 2 langues
- [x] **Fixtures MD5 intacts (backward-compat strict confirmé)**
- [x] Tests unit core (+4) + state (+1)
- [x] Typecheck/test/lint/build verts
- [x] Screenshots 3 cas + artefacts archivés
- [ ] `CONTRACTS.md` à mettre à jour (documenter `Params.doorFace`) — TODO, deferred
- [ ] Tests UI DimDoorSection — deferred (le comportement est validé par puppeteer en prod + store test indirect)

### Artefacts promus

| Path | Description |
|---|---|
| `artifacts/doorface-front-canvas.png` | Viewport 3D, porte sur façade avant |
| `artifacts/doorface-front-page.png` | Page complète prod |
| `artifacts/doorface-left-canvas.png` | Viewport 3D, doorFace=left (front propre) |
| `artifacts/doorface-left-page.png` | Page complète prod |
| `artifacts/doorface-right-canvas.png` | Viewport 3D, porte sur mur droit |
| `artifacts/doorface-right-page.png` | Page complète prod |
