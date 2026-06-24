# Contrat de non-régression du refactoring

## Point d’entrée obligatoire pour toute reprise

Si tu reprends le refactoring sur une nouvelle session, commence ici.

### Ordre de lecture obligatoire avant toute action

Lis les documents et fichiers dans cet ordre exact:

1. `docs/refactoring-plan.md`
2. `docs/refactoring-non-regression-contract.md`
3. `docs/refactoring-smoke-checklist.md`
4. `docs/refactoring-progress-log.md`
5. les fichiers réels de code ciblés par la phase choisie

### Règle de lecture des fichiers ciblés

1. Ne pas lire partiellement un gros fichier ciblé puis extrapoler.
2. Lire entièrement chaque fichier réellement touché par la phase.
3. Ne pas commencer à éditer avant d’avoir listé les fichiers exacts à toucher.
4. Ne pas élargir le périmètre en cours de route sans le noter dans le log de progression.

### Ce que l’agent doit annoncer avant de modifier quoi que ce soit

1. la phase exacte
2. le sous-scope exact
3. les fichiers exacts à toucher
4. les invariants concernés dans ce document
5. les blocs de smoke test à exécuter après la phase

### Source de vérité en cas de doute

1. `docs/refactoring-plan.md` dit quoi faire et dans quel ordre
2. `docs/refactoring-non-regression-contract.md` dit ce qui ne doit pas être cassé
3. `docs/refactoring-smoke-checklist.md` dit quoi vérifier
4. `docs/refactoring-progress-log.md` dit ce qui a déjà été fait ou reste risqué

Si un de ces documents contredit un autre, l’agent doit arrêter, noter la contradiction dans le log, puis corriger la documentation avant de continuer le refactoring.

## But

Ce document fixe ce qui ne doit pas être cassé pendant le refactoring. Le refactoring peut déplacer du code, renommer des modules internes, et réduire la taille des fichiers. Il ne peut pas changer silencieusement le comportement produit.

## Règle générale

Toute phase de refactoring doit préserver:

1. les mêmes capacités produit
2. les mêmes chemins publics et admin
3. les mêmes règles de billing et d’autorisation
4. les mêmes invariants de géométrie et d’export
5. le même contrat de base pour les données persistées

## Invariants surface par surface

### 1. App WASM: shell, navigation, état

Invariants:

1. L’application continue à se rendre depuis les paramètres par défaut sans panneau vide ni action principale manquante.
2. Les onglets principaux restent accessibles et changent de contenu correctement.
3. Le changement `fr` / `en` continue à fonctionner.
4. Le thème reste appliqué correctement.
5. Le viewer 3D continue à se monter, se redimensionner et se remettre en vue sans recréations parasites à chaque interaction.

Interdits:

1. Déplacer des boutons par chirurgie DOM après rendu si le shell Rust peut les rendre au bon endroit.
2. Introduire une seconde source de vérité pour l’état courant de l’app.

### 2. Paramètres métier et géométrie nichoir

Invariants:

1. Les paramètres par défaut restent valides et sérialisables.
2. Le calcul résumé, le calcul de stats et le calcul de layout continuent à répondre sur la même base métier.
3. Les panneaux principaux restent générables: façade, arrière, côtés, toit, plancher, perchoir, porte selon options.
4. Les modes de plancher, de faîtage, de porte et d’unités continuent à produire un résultat cohérent.

Interdits:

1. Changer silencieusement les plages de clamp métier.
2. Changer les formules de géométrie sous prétexte de découpage de fichier.

### 3. Decor: SVG, image, STL importé

Invariants:

1. L’import SVG reste possible et continue à être filtré/sanitisé.
2. L’import image relief reste possible avec ses modes et sa logique de preview.
3. L’import STL reste possible sans limite artificielle côté client si c’est la règle produit actuelle.
4. Le décor reste supprimable et remplaçable proprement.
5. La preview ne doit pas mentir sur l’export final.

Interdits:

1. Dupliquer la logique STL preview dans plusieurs fichiers.
2. Casser la suppression/réinitialisation du décor actif.

### 4. Décor fusionné, boring entrée, manifold

Invariants:

1. Le décor exporté doit être effectivement fusionné au panneau/volume cible quand c’est le comportement prévu.
2. Le boring de l’entrée continue à traverser le décor lorsqu’il empiète sur la zone d’entrée.
3. Cette opération ne doit pas créer volontairement de maillage ouvert ou non-manifold.
4. Le mesh report continue à pouvoir signaler les cas invalides.

Interdits:

1. Préserver visuellement un décor en preview mais l’oublier dans l’export final.
2. Laisser une différence structurelle connue entre preview et export sans le documenter explicitement.

### 5. Wall mount universel

Invariants:

1. Le mâle reste fusionné à la paroi arrière du nichoir quand activé.
2. La femelle reste exportable séparément lorsqu’elle doit l’être.
3. Le système mâle/femelle reste basé sur le principe dovetail avec tolérance cohérente.
4. Les trous de la femelle restent traversants et alignés selon la logique mécanique actuelle.
5. Les options liées au recul, au surplomb de toit, à la plaque, au col, au biseau et au standoff restent disponibles si elles existent aujourd’hui.

Interdits:

1. Réintroduire un kit téléchargeable incohérent avec la logique produit actuelle.
2. Casser la fusion du mâle dans la paroi arrière opposée au trou d’entrée.

### 6. Exports et téléchargements

Invariants:

1. Les exports maison STL/OBJ, panneaux ZIP, plan PDF/PNG/SVG et diagnostic continuent à exister selon les surfaces actuelles.
2. Les niveaux de qualité du STL décor restent disponibles si exposés à l’utilisateur.
3. Le téléchargement répété du même produit déjà acquis doit continuer à respecter la règle de non double débit prévue.
4. Les exports admin sans débit continuent à être séparés des exports client.

Interdits:

1. Changer un code produit ou un type d’export sans mise à jour coordonnée côté backend et frontend.
2. Débiter à l’autorisation au lieu du consume si la règle actuelle est debit on consume.

### 7. Billing, crédits et entitlements

Invariants:

1. La quote reste informative.
2. L’autorisation ne doit pas consommer le crédit.
3. Le consume reste l’endroit du débit effectif.
4. Les règles de repeat/free entitlement déjà implémentées doivent rester stables.
5. Les bypass admin restent hors débit.
6. Les écritures de ledger restent cohérentes avec les actions facturables.

Interdits:

1. Mélanger logique de prix affiché et logique de débit réel sans source de vérité unique.
2. Casser le lien entre fingerprint, authorization et consume.

### 8. Librairie publique et admin

Invariants:

1. Les items de librairie continuent à se lister côté public et admin.
2. Les miniatures continuent à se rendre.
3. Les previews STL continuent à s’ouvrir.
4. Les téléchargements autorisés continuent à respecter les règles de coût et de rôle.
5. Les réglages de limites et chemins de stockage continuent à être modifiables depuis l’admin si c’est le comportement actuel.

Interdits:

1. Réintroduire des textes techniques bruts non désirés dans l’UI admin.
2. Casser la distinction entre originaux privés et copies locales d’aperçu.

### 9. Auth, compte et tickets

Invariants:

1. Inscription, activation, login, logout et lecture du profil continuent à fonctionner.
2. L’état de session admin et client reste distinct.
3. Les tickets continuent à pouvoir être listés, ouverts et répondus selon les règles actuelles.
4. Le compte utilisateur continue à afficher état, crédits et historique attendus.

Interdits:

1. Déplacer des appels auth dans des modules UI sans garder un wrapper API unique.
2. Créer une seconde logique de session côté navigateur.

### 10. Routing PHP et chemins publics

Invariants:

1. Les URLs publiques existantes restent identiques.
2. Le chemin admin configuré reste identique.
3. Les endpoints API existants restent identiques.
4. Le webhook Stripe garde le même chemin.

Interdits:

1. Casser un chemin pour “nettoyer l’architecture”.
2. Changer le comportement d’un endpoint parce que sa route a été déplacée de fichier.

### 11. I18n et copie

Invariants:

1. `fr` reste la langue de référence produit.
2. `en` reste disponible sur les surfaces déjà traduites.
3. Une clé affichée publiquement doit exister dans les deux langues si la surface est bilingue.

Interdits:

1. Laisser dériver les clés entre Rust, JS et PHP.
2. Ajouter du texte visible hardcodé dans un module qui n’est pas propriétaire de la copie.

### 12. CSS et HIG/UX

Invariants:

1. Le look and feel actuel ne doit pas être cassé par le découpage des styles.
2. Les regroupements de contrôles et panneaux doivent rester lisibles.
3. Les focus keyboard utiles doivent rester visibles.
4. Les pages publiques ne doivent pas récupérer du style admin parasite, et inversement.

Interdits:

1. Mélanger des domaines UI sans ownership clair.
2. Introduire une régression visuelle majeure sous prétexte de modulariser.

## Contrat de persistance

Le refactoring ne doit pas casser silencieusement:

1. les formats JSON échangés entre frontend et backend
2. les noms de paramètres essentiels
3. les clés de session utilisées par les autorisations admin
4. les conventions de stockage de la librairie
5. les structures attendues par l’admin reporting et le ledger

## Contrat de reprise de session

Avant toute reprise:

1. relire entièrement `docs/refactoring-plan.md`
2. relire entièrement ce document
3. relire entièrement `docs/refactoring-smoke-checklist.md`
4. relire entièrement `docs/refactoring-progress-log.md`
5. lire entièrement les fichiers de code réellement ciblés par la phase
6. annoncer la phase exacte
7. annoncer les fichiers exacts touchés
8. annoncer quels invariants ci-dessus sont concernés
9. annoncer quels blocs de smoke test seront exécutés

## Contrat de clôture de phase

Avant de considérer une phase terminée, l’agent doit écrire dans `docs/refactoring-progress-log.md`:

1. la phase traitée
2. les fichiers touchés
3. l’ownership réellement déplacé
4. les invariants préservés
5. les blocs de smoke test exécutés
6. les points non vérifiés
7. les risques résiduels
8. le prochain plus petit pas sûr

## Critère de refus

Un refactoring doit être stoppé si le changement proposé:

1. déplace du code sans clarifier l’ownership
2. crée une duplication durable
3. modifie un invariant produit sans le dire
4. empêche de vérifier manuellement le comportement plus facilement qu’avant
