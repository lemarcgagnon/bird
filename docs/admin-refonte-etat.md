# Admin refonte - etat

Date: 2026-06-12

Role: photo concrete du chantier back-office PHP. Ce document decrit ce qui a deja ete fait sur `/admin`, ce qui a change cote architecture/UI, et les points encore imparfaits mais identifies.

## Objectif

Transformer `/admin` en vrai back-office par domaines, avec:

- separation claire des sections;
- details ouverts au bon endroit;
- filtres comprehensibles;
- exports et logs exploitables;
- base plus saine pour le deploiement cPanel/MySQL.

## Ce qui est fait

### 1. Separation du back-office par domaines

`/admin` est maintenant structure autour des onglets:

- `Support`
- `Clients`
- `Billing`
- `Exports`
- `Logs`
- `Reglages`

Le detail ticket n est plus rendu dans la fiche client. Le detail client s ouvre dans un modal et reste rattache au bon onglet.

### 2. Tickets / support

Le systeme ticket est maintenant en version produit exploitable:

- creation ticket cote client;
- liste tickets cote client;
- fil complet ticket/messages;
- reponse client;
- reponse admin;
- statut `open/closed`;
- priorite;
- assignation;
- notifications tickets journalisees dans `ticket_notifications`;
- envoi SMTP configurable depuis `/admin > Reglages`.

### 3. Email activation / auth

Le compte utilisateur passe par activation email:

- inscription cree un compte `pending`;
- code d activation email envoye via SMTP;
- activation par code;
- renvoi de code;
- limitation auth par IP/email;
- quota email activation;
- blocage temporaire apres essais invalides.

### 4. Logs applicatifs

Le systeme de logs a ete ajoute et branche:

- tables `app_logs`, `audit_logs`, `stripe_event_logs`;
- logger PHP central;
- hash IP/courriel;
- endpoint `/api/client-log` pour erreurs navigateur/WASM;
- trace auth, tickets, emails, exports, admin, Stripe;
- slow request / shutdown logging.

### 5. Onglet Logs refondu HIG

`/admin > Logs` a recu une vraie refonte d exploitation:

- portee par domaine: `Toutes / Application / Audit / Stripe`;
- resume en tete;
- filtres rapides;
- filtres avances repliables;
- badges d etat;
- export filtre en `CSV`, `Excel compatible .xls`, `JSON`, `SQL`;
- separation explicite des alertes.

Limitation connue:

- la vue alertes est meilleure, mais la taxonomie des events reste encore perfectible.

### 6. Billing admin

Le billing admin n est plus une simple liste brute:

- filtres avances serveur;
- recherche client/ID/description;
- filtre abonnement/paiement;
- filtre statut, provider, devise, facture, montant, dates;
- conservation du contexte billing lors de l ouverture d un client;
- refonte HIG recente avec:
  - portee `Tout / Abonnements / Paiements`;
  - resume en tete;
  - filtres rapides puis avances;
  - badges d etat dans les tableaux;
  - champs a options passes en `select` quand possible.

### 7. Exports admin

Exports admin disponibles:

- base de donnees par portee;
- `CSV`
- `Excel compatible .xls`
- `JSON`

Logs admin:

- `CSV`
- `Excel compatible .xls`
- `JSON`
- `SQL`

### 8. Soft-delete / archivage utilisateur

Suppression admin remplacee par archivage:

- abandon du hard delete;
- statut utilisateur archive;
- `deleted_at`;
- sessions revoquees;
- autorisations d export ouvertes revoquees;
- tickets ouverts fermes;
- UI admin adaptee a l archivage.

### 9. Reglages infra

`/admin > Reglages` permet deja:

- config SMTP cPanel;
- test email;
- config DB cPanel/MySQL;
- test connexion DB;
- creation schema MySQL si base vide;
- config Stripe checkout/portail/webhook.

## Dette / limites connues

### Billing

La seconde passe "avocat du diable" a releve des points encore ouverts:

1. Certains filtres visibles peuvent rester actifs alors qu ils n influencent pas la portee courante.
   - exemple: `Etat abonnement` reste visible en vue `Paiements`.

2. Les libelles d etat sont encore trop techniques.
   - exemple: `active`, `paid`, `pending`, `none`, `canceled`.

3. Les cartes resume billing ne sont pas encore totalement centrees sur la portee active.

### Clients

- repertoire encore trop brut;
- actions encore denses dans la fiche client;
- terminologie abonnement/statut pas encore harmonisee partout;
- quelques `Ouvrir` restent visibles hors modal-first ideal.

### Exports

- surface fonctionnelle, mais encore trop utilitaire;
- manque de hierarchie visuelle;
- manque de distinction nette entre export base et historique d autorisations.

### Reglages

- bon fond technique, mais la presentation reste trop formulaire-centric;
- DB, SMTP et Stripe meritent une separation visuelle plus nette;
- les actions de test/enregistrement doivent etre encore mieux groupees.

### Securite / prod

Toujours ouverts avant prod:

- CSRF admin;
- vraie auth admin sans `key` en query string;
- CSP;
- retention/rotation logs;
- rate limit tickets/webhooks;
- script package/install cPanel.

## Regle de lecture

Ce document dit ce qui est reellement implemente ou explicitement connu.

Pour la suite du chantier, voir `docs/admin-refonte-plan.md`.
