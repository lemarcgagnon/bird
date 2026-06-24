# Checklist de smoke test du refactoring

## But

Cette checklist sert de garde-fou à chaque phase de refactoring. Elle n’est pas un plan de tests exhaustif. C’est une vérification minimale pour détecter rapidement une casse de surface, de parcours critique ou de logique de débit.

## Règle d’usage

1. Ne pas lancer toute la checklist à chaque mini-édition.
2. Exécuter seulement les blocs liés à la phase en cours.
3. Marquer explicitement ce qui a été vérifié et ce qui ne l’a pas été.

## Bloc A: App WASM shell et navigation

### A1. Chargement initial

Étapes:

1. Ouvrir l’app WASM.
2. Vérifier que le rendu initial s’affiche sans panneau vide.
3. Vérifier que les actions principales sont présentes.

Résultat attendu:

1. Le nichoir s’affiche.
2. Le menu gauche s’affiche avec les groupes attendus.
3. Aucun bloc essentiel n’est manquant.

### A2. Changement de langue

Étapes:

1. Passer en `FR`.
2. Passer en `EN`.

Résultat attendu:

1. Les labels changent.
2. La structure de l’écran ne casse pas.
3. Les actions restent cliquables dans les deux langues.

### A3. Onglets principaux

Étapes:

1. Ouvrir successivement `DIM.`, `Decor`, `Calcs`, `Cut plan`, `Account` ou leur équivalent courant.

Résultat attendu:

1. Chaque onglet affiche son contenu.
2. Aucun onglet ne montre une section vide inattendue.
3. Le focus clavier reste visible.

## Bloc B: Viewer 3D

### B1. Interactions de base

Étapes:

1. Tourner la vue.
2. Zoomer.
3. Recentrer la vue.

Résultat attendu:

1. Le viewer reste stable.
2. Aucun remount brutal ou écran noir.
3. Le bouton de reset fonctionne.

### B2. Changement d’affichage

Étapes:

1. Basculer entre les modes `Solid`, `Enclave`, `Edges`, ou équivalents courants.

Résultat attendu:

1. Le mode visuel change.
2. Le viewer garde sa cohérence.

## Bloc C: Decor importé

### C1. Upload SVG

Étapes:

1. Importer un SVG simple.
2. Vérifier la preview.

Résultat attendu:

1. Le décor apparaît.
2. Les contrôles liés au décor s’affichent.

### C2. Upload image relief

Étapes:

1. Importer une image PNG/JPEG/GIF/WEBP.
2. Tester les réglages relief.

Résultat attendu:

1. Le décor relief apparaît.
2. Les réglages modifient bien le résultat.

### C3. Upload STL

Étapes:

1. Importer un STL décor.
2. Vérifier la preview.
3. Retirer le décor importé.
4. Réimporter un autre décor.

Résultat attendu:

1. Le STL apparaît.
2. Le bouton ou moyen de suppression fonctionne.
3. Le remplacement du décor fonctionne sans état zombie.

### C4. Boring entrée sur décor

Étapes:

1. Placer un décor qui intersecte la porte d’entrée.
2. Vérifier la preview exportable.

Résultat attendu:

1. Le boring traverse le décor.
2. Le résultat reste visuellement cohérent.
3. Aucun warning mesh inattendu si le cas est censé être manifold.

## Bloc D: Exports app

### D1. Export STL nichoir

Étapes:

1. Exporter le nichoir avec décor.
2. Ouvrir le résultat dans un viewer.

Résultat attendu:

1. Le décor est bien fusionné quand il doit l’être.
2. Le nichoir exporté correspond à la preview.

### D2. Export panneaux ZIP

Étapes:

1. Exporter les panneaux STL.

Résultat attendu:

1. L’archive est générée.
2. Les panneaux attendus sont présents.

### D3. Export plan PDF/PNG/SVG

Étapes:

1. Télécharger les plans.

Résultat attendu:

1. Les fichiers se téléchargent.
2. Le contenu est lisible.

### D4. Qualité STL décor

Étapes:

1. Exporter le même modèle en qualité faible.
2. Exporter en qualité moyenne.
3. Exporter en qualité élevée.

Résultat attendu:

1. Les options existent toujours.
2. La qualité du décor varie selon l’option choisie.

## Bloc E: Billing et débit

### E1. Quote / authorize / consume

Étapes:

1. Déclencher une quote.
2. Autoriser un export.
3. Consommer l’export.

Résultat attendu:

1. La quote ne débite rien.
2. L’autorisation ne débite rien.
3. Le consume réalise le débit effectif.

### E2. Repeat entitlement

Étapes:

1. Télécharger une première fois un produit facturable.
2. Télécharger à nouveau le même produit dans le cadre prévu par la règle de répétition.

Résultat attendu:

1. Le second téléchargement ne redébite pas si la règle actuelle dit qu’il est déjà acquis.

### E3. Admin bypass

Étapes:

1. Faire le même export en mode admin.

Résultat attendu:

1. Le téléchargement fonctionne.
2. Aucun débit client n’est créé.

## Bloc F: Wall mount universel

### F1. Activation du système

Étapes:

1. Activer le wall mount.
2. Vérifier le rendu.

Résultat attendu:

1. Le mâle est fusionné à la paroi arrière du nichoir.
2. La femelle apparaît comme pièce séparée quand prévu.

### F2. Contrôle mécanique

Étapes:

1. Vérifier la femelle et ses trous.
2. Vérifier le prolongement arrière si le surplomb de toit l’exige.

Résultat attendu:

1. Les trous traversent correctement.
2. La logique dovetail reste cohérente.

### F3. Export receiver

Étapes:

1. Exporter la pièce femelle.

Résultat attendu:

1. Le fichier téléchargé correspond à la pièce murale femelle seulement si c’est la règle produit actuelle.

## Bloc G: Librairie publique et admin

### G1. Vue publique

Étapes:

1. Ouvrir la librairie publique.
2. Vérifier les cartes et miniatures.
3. Ouvrir une preview STL.

Résultat attendu:

1. La liste charge.
2. Les miniatures s’affichent.
3. La preview s’ouvre.

### G2. Vue admin

Étapes:

1. Ouvrir l’admin librairie.
2. Vérifier les cartes d’items.
3. Vérifier l’édition de miniature STL si disponible.

Résultat attendu:

1. L’UI reste propre.
2. Aucun texte technique indésirable n’apparaît.

## Bloc H: Auth, compte, tickets

### H1. Compte utilisateur

Étapes:

1. Login.
2. Ouvrir le compte.
3. Vérifier statut, crédits, historique.

Résultat attendu:

1. L’état compte reste lisible.
2. Les onglets du compte fonctionnent.

### H2. Tickets

Étapes:

1. Créer un ticket.
2. Ouvrir le détail.
3. Ajouter une réponse.

Résultat attendu:

1. Le ticket se crée.
2. Le détail s’affiche.
3. La réponse est enregistrée.

### H3. Admin login

Étapes:

1. Ouvrir le login admin.
2. Se connecter.
3. Ouvrir le dashboard.

Résultat attendu:

1. Le chemin admin reste bon.
2. Le dashboard s’affiche correctement.

## Bloc I: Pages publiques PHP

### I1. Routes principales

Étapes:

1. Ouvrir `/`
2. Ouvrir `/pricing`
3. Ouvrir `/about`
4. Ouvrir `/contact`
5. Ouvrir `/terms`
6. Ouvrir `/legal`

Résultat attendu:

1. Chaque page répond.
2. Le look and feel reste cohérent.

## Bloc J: I18n

### J1. Vérification bilingue minimale

Étapes:

1. Ouvrir une surface publique en `fr`.
2. Ouvrir la même en `en`.
3. Ouvrir l’app en `fr`.
4. Ouvrir l’app en `en`.

Résultat attendu:

1. Pas de clé brute affichée.
2. Pas de mélange de copies divergentes visibles.

## Matrice d’usage par phase

### Phase 1

Exécuter:

1. Bloc A
2. Bloc B

### Phase 2

Exécuter:

1. Bloc C3
2. Bloc G1
3. Bloc G2

### Phase 3

Exécuter:

1. Bloc A
2. Bloc B
3. Bloc C
4. Bloc D
5. Bloc H1

### Phase 4

Exécuter:

1. Bloc A
2. Bloc B
3. Bloc C
4. Bloc D
5. Bloc F
6. Bloc J

### Phase 5

Exécuter:

1. Bloc E
2. Bloc G
3. Bloc H
4. Bloc I

### Phase 6

Exécuter:

1. Bloc G2
2. Bloc H3

### Phase 7

Exécuter:

1. Bloc A
2. Bloc G
3. Bloc H3
4. Bloc I

### Phase 8

Exécuter:

1. Bloc A2
2. Bloc I1
3. Bloc J

## Format de journal de vérification

Après une phase, noter:

1. phase exécutée
2. blocs de checklist exécutés
3. résultat par bloc: `ok`, `ko`, `non vérifié`
4. régression connue
5. prochain plus petit pas sûr
