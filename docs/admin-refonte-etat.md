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
- separation explicite des alertes;
- tables relues en version metier d abord:
  - source, evenement, role, action et cible avec libelle lisible;
  - code technique conserve en second niveau pour le diagnostic;
  - niveaux localises (`Info`, `Securite`, `Erreur`, `Critique`);
  - tables renommee es en FR (`Source`, `Evenement`, `Trace`, `Contexte`).

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

La surface `Exports` a aussi ete relue cote HIG:

- cartes d export par portee metier;
- distinction claire entre export de base et historique d autorisations;
- tableau des autorisations recentes avec badges d etat;
- types d export localises (`Modele STL`, `Plan PDF`, `Archive ZIP`, `Vectoriel SVG`, `Image PNG`);
- code technique conserve en second niveau.

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

Le gros de la dette HIG billing est ferme:

- filtres hors portee retires de la vue et du resume;
- statuts techniques remplaces par des libelles metier;
- cartes resume recentrees selon la portee active.

Reste surtout:

- verification responsive/mobile;
- eventuel detail paiement dedie si la profondeur billing augmente.

### Clients

- repertoire maintenant scannable avec badges et ouverture directe via ID/courriel;
- modal client garde ses sous-domaines separes (`Profil`, `Credits`, `Billing`, `Exports`);
- statuts et plans sont harmonises dans les surfaces principales.

Reste surtout:

- reduire encore la densite de certaines actions dans la fiche client;
- verifier le comportement mobile du modal detail.

### Exports

- la hierarchie visuelle est maintenant nette entre export de base et autorisations recentes.

Reste surtout:

- verifier la lisibilite mobile des cartes d export et des tableaux larges;
- eventuellement ouvrir une vue detail si les autorisations deviennent plus nombreuses.

### Reglages

- DB, SMTP et Stripe sont separes en sous-domaines clairs avec resume, configuration et test.

Reste surtout:

- verifier la charge cognitive mobile des longs formulaires;
- clarifier encore certains messages techniques de succes/erreur si l exploitation devient plus frequente.

### Support

- la file tickets est maintenant plus directe:
  - clic sur `#ticket` pour ouvrir le detail;
  - priorites et statuts localises;
  - detail ticket garde le contexte support;
  - plus de bouton `Ouvrir` redondant dans la file.

Reste surtout:

- verifier la tenue mobile du fil et des formulaires admin;
- eventuellement normaliser encore plus l assignation et les infos de contexte.

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
