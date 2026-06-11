# Nichoir WASM - reste a faire

Date: 2026-06-10

Objectif: terminer la migration de `nichoir_v16.html` vers une app Rust/WASM ou la logique metier, la geometrie, les calculs et les exports sont cote client. Le serveur futur ne doit servir qu'a l'autorisation/licence.

## 1. Reference fonctionnelle: `nichoir_v16.html`

### Dimensions et structure

- Unites: `mm`, `cm`, `inches`.
- Largeur, hauteur, profondeur.
- Evasement X positif ou negatif.
- Plancher: enclave ou pose.
- Toiture: pente, debordement pluie.
- Jonction de crete: gauche recouvre, droit recouvre, onglet.
- Epaisseur materiau avec affichage equivalent en pouces.

### Porte et perchoir

- Porte: aucune, ronde, carree, pentagonale.
- Largeur, hauteur, position horizontale, position verticale.
- Panneau de porte optionnel.
- Ajustement du panneau de porte.
- Option: cotes de porte suivent l'evasement.
- Perchoir optionnel.
- Diametre, longueur et position sous porte.
- Trou de perchoir rond.

### Viewer 3D

- Modes: plein, filaire, rayons X, aretes.
- Mode eclate.
- Coupes X/Y/Z avec sliders.
- Camera interactive: rotation, pan, zoom.
- Grille et axes.

### Decorations

- Selection du panneau cible: facade avant, arriere, cote gauche, cote droit, toit gauche, toit droit.
- Import SVG.
- Import PNG/JPG.
- Activation decoration par panneau.
- Mode vectoriel: extrusion + bevel.
- Mode heightmap: relief depuis image.
- Largeur, hauteur, position X/Y, rotation.
- Profondeur de relief.
- Bevel vectoriel.
- Inversion heightmap.
- Resolution heightmap.
- Clipping par forme de panneau.
- Placement correct sur chaque panneau.
- Inclusion des decorations dans STL maison et ZIP panneaux.

### Calculs

- Volume exterieur.
- Volume interieur.
- Volume matiere.
- Surface totale panneaux.
- Surfaces par categories: facades, cotes, plancher, toit.
- Table de coupe/pieces.
- Nombre total de pieces.
- Conversion unite dans l'affichage.

### Plan de coupe

- Formats panneau predefinis.
- Format panneau custom.
- Ecart entre pieces.
- Packing 2D.
- Canvas plan de coupe.
- Statistiques d'utilisation.
- Aire pieces.
- Aire panneau.
- Export PNG.
- Export SVG.

### Exports

- STL maison complete.
- STL porte seule.
- ZIP panneaux separes.
- Plan PNG.
- Plan SVG.
- Fallback JS si le module WASM n'est pas disponible.

## 2. Etat actuel de la nouvelle app Rust/WASM

Fichiers principaux:

- `app/index.html`: page hote minimale.
- `app/app.js`: viewer Three.js, binding UI, telechargements.
- `app/style.css`: interface.
- `wasm/src/lib.rs`: logique Rust/WASM.
- `wasm/pkg`: package WASM genere.

### Deja migre

- Parametres principaux centralises cote Rust.
- UI rendue par Rust via `render_app_html`.
- Onglets: `DIM`, `VUE`, `DECOR`, `CALCULS`, `PLAN`.
- Dimensions: largeur, hauteur, profondeur.
- Evasement X.
- Plancher enclave/pose.
- Toiture: pente et debordement.
- Crete: gauche, droit, onglet.
- Epaisseur materiau.
- Porte: aucune, ronde, carree, pentagonale.
- Position et dimensions de porte.
- Panneau de porte.
- Ajustement du panneau de porte.
- Porte qui suit l'evasement.
- Perchoir cylindrique.
- Diametre, longueur et offset du perchoir.
- Viewer Three.js depuis triangles generes par Rust.
- Modes viewer: plein, filaire, rayons X, aretes.
- Mode eclate.
- Camera orbit/pan/zoom.
- Calculs principaux via Rust.
- Liste de pieces via Rust.
- Preview plan SVG via Rust.
- Export maison STL via Rust.
- Export porte STL via Rust.
- Export panneaux ZIP via Rust.
- Export plan SVG.
- Feedback utilisateur pour exports.
- Stabilisation UX: sliders sans flicker ni perte de scroll.

### Corrections deja faites

- Perchoir carre remplace par tige cylindrique.
- Porte ronde seule sortie du fallback grille dense.
- Porte ronde + trou de perchoir sortie du fallback grille dense.
- Porte carree/pentagonale sans perchoir sortie du chemin grille.
- Correction du bug ou le pignon disparaissait avec une porte active.
- Suppression d'une face interne visible entre mur et pignon.
- Rendu des aretes de facade ajuste pour eviter les lignes artificielles en mode plein.
- Exports navigateur renforces: copie defensive des bytes WASM avant Blob, statut succes/erreur/export vide.
- Export OBJ debug ajoute pour inspecter la geometrie dans Blender ou un editeur texte.
- Rapport mesh/STL ajoute: triangles, taille STL/OBJ, bounding box, volume signe, triangles degeneres, valeurs non finies, entrees ZIP.
- Nettoyage final des triangles avant export: suppression des triangles degeneres et valeurs non finies.
- Correction STL binaire: chaque triangle ecrit maintenant 50 octets exacts (normal + 3 vertices + attribut 2 octets). Ancien bug: 52 octets par triangle, fichier refuse par certains outils.
- Premier smoke test ajoute: `node scripts/mesh-smoke.mjs`.
- Smoke test valide sur presets: default, porte ronde + perchoir + panneau, porte carree, porte pentagonale, evasement positif + onglet, evasement negatif + plancher pose.
- Toiture `onglet` alignee sur v16: section trapezoidale/bevelee portee dans maison complete, viewer et ZIP panneaux.
- Smoke test ZIP renforce: chaque STL interne du ZIP est lu et valide comme STL binaire exact.
- Triangulation `earcutr` ajoutee pour la facade avant avec trous, equivalent au principe `THREE.Shape + holes` de v16.
- Les panneaux du ZIP sont maintenant testes strictement watertight: zero arete ouverte et zero arete non-manifold par piece.
- `maison_complete.stl` reste un assemblage de panneaux qui se touchent, pas une union booleenne. Le test tolere les aretes sur-partagees de contact d'assemblage mais refuse les aretes ouvertes.
- Pente de toit par defaut changee a 45 degres.
- Ajustement des jonctions des cotes: les panneaux lateraux utilisent maintenant une coupe basse plate et une coupe haute biseautee selon la pente du toit.
- Le plancher en mode enclave retranche maintenant l'inset lateral projete (`T / cos(alpha)`) pour reduire le decalage avec les parois evasees.
- Les cotes exportes dans le ZIP utilisent maintenant la meme geometrie biseautee que le viewer et la maison complete, au lieu d'anciens panneaux rectangles.
- Calculs et plan communiquent maintenant les angles et valeurs d'usinage: pente du toit, angle des parois, retrait lateral, coupe haute des cotes et trait de scie.
- Ajout d'un bouton `Recentrer la vue` dans l'onglet Vue.
- Les volumes, surfaces, stats de plan et dimensions de pieces affichent maintenant l'unite choisie (`mm`, `cm`, `in`) tout en gardant la geometrie interne en millimetres pour STL/usinage.
- Ajout d'une liste de formats de panneaux commerciaux: 4 x 8 ft, 4 x 4 ft, 2 x 4 ft, 5 x 5 ft, 5 x 10 ft et formats metriques courants.
- Le plan de coupe utilise maintenant le parametre `Lame de scie / trait` comme espacement physique entre les pieces.
- Plancher enclave corrige: la piece n'est plus une simple boite a chants verticaux lorsque les parois sont evasees. Elle utilise maintenant des chants lateraux biseautes selon l'angle des parois pour eviter le chevauchement a la base.
- Les mesures indiquent maintenant `Angle plancher` et `Retrait plancher/cote`; la nomenclature du plancher precise largeur dessous, largeur dessus et matiere a retirer par cote.
- Jonction de crete corrigee: les toits `Gauche recouvre` et `Droit recouvre` utilisent maintenant un profil polygonal biseaute au lieu d'une boite rectangulaire allongee. Le biseau de crete depend de la pente du toit et est applique au viewer, a la maison STL et au ZIP panneaux.
- Les mesures indiquent maintenant `Biseau crete` pour communiquer la matiere a retirer a la jonction du toit.
- Correction de la logique `Gauche/Droit`: le panneau selectionne reste recouvrant, et le panneau oppose recoit le biseau de jonction. Le mode `Onglet` biseaute les deux panneaux.
- Les sliders et champs numeriques respectent maintenant l'unite active: en `cm` ou `in`, les valeurs affichees/saisies sont converties vers les millimetres internes avant calcul STL.
- Sidebar elargie et champs numeriques places a cote des sliders pour permettre la saisie precise sans reduire la course du slider.
- Regle automatique de crete: `Gauche` et `Droit` restent valides uniquement a 45°. Si la pente du toit sort de 45°, la geometrie force automatiquement `Onglet` et l'UI affiche une note d'avertissement.
- Premiere passe decoration WASM: etat `decos` integre aux parametres Rust, UI `Decor` active, chargement SVG vectoriel, extrusion de formes SVG en triangles Rust, rendu dans le viewer, inclusion dans STL maison/OBJ/rapport mesh et ajout dans le ZIP comme entrees `deco_*`.
- Pretraitement SVG ajoute: les chemins avec lignes, courbes cubiques `C/S`, courbes quadratiques `Q/T` et arcs `A` sont convertis en segments avant extrusion.
- Limite assumee de cette passe decoration: PNG/JPG heightmap, clipping exact par panneau, bevel vectoriel, transforms SVG de groupes et conversion de strokes ouverts en surfaces imprimables ne sont pas encore portes.
- Heightmap ajoute: les PNG/JPG sont decodes cote Rust/WASM avec `image`; les SVG charges par le navigateur sont aussi rasterises en PNG puis envoyes au WASM comme heightmap. La geometrie finale du relief est generee et exportee par Rust/WASM.
- Definition heightmap exposee par slider jusqu'a 256 subdivisions; les SVG sont re-rasterises localement quand la resolution change pour ameliorer la source avant generation du mesh.
- Option `Fond transparent / supprimer fond blanc`: suppression locale des pixels transparents ou presque blancs pour comparer rapidement si le retrait du fond ameliore la forme. Aucun backend requis.
- Anti-pics heightmap ajoute: `Auto smooth`, `Intensite biseau / chanfrein` et `Seuil anti-bruit` modifient la luminance avant generation des vertices pour reduire les pointes lorsque la resolution augmente.
- Import image heightmap etendu: `PNG`, `JPEG/JPG`, `GIF` et `WEBP` sont acceptes par le navigateur et decodes cote Rust/WASM via `image`. Pour GIF, le comportement actuel est image fixe pour relief, pas animation.
- Clipping geometrique des decorations heightmap ajoute: l'option `Clipper au panneau` coupe le relief selon le contour physique du panneau cible avant rendu/export. Sur facade/arriere, le relief est coupe au pentagone pour eviter qu'une image trop haute traverse le toit.
- Priorite des ouvertures ajoutee: sur la facade avant, le masque de decoration soustrait aussi la porte d'entree et le trou de perchoir. Le decor ne doit plus passer par-dessus une ouverture.
- Trous de suspension ajoutes: jusqu'a quatre trous ronds traversants dans les panneaux de toit, aux coins avant/arriere gauche/droit, avec diametre et retraits reglables depuis les bords du toit.

## 3. Ecarts importants a combler

### Priorite haute

1. Finaliser la geometrie exacte sans decoration.

- Verifier tous les cas: plancher enclave/pose, evasement positif/negatif, crete gauche/droit/onglet, portes rondes/carrees/pentagonales, perchoir, panneau de porte.
- Verifier les combinaisons porte carree/pentagonale + perchoir.
- Eliminer les derniers fallbacks grille si la geometrie peut etre generee proprement.
- S'assurer que le STL maison est imprimable et sans faces internes problematiques.
- Distinction actuelle: les pieces separees du ZIP sont watertight; la maison complete est un assemblage de shells en contact. Pour une maison complete vraiment manifold, il faudra une union booleenne/CSG ou exporter une version legerement separee.
- Verifier visuellement dans le slicer les nouvelles coupes des cotes contre le plancher et contre le toit pour confirmer le snug fit dans les cas avec evasement positif/negatif.
- Pour l'impression en une seule piece, ajouter une vraie union booleenne/CSG: les corrections actuelles ameliorent les contacts et les pieces separees, mais ne fusionnent pas encore les panneaux en un seul solide manifold.
- Verifier que les valeurs affichees en `cm` et `in` correspondent bien aux attentes utilisateur; les sliders restent bases sur les valeurs internes en millimetres pour eviter une conversion destructive des parametres.

2. Rendre le ZIP panneaux equivalent a v16.

- Facade avant exacte avec trous.
- Facade arriere exacte.
- Cotes exacts avec evasement et coupes d'ajustement plancher/toit. Statut: premiere passe implementee et validee par smoke test; reste inspection visuelle/parite v16.
- Toits exacts avec recouvrement et onglet.
- Toits `onglet` portes; reste a inspecter visuellement dans slicer/Blender et a comparer aux snapshots v16.
- Plancher exact selon mode enclave/pose.
- Porte STL incluse seulement quand le panneau de porte est actif.
- Perchoir STL cylindrique.

3. Ajouter une verification de parite.

- Comparer v16 et WASM sur configurations types.
- Mesurer: nombre de triangles, taille STL, bounding box, volumes approximatifs, pieces exportees.
- Creer un petit script de test pour exporter quelques presets et verifier que les fichiers ne sont pas vides. Statut: premier smoke test local fait avec `scripts/mesh-smoke.mjs`; prochaine etape: ajouter comparaison automatique avec v16 ou avec snapshots de reference.

4. Porter les coupes X/Y/Z.

- Ajouter les controles UI.
- Ajouter les clipping planes dans le viewer Three.js.
- Les coupes peuvent rester viewer-side, car elles ne changent pas la geometrie exportee.

### Priorite moyenne

5. Completer le plan de coupe.

- Reprendre les formats predefinis de v16.
- Ajouter format custom complet.
- Ajouter ecart entre pieces.
- Ameliorer packing 2D.
- Export PNG.
- Export SVG plus complet.
- Afficher stats d'utilisation comme v16.

6. Porter le module decoration.

- Statut: premiere passe vectorielle SVG implementee cote WASM avec linearisation des courbes; premiere passe heightmap implementee avec decode PNG/JPG Rust/WASM et raster SVG vers PNG cote navigateur.
- A faire: supporter les transforms SVG de groupes, convertir les traits/strokes en contours fermes, ameliorer le raster SVG pour mieux respecter transparence/couleurs, ajouter bevel vectoriel, clipper la decoration par forme de panneau et par trou de porte, fusionner optionnellement la decoration au STL de chaque panneau au lieu de l'exporter comme entree separee.

- Reproduire l'UI complete de v16.
- Import SVG.
- Import PNG/JPG.
- Mode vectoriel.
- Mode heightmap.
- Bevel.
- Inversion heightmap.
- Resolution.
- Clipping par panneau.
- Placement sur facades/cotes/toits.
- Inclusion dans STL maison.
- Inclusion dans ZIP panneaux.

Decision technique a prendre pour decorations:

- Option A: parser/rasteriser en JS, envoyer une heightmap/mesh a Rust pour export.
- Option B: porter le maximum en Rust/WASM.
- Recommandation pragmatique: garder import/rasterisation navigateur cote JS au debut, mais faire produire la geometrie finale/exportable par Rust.

7. Completer i18n.

- Verifier toutes les chaines FR/EN.
- Enlever les textes fixes restants dans JS/CSS si besoin.
- Harmoniser accents si on garde ASCII ou si on accepte UTF-8 dans les fichiers.

### Priorite basse

8. Fallback JS.

- v16 avait des fallbacks JS si WASM n'etait pas disponible.
- Pour le produit final, ce n'est pas obligatoire si l'app exige WASM.
- En developpement, un message clair "WASM non charge" suffit probablement.

9. Polissage UI.

- Ameliorer l'onglet DECOR actuellement partiel.
- Ajouter hints metier manquants.
- Afficher version WASM.
- Ajouter statut licence/autorisation quand le serveur sera branche.

10. Autorisation serveur.

- Ajouter mini FastAPI + SQLite.
- Le serveur ne calcule pas la geometrie.
- Le serveur retourne seulement l'etat d'autorisation/licence.
- Les exports ou features premium verifient cette autorisation avant execution.
- Stripe sera ajoute plus tard.

## 4. Plan recommande de migration restante

### Phase A - Geometrie et exports fiables

- Tester et corriger toutes les combinaisons de base.
- Corriger ZIP panneaux pour qu'il soit equivalent a v16.
- Ajouter tests de non-regression pour les exports.
- Objectif: app utilisable sans decorations.

### Phase B - Viewer et plan

- Ajouter coupes X/Y/Z.
- Completer plan de coupe.
- Ajouter export PNG du plan.
- Ameliorer stats et presets panneau.

### Phase C - Decorations

- Porter UI decoration complete.
- Porter generation geometrie decoration.
- Integrer decoration dans viewer, STL maison et ZIP panneaux.
- Tester SVG et heightmap.

### Phase D - Autorisation

- Ajouter FastAPI + SQLite.
- Ajouter endpoint licence/dev-token.
- Brancher l'app sur le statut d'autorisation.
- Verrouiller exports premium si non autorise.

## 5. Definition de termine

La migration peut etre consideree terminee quand:

- L'utilisateur peut creer le meme nichoir que dans v16.
- Toutes les options principales de v16 existent dans l'app WASM.
- Les STL sont generes cote client.
- Le ZIP panneaux contient les bonnes pieces.
- Le plan de coupe est exportable.
- Les decorations sont visibles et exportables.
- Le serveur ne recoit pas la geometrie et ne fait aucun calcul lourd.
- L'autorisation peut activer/desactiver les exports sans exposer la logique serveur.
