# TASK — Feature : porte positionnable sur façade avant OU côté

## Résumé

Actuellement la porte est placée en dur sur le panneau `front` (`packages/nichoir-core/src/geometry/panels.ts:257`). Ajouter un nouveau paramètre `doorFace` qui permet de choisir sur quel mur la porte est découpée : façade avant (défaut, = comportement actuel), mur gauche, ou mur droit.

## Intent lock

- Paramètre : `params.doorFace: 'front' | 'left' | 'right'`, défaut `'front'`.
- UI : nouveau ToggleBar dans `DimDoorSection.tsx` (affiché seulement quand `params.door !== 'none'` — cohérent avec le pattern unmount existant).
- Géométrie : le panneau choisi reçoit le trou de porte ; les 2 autres n'en reçoivent pas. Le panneau-porte physique (doorPanel) et le perchoir suivent la face choisie.
- Cut-plan (SVG export) : la pièce du panneau concerné doit refléter le trou dans la découpe (via parité avec ce que produit `buildPanelDefs`).
- Calculs : surfaces/volumes ne changent pas (le trou n'affecte pas ces nombres — c'est déjà le cas pour la façade).
- Backward-compat strict : `doorFace='front'` doit produire exactement le même output que le code actuel (fixtures `preset*.snapshot.json` MD5 stables).

## Contraintes

- `nichoir-core` reste pur (zéro DOM).
- `mkHexPanel` actuel construit ses triangles à la main (6 faces trapézoïdales) pour gérer toit-coupé + taper. Pour supporter un trou de porte, on a 2 voies :
  - **A. Nouvelle fonction** `mkHexPanelWithDoor` utilisant `THREE.Shape` + `ExtrudeGeometry` + positionnement 3D final. Seule cette branche est utilisée quand `doorFace ∈ {'left','right'}`.
  - **B. Étendre `mkHexPanel`** pour accepter `DoorInfo | null` optionnel (default null), et brancher l'ExtrudeGeometry dans le cas `doorInfo != null`.
  - Décision : **B** — moins de duplication, signature optionnelle backward-compat (tous les appels existants passent null/undefined).
- Le trou doit suivre le même contrat `DoorInfo` que `mkPent` (cx, cy en coordonnées locales du mur, type = round/square/pentagon).
- Taper + side door : les murs latéraux en mode taper ont 4 sommets non-coplanaires (Wbot en bas, Wtop en haut). L'ExtrudeGeometry devient non-trivial. → **Décision MVP** : supporter taper+side door en approximant la face comme plane (projetée sur le plan moyen du mur). Visuellement acceptable pour les tapers modérés. Documenter cette limitation.
- Perchoir sur side door : le perchoir se trouve toujours sur la même face que la porte. La position est en coordonnées locales du mur concerné (pas monde). Déjà ce que fait le code actuel pour front. À adapter pour left/right.
- doorPanel (pièce physique séparée, quand `params.doorPanel`) : doit aussi suivre la face choisie — translation + rotation différente pour left/right.
- cut-plan.ts : le layout découpe liste les panneaux pour la feuille matériau. Le nom (key) de la pièce qui a la porte change (ex: 'panel.front' vs 'panel.left'). Les surfaces à découper doivent refléter le trou — mais actuellement le cut-plan calcule des rectangles (pas de trou dans le SVG). À vérifier si c'est vrai (Read fichier).
- Clip planes (pour affichage plan de coupe 3D) : dépendent du panneau. Si la porte est sur left, le clip devrait peut-être changer ? À vérifier.
- exports STL : l'output STL reflète la geometry. Si geometry a un trou, STL aussi. Pas de code spécial requis.
- exports ZIP : idem.

## Critères d'acceptance

- [ ] Type `DoorFace = 'front' | 'left' | 'right'` exporté dans `types.ts`.
- [ ] `Params.doorFace: DoorFace` avec défaut `'front'` dans `createInitialState()`.
- [ ] `CONTRACTS.md` documente le nouveau champ + le contrat de routing.
- [ ] `mkHexPanel` accepte un paramètre optionnel `door?: DoorInfo | null` et `perch?: PerchHoleInfo | null` (signature étendue, backward-compat).
- [ ] `buildPanelDefs` route doorInfo + perchHoleInfo + doorPanel + perchCyl selon `params.doorFace` :
  - `front` → front reçoit door, comme actuel
  - `left` → left reçoit door, front devient plein
  - `right` → right reçoit door, front devient plein
- [ ] Les panneaux non-porteurs de la porte n'ont pas de trou (front=plain si doorFace='left', etc.).
- [ ] UI : ToggleBar ajouté dans DimDoorSection **avant** les sliders width/height, affiché quand door !== 'none'.
- [ ] i18n : 4 clés ajoutées (fr + en) : `dim.door.face`, `dim.door.face.front`, `dim.door.face.left`, `dim.door.face.right`.
- [ ] Backward-compat : avec `doorFace='front'`, les 5 fixtures (preset A-E) ont leurs MD5 inchangés.
- [ ] Tests unit core : parité de signature mkHexPanel (avec et sans door), routing doorInfo dans buildPanelDefs (3 cas), STL bytelength test pour preset avec doorFace='left'.
- [ ] Tests UI : DimDoorSection montre le toggle quand door !== 'none', setParam doorFace muté au click, unmount quand door='none'.
- [ ] `pnpm -r typecheck && pnpm -r test && pnpm -r lint` verts (4/4).
- [ ] `pnpm -C apps/demo build` vert.
- [ ] Passe navigateur manuelle : capturer 3 screenshots (doorFace=front, left, right) via puppeteer ad-hoc pour vérification visuelle.
- [ ] `HANDOVER.md` mis à jour (nouvelle feature loggée).
- [ ] `runs/2026-04-19-feature-doorFace/RESULT.md` evidence document complet.

## Périmètre

### Inclus
- Param doorFace + routing dans buildPanelDefs
- mkHexPanel étendu avec door/perch support
- UI : ToggleBar façade
- Fixtures backward-compat (doorFace défaut = comportement actuel)
- Tests unit core + UI
- Screenshots passe navigateur

### Exclus
- Combinaisons exotiques : si doorFace='left' + doorFollowTaper=true + pentagon door → supporté mais pas testé exhaustivement (le slope taper s'applique au mur, pas à la porte via même formule)
- Animation de transition entre 2 doorFace
- Prevention doorFace change quand doorPanel+cut-plan export en cours

## Failure modes à surveiller

- `extrude_non_coplanar` : THREE.ExtrudeGeometry attend un Shape 2D plan. Pour un mur latéral tapered, le shape doit être projeté en 2D en coordonnées locales puis extrudé avec la bonne profondeur/direction.
- `door_hole_wrong_orientation` : le trou doit être dans le plan du mur, pas dans le plan monde. Coordonnées locales correctes.
- `doorPanel_placement_wrong` : la pièce physique doorPanel doit être placée au bon endroit + rotation quand la face est left/right.
- `fixtures_md5_drift` : si mon routing default='front' introduit un round-trip non-identique (ex: sérialisation doorFace dans snapshot), MD5 change → sauf si je exclude doorFace de la snapshot via capture-reference.mjs, ou si la sérialisation est déterministe.
