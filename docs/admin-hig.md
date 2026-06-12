# Admin HIG

Role: conventions de refonte pour le back-office PHP. Ce document fixe les regles UI a reappliquer sur `Support`, `Clients`, `Billing`, `Exports`, `Logs` et `Reglages`.

## Objectif

Faire de `/admin` un outil d'exploitation lisible, stable et peu fatigant a utiliser. Le back-office ne doit pas ressembler a une fiche geante melangeant listes, details, actions et configuration dans un seul flux visuel.

## Principes

### 1. Domaines separes

- Un onglet = un domaine metier principal.
- Une section ne doit pas afficher ou modifier un autre domaine sans raison forte.
- Exemple: `Support` gere la file, le fil et les actions ticket; la fiche client ne doit pas y etre rendue inline.

### 2. Liste d abord, detail ensuite

- Les vues d ensemble restent dans des listes ou tableaux.
- Le detail d un client, ticket ou paiement s ouvre dans un modal ou une vue detail dediee.
- Un clic sur l element principal d une ligne doit ouvrir le detail; on evite les boutons `Ouvrir` repetes partout.

### 3. Progressive disclosure

- Montrer d abord les actions et filtres les plus frequents.
- Ranger les filtres rares ou techniques dans un bloc repliable.
- Ne jamais afficher 15 champs de filtre d un coup si 4 suffisent pour 80 % des cas.

### 4. Navigation et contexte stables

- L onglet actif reste visible.
- Ouvrir un modal ne doit pas faire perdre le contexte du domaine d origine.
- Retour, fermeture et liens internes doivent ramener a la bonne section avec les bons filtres.

### 5. Hierarchie visuelle claire

- Chaque panneau commence par un titre court, suivi d une phrase d orientation si necessaire.
- Les chiffres cles apparaissent dans des stats ou badges en tete de section.
- Les actions secondaires ne doivent pas rivaliser visuellement avec l action principale.

### 6. Etats lisibles sans lecture lourde

- Les statuts, priorites et issues utilisent des badges coherents.
- La couleur ne doit jamais etre le seul signal; il faut aussi un mot ou une forme.
- Les tableaux doivent permettre un scan rapide par colonnes clefs: date, type, statut, cible, acteur.

### 7. Filtres structures

- Les filtres rapides visibles couvrent le cas courant: recherche, periode, portee, limite, statut principal.
- Les filtres avances sont ranges ensemble.
- Les filtres actifs doivent etre resumables visuellement.

### 8. Actions groupees par intention

- Consultation, edition, export et danger ne doivent pas etre melanges.
- Les actions destructives ou irreversibles sont isolees visuellement et verbalement.
- Les boutons d export restent dans le domaine qui produit les donnees.

### 9. Tables et densite

- Une table sert a comparer et scanner.
- On evite d y mettre des paragraphes longs ou des formulaires inline.
- Les contenus verbeux, JSON, traces ou historiques complets vont dans un detail, un modal ou un export.

### 10. Terminologie stable

- Toujours reutiliser les memes mots pour un meme concept.
- Exemple: `Archive` pour le soft-delete utilisateur, `Issue` ou `Resultat` pour l outcome d audit, `Statut` pour l etat courant.

## Patterns obligatoires pour ce projet

### Onglets admin

- `Support`
- `Clients`
- `Billing`
- `Exports`
- `Logs`
- `Reglages`

Chaque onglet doit avoir:

- une vue d apercu utile immediatement;
- une action principale claire;
- un chemin detail non ambigu.

### Modals admin

Utiliser un modal quand:

- on ouvre une fiche client;
- on ouvre le detail d un ticket;
- on consulte un paiement ou un abonnement;
- on lit un contexte de log ou une payload plus longue.

Le modal doit:

- avoir un titre metier net;
- separer les sous-sections par tabs internes seulement si le detail est reellement large;
- conserver une URL de fermeture ramenant au bon onglet et aux bons filtres.

### Filtres

Ordre recommande:

1. Portee ou source
2. Recherche libre
3. Statut principal
4. Periode
5. Limite
6. Filtres avances

### Exports

- Les exports doivent respecter le filtre courant quand c est pertinent.
- Les formats visibles doivent etre limites a ceux supportes proprement par le codebase.
- Pour l instant, `Excel` signifie `.xls` compatible HTML, pas `.xlsx`.

## Anti-patterns a eviter

- une fiche client geante collee sous la liste clients;
- un tableau obligeant a cliquer `Ouvrir` sur chaque ligne;
- des actions dangereuses dans le meme bloc visuel que les actions courantes;
- des onglets vides ou purement placeholders sans explication;
- des pages qui obligent a lire tout le texte pour comprendre l etat;
- des sections qui fuient dans d autres domaines metier.

## Etat courant

Deja aligne sur ces principes:

- `Logs`: portee par domaine, filtres rapides/avances, badges d etat, export filtre, alertes separees.
- `Support`: base fonctionnelle separee du detail client.
- `Clients`: detail en modal et clic direct depuis les listes.

A revoir ensuite avec cette grille:

1. `Support`
2. `Clients`
3. `Billing`
4. `Exports`
5. `Reglages`

## Regle d evolution

Toute nouvelle surface admin doit etre relue contre ce document avant merge:

- domaine correct;
- detail au bon endroit;
- charge cognitive acceptable;
- etats scannables;
- actions groupees proprement;
- contexte preserve.
