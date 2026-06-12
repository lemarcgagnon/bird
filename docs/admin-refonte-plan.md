# Admin refonte - plan

Date: 2026-06-12

Role: ordre de travail pour terminer la refonte `/admin` sans repartir dans un spaghetti visuel. Ce plan suit `docs/admin-hig.md`.

## Priorite de travail

### 1. Logs

Objectif: finir la conversion "metier d abord, technique ensuite".

Reste a faire:

- franciser les derniers labels de formulaire encore mixtes (`Channel`, `Issue audit`);
- verifier si certaines colonnes techniques doivent passer en vue detail ou rester inline;
- eventuellement ajouter une vue detail pour les contextes/JSON longs;
- verifier la tenue mobile des tables logs.

Definition of done:

- la lecture primaire des logs se fait sans connaitre les codes backend;
- le code technique reste disponible sans encombrer le scan;
- les filtres et tables parlent le meme langage metier.

### 2. Responsive admin

Objectif: verifier que la nouvelle hierarchie HIG tient sur petites largeurs.

Reste a faire:

- tester `Support`, `Clients`, `Billing`, `Exports`, `Logs`, `Reglages` en largeur reduite;
- verifier grilles de filtres, tables, modals et tabs;
- corriger les tables qui doivent passer en lecture plus compacte.

Definition of done:

- aucun bloc important ne casse la lecture mobile;
- aucun modal detail n oblige a scroller horizontalement de facon incoherente;
- la hierarchie reste visible sur ecrans compacts.

### 3. Reglages

Objectif: separer clairement l infra et les actions a risque.

Sous-domaines a clarifier:

- `Base de donnees`
- `SMTP`
- `Stripe`

Reste a faire:

- donner a chaque sous-domaine son propre resume;
- separer config, test et enregistrement;
- mieux isoler les messages de succes/erreur;
- verifier la charge cognitive des formulaires longs;
- preparer le terrain pour un futur script d install cPanel.

Definition of done:

- chaque bloc de reglage peut etre lu et utilise sans confusion;
- les actions de test ne ressemblent pas aux actions definitives;
- les secrets et prerequis sont exposes proprement.

### 4. Clients

Objectif: rendre la gestion client plus scannable et moins dense.

Reste a faire:

- reduire les actions concurrentes dans la fiche client;
- verifier la tenue mobile du modal detail;
- eventuellement separer encore mieux les actions de profil, compte et danger.

Definition of done:

- la fiche client se lit en blocs metier nets;
- les actions dangereuses sont isolees;
- la liste clients est exploitable sans fatigue excessive.

### 5. Support

Objectif: faire une passe de finition plutot qu une reconstruction.

Reste a faire:

- affiner badges statut/priorite/assignation;
- verifier la tenue mobile du fil et des formulaires;
- verifier l ergonomie du fil complet;
- confirmer que l ouverture detail ticket ne sort jamais du domaine `Support`.

Definition of done:

- la file support est stable, claire, et rapide a parcourir.

## Chantiers transverses

### A. Libelles metier

Creer des helpers partages pour:

- statuts utilisateurs;
- statuts abonnements;
- statuts paiements;
- issues audit;
- statuts Stripe.
- types d export;
- channels et events applicatifs courants.

But:

- eliminer l affichage brut des valeurs backend dans l admin.

### B. Badges et semantique visuelle

Consolider:

- tons de badges;
- usage des compteurs;
- resume de filtres actifs;
- sections avec texte d orientation court.

### C. Responsive / mobile

Verifier:

- rupture des grilles de filtres;
- lisibilite des tabs;
- tables larges;
- modals.

### D. Documentation

Mettre a jour au fur et a mesure:

- `docs/admin-hig.md`
- `docs/admin-refonte-etat.md`
- `docs/admin-refonte-plan.md`

## Risques a surveiller

- faire trop de CSS specifique a une section et casser la coherence;
- laisser des filtres actifs sans effet visible;
- multiplier les modals sans hierarchie claire;
- melanger reformulation UI et logique metier sans helper partage.

## Ordre recommande

1. finir `Logs`
2. faire la revue responsive admin
3. polir `Reglages`
4. polir `Clients`
5. terminer `Support`
6. reprendre les chantiers transverses
