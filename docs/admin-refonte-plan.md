# Admin refonte - plan

Date: 2026-06-12

Role: ordre de travail pour terminer la refonte `/admin` sans repartir dans un spaghetti visuel. Ce plan suit `docs/admin-hig.md`.

## Priorite de travail

### 1. Billing

Objectif: terminer proprement la passe HIG deja entamee.

Reste a faire:

- masquer ou desactiver les filtres non pertinents selon la portee;
- remplacer les statuts techniques par des libelles metier coherents;
- recentrer les cartes resume sur la portee active;
- verifier le comportement mobile;
- eventuellement ouvrir detail paiement dans un modal dedie.

Definition of done:

- aucun filtre visible ne ment sur son effet;
- aucun statut brut type `paid` ou `active` n apparait tel quel;
- la vue `Paiements` et la vue `Abonnements` ont chacune une lecture evidente.

### 2. Exports

Objectif: transformer une surface utilitaire en surface de travail claire.

Reste a faire:

- distinguer `exports de base` et `autorisations recentes`;
- ajouter un resume simple des portees exportables;
- rendre les formats plus lisibles et mieux groupes;
- verifier que chaque table a une action principale claire;
- reduire la lecture verticale inutile.

Definition of done:

- l utilisateur comprend tout de suite quoi exporter et pourquoi;
- les actions par format sont regroupees proprement;
- les autorisations recentes ne noient pas les exports de base.

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

- harmoniser les libelles statut/abonnement;
- reduire les actions concurrentes dans la fiche client;
- mieux grouper profil, credits, billing, exports et historique;
- verifier s il reste des patterns `Ouvrir` inutiles;
- affiner les etats archive/suspendu/actif.

Definition of done:

- la fiche client se lit en blocs metier nets;
- les actions dangereuses sont isolees;
- la liste clients est exploitable sans fatigue excessive.

### 5. Support

Objectif: faire une passe de finition plutot qu une reconstruction.

Reste a faire:

- verifier le scan rapide de la file de tickets;
- affiner badges statut/priorite/assignation;
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

1. finir `Billing`
2. refaire `Exports`
3. refaire `Reglages`
4. polir `Clients`
5. terminer `Support`
6. reprendre les chantiers transverses
