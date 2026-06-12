# Nichoir WASM - reste a faire

Date: 2026-06-12

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
- Premiere passe securite imports ajoutee: limite fichier decor `2 Mo`, sanitizer SVG cote app, normalisation stricte des parametres cote Rust/WASM et plafonds image decodee.
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

10. Gestion client externe + autorisation serveur.

- La gestion compte/client reste hors WASM.
- Le site PHP gere la landing page publique, les pages prix, l'espace client, l'admin prive et l'API.
- Le backend/API gere utilisateurs, sessions, credits, abonnements, paiements Stripe, webhooks, messages et tickets.
- Le serveur ne calcule pas la geometrie et ne recoit pas les fichiers STL/PDF/ZIP generes.
- Le serveur retourne seulement un etat compte + une autorisation courte pour le telechargement demande.
- Les exports premium demandent une autorisation avant generation/telechargement.
- Le WASM garde le calcul, la geometrie, le plan, les exports et l'interface metier.

Architecture web cible:

- `/`: landing page publique qui presente le produit et dirige vers inscription/app.
- `/pricing`: offres, credits et abonnements.
- `/app/`: app Rust/WASM.
- `/account`: espace client pour profil, credits, abonnement, factures et tickets.
- `/admin`: admin prive pour gerer clients, credits, abonnements, paiements, consommations et tickets.
- `/api/...`: API JSON consommee par l'app et l'espace client.
- `/stripe/webhook`: webhook Stripe cote PHP.

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
- Tester SVG et heightmap, incluant SVG refuses et valeurs parametres extremes.

### Phase D - Gestion compte/API + autorisation d'export

- Etat actuel au 2026-06-11:
  - Backend local PHP SQLite/MySQL cree dans `server-php/`.
  - Migration SQLite initiale creee.
  - Endpoints `health`, `register`, `login`, `logout`, `me`, `credits/ledger`, `billing/summary`, `stripe-link`, `exports/authorize`, `exports/consume`, `tickets` ajoutes.
  - Utilisateur demo cree pour developpement: `demo@nichoir.local` / `password123`.
  - Credits serveur fonctionnels: autorisation STL testee, debit de 3 credits confirme.
  - Modal `Compte` ajoute dans l'app, avec login/register/logout/demo et affichage de `GET /api/me`.
  - Exports premium branches sur `exports/authorize` avant generation locale, puis `exports/consume` apres succes.
  - Identifiants demo limites au localhost/config explicite; hors localhost, le login demo rapide est desactive.
  - Boutons Stripe branches sur `POST /api/checkout/stripe-link` et `POST /api/billing/portal`.
  - Squelette site PHP ajoute: `/`, `/pricing`, `/account`, `/admin`.
  - Admin dev branche sur SQLite/MySQL: repertoire utilisateurs, recherche, filtres, pagination, credits totaux, autorisations recentes, tickets ouverts.
  - CRUD utilisateur admin ajoute: creation, edition courriel/nom/statut/credits, reset mot de passe, suppression avec confirmation.
  - Fiche client admin ajoutee: recherche courriel, historique credits, exports, tickets, audit admin.
  - Actions admin ajoutees: ajustement manuel des credits, suspension/reactivation de compte.
  - Action admin abonnement ajoutee: mise a jour manuelle du plan/statut serveur en attendant le webhook Stripe.
  - Schema ajoute: `users.status`, `subscriptions`, `payments`, `stripe_events` et `admin_audit_log`.
  - Espace client `/account` branche sur API: login/register/logout, credits, historique credits, abonnement, paiements, tickets.
  - Endpoints `GET /api/credits/ledger` et `GET /api/billing/summary` ajoutes.
  - Endpoint local `/stripe/webhook` ajoute: journalisation idempotente des events, traitement dev de `checkout.session.completed` et `customer.subscription.*`.
  - `/admin` reste ouvert en local; en production, il doit utiliser `NICHOIR_ADMIN_KEY`.
  - Tickets completes en premiere version produit: fil de messages client/admin, reponses support, reponses client, statut open/closed, priorite, assignation, outbox notification email SQLite et envoi SMTP configurable depuis `/admin`.
  - Espace client complete pour edition profil, Checkout Stripe, portail client et liens de factures.
  - Admin complete pour configuration Stripe et affichage des factures dans les paiements.
  - Webhook Stripe complete avec verification `Stripe-Signature` quand un secret est configure, factures `invoice.*`, abonnements et idempotence credits/paiements.
  - Admin restructure par onglets metier avec details client/ticket en modales.
  - Exports admin de base ajoutes: CSV, Excel compatible `.xls` et JSON par portee (`all`, `clients`, `billing`, `support`, `credits`, `exports`).
  - Configuration DB cPanel/MySQL ajoutee dans `/admin` > `Reglages`; SQLite reste le mode local par defaut.

- Le backend local PHP + SQLite teste maintenant le flux compte/credits/autorisation.
- Les tables utilisateurs, sessions, credits, abonnements, paiements, consommations, tickets et messages sont initialisees.
- `GET /api/me` retourne l'etat du compte, le solde credits et le statut abonnement.
- `GET /api/billing/summary` retourne l'abonnement courant et les paiements que Stripe aura synchronises.
- `POST /api/checkout/stripe-link` cree une session Checkout Stripe si Stripe est configure.
- `POST /api/billing/portal` cree une session portail client Stripe.
- `POST /stripe/webhook` peut appliquer les evenements Stripe signes pour remplir `payments`, `subscriptions`, factures et credits achetes.
- `POST /api/exports/authorize` recoit seulement le type d'export demande (`stl`, `pdf`, `zip`, `png`, `svg`) et retourne une autorisation courte si le compte est valide.
- `POST /api/exports/consume` confirme/debite les credits apres export local reussi.
- Les exports premium demandent maintenant cette autorisation avant generation.
- Les fichiers et le calcul restent cote client: aucune geometrie lourde ne doit etre envoyee au serveur.

Travail restant dans cette phase:

- Completer la landing page PHP publique (`/`) avec contenu produit reel.
- Completer page prix/offres (`/pricing`) pour credits et abonnements.
- Completer admin prive (`/admin`) pour filtres billing avances, surveillance des echecs email et audit lisible.
- Retirer les identifiants demo visibles du build de production.
- Ajouter une configuration dev/prod pour URL API, CORS, demo user et affichage debug.
- Durcir la configuration email production: secret SMTP via variable serveur si possible, suivi des echecs et retry manuel/automatique.
- Tester Stripe en mode live/test avec les vrais price IDs, le portail active dans Stripe et `NICHOIR_STRIPE_WEBHOOK_SECRET`.
- Tester la connexion MySQL avec les vraies coordonnees cPanel et verifier le schema cree sur le serveur.
- Creer le script de packaging/installation cPanel: zip propre, verification extensions PHP, `data/` writable, test DB, schema, SMTP optionnel.

Controle anti-drift:

- Le WASM ne doit pas devenir la source de verite pour le compte, le solde, l'abonnement ou les paiements.
- Le backend ne doit pas generer les STL/PDF/ZIP ni recevoir la geometrie complete.
- Le front-end orchestre seulement: demander autorisation, lancer export local, confirmer consommation.
- L'admin et les webhooks Stripe restent toujours cote PHP, jamais dans le WASM.
- Le serveur PHP nourrit l'API et reste le maitre. L'app WASM est un client esclave qui calcule et exporte seulement apres autorisation.
- Le modal `Compte` dans l'app doit rester un resume rapide avec liens vers `/account` et `/pricing`; la gestion complete reste sur le site.

## 5. Definition de termine

La migration peut etre consideree terminee quand:

- L'utilisateur peut creer le meme nichoir que dans v16.
- Toutes les options principales de v16 existent dans l'app WASM.
- Les STL sont generes cote client.
- Le ZIP panneaux contient les bonnes pieces.
- Le plan de coupe est exportable.
- Les decorations sont visibles et exportables.
- Le serveur ne recoit pas la geometrie et ne fait aucun calcul lourd.
- La gestion client, les credits, les abonnements, Stripe, les messages et les tickets sont geres hors WASM.
- L'autorisation serveur peut activer/desactiver les exports sans exposer les secrets ni faire les calculs a la place du client.
- Le site public, l'espace client et l'admin sont servis par PHP autour de l'app WASM.
