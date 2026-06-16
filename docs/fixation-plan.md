# Plan cible: fixation murale du nichoir

Objectif: ajouter une option de fixation murale au nichoir sans refonte et sans modifier les comportements existants quand l'option est inactive.

## Principe

- La fixation murale est une option WASM/app desactivee par defaut.
- La porte reste sur la facade avant.
- Les deux trous de fixation sont places sur la facade arriere, opposee a la porte.
- L'utilisateur passe par la porte pour visser le bloc de fixation depuis l'interieur.
- Le bloc de fixation est place a l'exterieur, derriere la facade arriere.
- L'epaisseur/profondeur du bloc suit par defaut la valeur `overhang` / `Debordement pluie`.
- Le dessus du bloc doit former une pente de 30 degres qui descend vers l'exterieur, pour evacuer la pluie loin de la paroi arriere et des trous.
- Aucun changement PHP, admin, Stripe, SMTP ou base de donnees n'est necessaire pour cette passe.

## Garde-fous anti-derive

- Ne pas refactorer la geometrie generale.
- Ne pas modifier les routes PHP, l'admin, l'auth, Stripe, SMTP ou le packaging cPanel sauf bug directement revele par les tests.
- Ne pas changer les exports existants quand la fixation murale est inactive.
- Ne pas supprimer les trous de suspension de toit existants.
- Ne pas reutiliser les parametres de suspension de toit pour la fixation murale si cela rend l'UI confuse.
- Garder des noms explicites: `wallMount`, `wallMountHoleDiam`, `wallMountHoleSpacing`, `wallMountY`, `wallMountBlockW`, `wallMountBlockH`, `wallMountBlockDepth`.
- Ajouter les textes FR/EN en meme temps que les controles.
- Garder les valeurs par defaut conservatrices et compatibles avec les dimensions actuelles.

## Etapes d'implementation

1. Ajouter les parametres optionnels dans `wasm/src/lib.rs`.
   - `wallMount: bool`, defaut `false`.
   - diametre des trous, espacement horizontal, position verticale.
   - largeur, hauteur et profondeur du bloc.
   - profondeur du bloc: `wallMountBlockDepth=0` signifie automatique, donc profondeur effective liee a `overhang`.

2. Ajouter la validation/clamp des nouveaux parametres.
   - Interdire les dimensions nulles ou extremes.
   - Garder les trous dans la zone utile de la facade arriere.
   - Eviter que les trous sortent de la largeur disponible du panneau arriere.

3. Ajouter les traductions FR/EN.
   - Titre: fixation murale.
   - Activer fixation murale.
   - Diametre des trous.
   - Espacement des trous.
   - Hauteur des trous.
   - Largeur/hauteur/profondeur du bloc.
   - Note: acces aux vis par la porte.

4. Ajouter les controles UI dans la section dimensions ou construction.
   - Les controles n'apparaissent que si `wallMount=true`.
   - Ne pas melanger avec les trous de suspension de toit.

5. Generer les deux trous sur la facade arriere seulement.
   - Creer une fonction dediee, par exemple `back_mount_holes(p, g)`.
   - Utiliser les primitives existantes de trous circulaires/polygones.
   - Remplacer seulement le rendu/export du panneau arriere par une variante avec trous quand `wallMount=true`.

6. Generer le bloc de fixation comme piece separee.
   - Fonction dediee, par exemple `mount_block_tris(p, g)`.
   - Position: derriere la facade arriere.
   - Profondeur: `wallMountBlockDepth`; la valeur `0` garde le bloc synchronise avec `overhang`.
   - Les deux trous doivent traverser le bloc et correspondre aux trous arriere.
   - Le dessus expose du bloc doit recevoir un capot/pan incline a 30 degres, plus haut cote paroi et plus bas cote exterieur.

7. Integrer aux exports.
   - `export_house_stl`: inclure le bloc seulement si `wallMount=true`.
   - `export_wall_mount_stl`: telecharger le bloc seul seulement si `wallMount=true`.
   - `export_panels_zip`: ajouter `bloc_fixation_mur.stl` seulement si `wallMount=true`.
   - `Plan`: afficher un bouton `.STL` dedie a la fixation murale quand l'option est active.
   - `mesh_report`: compter la piece seulement si active.
   - Le ZIP sans fixation doit rester identique dans sa liste de pieces.

8. Integrer a l'aperçu 3D.
   - Ajouter le bloc dans `render_scene_parts` seulement si actif.
   - Utiliser une couleur distincte mais sobre.
   - Verifier que l'explosion ne masque pas la logique de position.

## Mesures de verification

### Avant modification

- `git status --short` doit etre clean.
- Capturer les tailles/listes d'exports pour un cas par defaut sans fixation.
- Noter que les tests existants passent avant changement.

### Tests obligatoires apres modification

- `cargo check` dans `wasm/`.
- `cargo test` dans `wasm/`.
- `wasm-pack build --target web` dans `wasm/`.
- `node --check app/app.js`.
- `node scripts/mesh-smoke.mjs`.
- Rebuild artifact cPanel sans ZIP final.
- Lint PHP dans l'artifact pour confirmer aucune regression packaging.
- Scan artifact: pas de README, markdown, docs, `.env`, DB, secrets, CDN Three.js.

### Verification fonctionnelle

- Cas 1: `wallMount=false`.
  - L'UI actuelle reste stable.
  - Les exports existants ne gagnent pas de piece `bloc_fixation_mur`.
  - Les trous arriere ne sont pas presents.

- Cas 2: `wallMount=true`.
  - Deux trous apparaissent sur la facade arriere.
  - Aucun trou supplementaire n'apparait sur la facade avant.
  - La porte reste fonctionnelle et visible.
  - Le bloc apparait derriere la facade arriere.
  - Les trous du bloc correspondent aux trous arriere.
  - Le bloc a une profondeur egale au debordement pluie par defaut.
  - Le dessus du bloc descend vers l'exterieur pour que l'eau ne soit pas dirigee vers les trous de la paroi.
  - Le ZIP contient `bloc_fixation_mur.stl`.

- Cas 3: valeurs extremes.
  - Diametre trop grand: clamp ou limite propre.
  - Espacement trop grand: les trous restent dans la facade arriere.
  - Overhang a 0: profondeur minimale du bloc appliquee.
  - Petite largeur de nichoir: les trous restent valides ou l'option se limite proprement.

### Verification visuelle

- Charger `http://127.0.0.1:8016/app/index.html?lang=fr`.
- Tester FR et EN.
- Activer la fixation murale.
- Verifier en mode plein et eclate.
- Exporter STL maison et ZIP panneaux.
- Ouvrir ou inspecter rapidement le ZIP pour confirmer la presence/absence des pieces selon l'option.

## Critere d'acceptation

La passe est acceptable seulement si:

- l'option inactive preserve le comportement actuel;
- l'option active ajoute exactement deux trous arriere et un bloc de fixation;
- les trous et le bloc sont alignes;
- le bloc suit le debordement pluie par defaut;
- les exports et l'aperçu 3D restent coherents;
- les tests automatises passent;
- aucun code PHP/admin/Stripe/SMTP/DB n'est modifie.

## Commit attendu

Si la feature est implementee:

```bash
git commit -m "Add optional wall mount geometry"
```

Si seul ce plan est ajoute:

```bash
git commit -m "Document wall mount implementation plan"
```
