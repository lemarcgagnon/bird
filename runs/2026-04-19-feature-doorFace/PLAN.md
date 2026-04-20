# PLAN — doorFace feature

## 🎯 Intent lock

Ajouter `params.doorFace: 'front' | 'left' | 'right'` (default 'front'), router door + perch + doorPanel selon la valeur dans `buildPanelDefs`, étendre `mkHexPanel` pour accepter un trou. Backward-compat strict sur MD5 fixtures.

## 📁 Files affected

### Modification core
| Fichier | Changement |
|---|---|
| `packages/nichoir-core/src/types.ts` | Add `export type DoorFace`, add `doorFace: DoorFace` in `Params` |
| `packages/nichoir-core/src/state.ts` | Add `doorFace: 'front'` in createInitialState.params |
| `packages/nichoir-core/src/geometry/panels.ts` | Extend `mkHexPanel(... door?, perch?)` signature. In `buildPanelDefs`, route doorInfo + perchHoleInfo + doorPanel placement + perch cylinder placement selon `params.doorFace`. |
| `packages/nichoir-core/CONTRACTS.md` | Document `DoorFace` + `Params.doorFace` |

### Modification UI
| Fichier | Changement |
|---|---|
| `packages/nichoir-ui/src/components/tabs/DimDoorSection.tsx` | Add ToggleBar for doorFace, rendered when door !== 'none', ABOVE the width/height sliders |
| `packages/nichoir-ui/src/i18n/messages.ts` | 4 new keys fr + 4 en : `dim.door.face`, `dim.door.face.front`, `dim.door.face.left`, `dim.door.face.right` |

### Modification tests
| Fichier | Changement |
|---|---|
| `packages/nichoir-core/tests/panels.test.ts` | Add tests : mkHexPanel-with-door produces hole geometry ; buildPanelDefs routes door to correct panel for 3 doorFace values |
| `packages/nichoir-core/tests/exporters.test.ts` | Add test : STL of a preset with doorFace='left' has trianglesCount different from doorFace='front' (door hole moved) — or at least different byteLength |
| `packages/nichoir-ui/tests/DimTab.test.tsx` OR new `DimDoorSection.test.tsx` | Test toggle shown when door !== 'none' + click changes doorFace |

### Fichiers intouchés (verified by reasoning)
- `cut-plan.ts` : N'utilise que les dimensions rectangulaires du panneau pour la feuille de découpe, pas le trou de porte (lecture lignes 233+ de panels.ts montre que computeCutLayout retourne des `LayoutPiece` avec `{w, h, shape}` et pas de hole info). Le SVG export représente les silhouettes des pièces ; le trou n'apparaît pas. **À vérifier par lecture** avant d'affirmer.
- `calculations.ts` : calcul de volume/surface, pas impacté par position de porte.
- Fixtures `preset*.snapshot.json` : inchangées car capture utilise `buildPanelDefs(state)` avec state initial (doorFace='front' par défaut) → output identique.

## ⚠️ Risk areas

1. **mkHexPanel refactor** : actuellement build manuel de triangles. Ajouter support trou nécessite switch à ExtrudeGeometry quand door != null. Le rendu 3D doit être **visuellement identique** au manuel quand door == null. Risque de subtile diff dans les vertex counts → casse STL byte tests.
   - Mitigation : garder la branche "triangle manuel" intacte pour door == null. Ajouter branch ExtrudeGeometry + projection pour door != null.

2. **Extrude + projection 3D** : ExtrudeGeometry produit une geometry centrée en (0,0,0) le long de Z. Pour un mur gauche, il faut :
   - Build shape 2D en coordonnées locales (y, z en mondial devient y, z locaux)
   - Extruder sur T
   - Translater + rotater pour placer en monde à la position du mur
   - Flip normal si nécessaire (le trou doit s'ouvrir VERS L'EXTÉRIEUR de la maison)

3. **Taper + side door** : le mur taperé n'est pas orthogonal à l'axe X. Le Shape 2D doit être dans le plan du mur (incliné). Approche : transform en 2D via projection sur le plan moyen du mur, extruder, puis re-projeter.

4. **Fixtures regression** : si mes changements à `mkHexPanel` affectent même minimalement le output pour door==null (ex: attribute ordering), les MD5 cassent. **Impératif** : tests avant impl, ET re-run `node capture-reference.mjs x2` pour confirmer idempotence après impl.

## 🧪 Tests de qualité (TDD — écrire AVANT code)

### Test 1 : `types.ts` → `DoorFace` type exported
Compile-time check : `import type { DoorFace } from '@nichoir/core'` ne casse pas. (Effectif : typecheck vert.)

### Test 2 : `state.test.ts` — createInitialState retourne doorFace='front'
```ts
expect(createInitialState().params.doorFace).toBe('front');
```

### Test 3 : `panels.test.ts` — buildPanelDefs, doorFace='front' (default) → front a le trou, left/right pleins
```ts
const s = createInitialState();
s.params.door = 'round';
s.params.doorFace = 'front';
const { defs } = buildPanelDefs(s);
const front = defs.find(d => d.key === 'front');
const left = defs.find(d => d.key === 'left');
// front geometry has hole (position count > plain case), left doesn't
// Approach : run twice, once with door='none', once with door='round'. Compare front vertex counts.
```

### Test 4 : `panels.test.ts` — doorFace='left' → left a le trou, front est plein
```ts
s.params.doorFace = 'left';
const { defs } = buildPanelDefs(s);
const front = defs.find(d => d.key === 'front');
const left = defs.find(d => d.key === 'left');
// front matches the 'door=none' fresh build
// left has more/different vertices (extra hole)
```

### Test 5 : `panels.test.ts` — doorFace='right' → right a le trou, front plein

### Test 6 : `panels.test.ts` — doorFace='left', doorPanel=true → pièce doorPanel présente, orientée côté gauche
Vérifie que `defs.find(d => d.key === 'doorPanel')` existe, et que sa basePos + baseRot sont différentes de doorFace='front'.

### Test 7 : `panels.test.ts` — fixtures backward-compat (CRITIQUE)
Re-run buildPanelDefs contre un état issu de preset A (defaults) → MD5 du snapshot dev1 est identique au MD5 original (`b0081bb3209d57d3a5b702d9b095ef7c`). Si non : regression, STOP.

### Test 8 : `exporters.test.ts` — STL byteLength/triangles différent selon doorFace
Preset A avec doorFace='left' a un STL différent de preset A avec doorFace='front'.

### Test 9 : `DimDoorSection.test.tsx` — toggle visible quand door !== 'none'
```tsx
loadParams({ door: 'round' });
render(<DimDoorSection />);
expect(getByText('▸ FAÇADE DE LA PORTE')).toBeDefined();  // or similar label
expect(getAllByRole('radio')).toHaveLength(3);
```

### Test 10 : `DimDoorSection.test.tsx` — toggle unmount quand door='none'
```tsx
loadParams({ door: 'none' });
const { queryByText } = render(<DimDoorSection />);
expect(queryByText('▸ FAÇADE DE LA PORTE')).toBeNull();
```

### Test 11 : `DimDoorSection.test.tsx` — click option change params.doorFace
```tsx
loadParams({ door: 'round', doorFace: 'front' });
render(<DimDoorSection />);
act(() => fireEvent.click(getByText(/gauche/i).closest('button')));
expect(store.getState().params.doorFace).toBe('left');
```

### Test 12 (MATERIAL) : passe navigateur
Puppeteer ad-hoc : charge la page, change door, change doorFace, screenshot pour chaque combinaison. Vérifier visuellement les trous dans les bons panneaux.

## ✅ Checklist de réalisation

1. [ ] **READ** fichiers à toucher (cut-plan.ts + calculations.ts) pour confirmer qu'ils sont intouchés.
2. [ ] **TYPES** : ajouter `DoorFace` dans types.ts, `doorFace` dans `Params`.
3. [ ] **STATE** : initial value 'front' dans createInitialState.
4. [ ] **TESTS RED** : écrire panels.test (3-8), DimDoorSection.test (9-11).
5. [ ] **IMPL mkHexPanel** : étendre signature, branche ExtrudeGeometry pour door!=null.
6. [ ] **IMPL buildPanelDefs** : router doorInfo/perchHoleInfo/doorPanel/perch selon doorFace.
7. [ ] **IMPL UI** : ToggleBar dans DimDoorSection, 4 i18n keys ajoutées fr+en.
8. [ ] **VERIFY backward-compat** : pnpm -C packages/nichoir-core test (fixtures MD5 intactes). Si MD5 drift → STOP, diagnose, avant de continuer.
9. [ ] **TYPECHECK+TEST+LINT** : pnpm -r verts.
10. [ ] **BUILD** : pnpm -C apps/demo build vert.
11. [ ] **MATERIAL** : puppeteer screenshot 3 cas (front/left/right) archivé dans artifacts/.
12. [ ] **CONTRACTS.md** : documenter DoorFace + Params.doorFace.
13. [ ] **HANDOVER.md** : loggger feature delivered.
14. [ ] **LOG** attempts.jsonl + metrics.json.
15. [ ] **RESULT.md** Evidence document.

## Ready to code : YES après READ étape 1.
