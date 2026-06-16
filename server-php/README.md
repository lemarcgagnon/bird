# Nichoir PHP backend local/cPanel

Backend PHP pour tester compte, credits, billing Stripe, autorisation de telechargement et tickets. SQLite reste le mode local par defaut; MySQL est supporte pour cPanel.

Ce dossier est aussi la base cible du futur site PHP complet:

- landing page publique `/`;
- page prix/offres `/pricing`;
- espace client `/account`;
- admin prive `/admin`;
- API JSON `/api/...`;
- webhook Stripe `/stripe/webhook`.

L'app Rust/WASM reste sous `/app/` et continue de generer localement les plans/STL/ZIP.

## Structure

- `public/`: document root PHP, routeur HTTP et CSS site. Voir `public/README.md`.
- `src/`: logique PHP comptes, auth, pages, API helpers et webhook. Voir `src/README.md`.
- `migrations/`: schema SQLite versionne. Voir `migrations/README.md`.
- `data/`: base SQLite locale et config DB locale ignoree par Git. Voir `data/README.md`.

Etat actuel:

- `/`, `/pricing`, `/account` et `/admin` sont routes par PHP.
- `/admin` affiche deja les clients et autorisations recents depuis SQLite.
- `/admin` contient maintenant un repertoire utilisateurs avec recherche, filtres et pagination.
- `/admin` permet de creer un utilisateur, modifier profil/courriel/statut/credits, reset le mot de passe et supprimer un compte avec confirmation.
- `/admin` permet aussi de modifier manuellement le statut d'abonnement serveur et de configurer Stripe Checkout/portail/webhook.
- La fiche client affiche historique credits, abonnements, paiements, exports, tickets, fil de messages et audit admin.
- `/account` permet maintenant login/register/logout, activation par code email, edition profil, affichage credits, historique credits, abonnement, paiements/factures Stripe, creation/liste de tickets, fil de messages, reponses client et changement open/closed.
- `/admin` permet de repondre aux tickets, changer open/closed, definir priorite et assignation, configurer SMTP cPanel et tester l'envoi email.
- `/admin` > `Reglages` permet aussi de configurer/tester les coordonnees DB cPanel/MySQL. Enregistrer cree le schema MySQL si la base est vide.
- `/admin` > `Exports` permet d'exporter la base en CSV, Excel compatible `.xls` ou JSON par portee: base complete, clients, billing, support, credits ou autorisations.
- `/admin` > `Logs` affiche alertes, logs applicatifs, audit actions et evenements Stripe avec filtres niveau/channel/event/recherche.
- `app_logs`, `audit_logs` et `stripe_event_logs` tracent erreurs, securite, actions importantes, emails, tickets, exports, auth et webhooks sans stocker mots de passe, tokens ou secrets.
- Les notifications tickets sont journalisees dans `ticket_notifications`, puis envoyees immediatement via SMTP si l'envoi est active.
- `GET /api/credits/ledger` retourne l'historique credits du client connecte.
- `GET /api/billing/summary` retourne l'abonnement courant et les paiements synchronises du client connecte.
- `POST /api/checkout/stripe-link` cree une session Checkout Stripe reelle si Stripe est configure.
- `POST /api/billing/portal` cree une session portail client Stripe.
- `/stripe/webhook` verifie `Stripe-Signature` quand un webhook secret est configure, journalise `stripe_events` et `stripe_event_logs`, traite `checkout.session.completed`, `invoice.*` et les evenements `customer.subscription.*`.
- En local, `/admin` est accessible pour le dev. En production, definir `NICHOIR_ADMIN_KEY`.
- CORS est limite par `NICHOIR_CORS_ORIGINS` (`http://127.0.0.1:8016` par defaut en dev).
- Les payloads JSON sont limites a `256 KiB`; offres checkout, types d'export, tickets, profil et mots de passe sont valides cote serveur.
- `POST /api/exports/consume` reverifie le statut du compte et le solde avant debit.

Secrets Stripe:

- Preferer `NICHOIR_STRIPE_SECRET_KEY` et `NICHOIR_STRIPE_WEBHOOK_SECRET` en production.
- Si ces variables ne sont pas definies, `/admin` peut stocker les secrets dans SQLite pour un deploiement simple.
- Les price IDs `credits`, `atelier` et `pro` se configurent dans `/admin`.

Base de donnees:

- Local/dev: SQLite utilise `server-php/data/nichoir.sqlite`.
- cPanel: creer une base MySQL et un utilisateur dans cPanel, puis entrer host/base/user/password dans `/admin` > `Reglages` > `Base de donnees`.
- Les valeurs enregistrees sont ecrites dans `server-php/data/db-config.php`, ignore par Git.
- Le verrou `server-php/data/installed.lock.php` est ecrit par l installateur temporaire, ignore par Git, et bloque une seconde installation.
- Les variables serveur `NICHOIR_DB_DRIVER`, `NICHOIR_DB_HOST`, `NICHOIR_DB_PORT`, `NICHOIR_DB_NAME`, `NICHOIR_DB_USER`, `NICHOIR_DB_PASSWORD`, `NICHOIR_DB_CHARSET` surchargent le fichier local.

Logs:

- `NICHOIR_LOG_HASH_SALT` doit etre defini en production pour hasher IP/courriels de facon stable sans exposer les valeurs brutes.
- `NICHOIR_SLOW_REQUEST_MS` controle le seuil `slow_request` via shutdown handler PHP (`1500` ms par defaut, `0` pour desactiver).
- `POST /api/client-log` recoit les erreurs navigateur/WASM et applique un rate limit de 10 logs/minute par user ou IP.

Deploiement cPanel:

- document root recommande: `server-php/public`;
- garder `src/`, `data/` et `migrations/` hors du web public;
- creer la base MySQL et l'utilisateur dans cPanel avant de basculer le driver;
- utiliser `Tester connexion` dans `/admin` > `Reglages` > `Base de donnees`;
- utiliser `Enregistrer DB` seulement quand le test passe; le schema MySQL est cree automatiquement si la base est vide;
- si le document root reste sur la racine du projet, garder le `.htaccess` versionne pour router vers `server-php/public` et bloquer les dossiers sensibles;
- l'installateur temporaire est `installation/index.php`: il initialise la DB, ecrit `server-php/data/db-config.php` si besoin, peut enregistrer le SMTP de base et pose `server-php/data/installed.lock.php`;
- apres installation, supprimer le dossier `installation/` du serveur et definir `NICHOIR_ADMIN_KEY`;
- ne jamais committer `server-php/data/db-config.php`.

## Demarrer

```bash
cd /home/marc/Documents/nichoir16
php -S 127.0.0.1:8021 -t server-php/public
```

## Endpoints

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/activate`
- `POST /api/auth/resend-activation`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/profile`
- `GET /api/credits/ledger`
- `GET /api/billing/summary`
- `POST /api/checkout/stripe-link`
- `POST /api/billing/portal`
- `POST /api/exports/authorize`
- `POST /api/exports/consume`
- `GET /api/tickets`
- `POST /api/tickets`
- `GET /api/tickets/{id}`
- `POST /api/tickets/{id}/messages`
- `POST /api/tickets/{id}/status`
- `POST /api/client-log`
- `POST /stripe/webhook`

## Test rapide

```bash
curl http://127.0.0.1:8021/api/health
```

```bash
curl -X POST http://127.0.0.1:8021/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@nichoir.local","password":"password123"}'
```

`POST /api/auth/register` cree un compte `pending` et envoie un code a 6 chiffres par le SMTP configure dans `/admin` > `Reglages`. Sans SMTP valide, l'inscription est refusee et la transaction est annulee.

Les endpoints auth (`register`, `login`, `activate`, `resend-activation`) ont un rate limit par IP et par email. L'activation bloque temporairement un compte pending apres 5 codes invalides, les comptes pending trop vieux sont nettoyes automatiquement, et les emails d'activation ont un quota journalier par IP/email.

Le token retourne doit etre envoye comme ceci:

```bash
curl http://127.0.0.1:8021/api/me \
  -H "Authorization: Bearer TOKEN_ICI"
```

## Dataset demo

Pour remplir l'admin et l'espace client avec des donnees de test:

```bash
php server-php/scripts/seed_demo_dataset.php
```

Le mot de passe de tous les comptes demo est `password123`.

Comptes utiles:

- `demo@nichoir.local`
- `lea.client@nichoir.local`
- `bob.client@nichoir.local`
- `noemie.suspendue@nichoir.local`
- `atelier@nichoir.local`

## A ajouter

- Admin complet: filtres billing avances, surveillance des echecs email et journal d'audit plus lisible.
- Rate limiting tickets/webhooks. L'auth client et `/api/client-log` sont deja limites.
- CSRF et authentification admin production; eviter le `key` admin en query string.
- CSP, retention/rotation des logs, sanitizer SVG complet et plafonds Rust/WASM pour fichiers/meshes/exports.
- Tests live Stripe avec les vrais price IDs, portail active dans le dashboard Stripe et webhook de production.
- Configuration dev/prod pour CORS, URL publique, secrets Stripe/SMTP et base de donnees.
- Durcir encore le flux d'installation cPanel et documenter la suppression post-setup.

## Notes

- Les webhooks non signes ne sont acceptes qu'en local/dev ou avec `NICHOIR_ALLOW_UNSIGNED_STRIPE_WEBHOOKS=1`. En production, configurer `NICHOIR_STRIPE_WEBHOOK_SECRET`.
- Le serveur ne recoit pas de geometrie et ne genere pas de STL/PDF/ZIP.
- Les credits sont debites par `POST /api/exports/consume` apres generation locale reussie.


## Current backend ownership map

This backend is not only an API. It currently serves the public marketing pages, account area, admin area, contact form, JSON API, and Stripe webhook from one PHP front controller.

### Entry points

- `public/index.php`: includes all backend modules, runs migrations, emits security/CORS headers, dispatches public GET routes, contact POST, Stripe webhook, auth/profile/billing/export/ticket APIs, and fallback JSON 404.
- `public/site.css`: shared style layer for PHP-rendered public pages, account tabs, admin dashboard, modals, forms, pricing/about/contact sections, responsive layout, and focus rings.
- `public/.htaccess`: Apache front-controller and public-directory hardening for deployments where Apache serves this folder.

### Source modules

- `src/db.php`: database driver config, local/env DB config resolution, PDO creation, settings helpers, SQLite migrations, MySQL schema setup, and install-lock helpers.
- `src/auth.php`: session tokens, bearer auth, current user loading, public user projection, activation token lifecycle, auth rate limiting, email quota checks, and client IP handling.
- `src/credits.php`: premium export type allowlist, configured export credit cost, and partial-credit bonus calculation.
- `src/logger.php`: request IDs, hashed IP/email values, app logs, audit logs, Stripe event logs, and shutdown logging for slow/fatal requests.
- `src/mail.php`: SMTP configuration, safe email header construction, direct SMTP sending, ticket notification records, activation emails, and contact email delivery support.
- `helpers.php`: shared `h()` escaping and `money_cents()` formatting helpers.
- `i18n.php`: `page_lang()`, `page_t()`, `page_tv()`, language-aware path helpers, app URL helper, and public translation tables.
- `layout.php`: `page_response()`, shared page shell, header/nav/footer, localized ARIA labels, stylesheet link, and shared tab/modal inline JavaScript.
- `contact.php`: contact CSRF helpers and `handle_contact_post()` for validation, honeypot/rate limit checks, SMTP handoff, logging, and flash redirects.
- `pages.php`: remaining large page/admin module. It contains public page rendering, account page, account inline JavaScript, admin authorization, admin actions, admin tables, modals, settings panels, exports, and admin inline JavaScript. Planned split is documented in `../../docs/refactoring-plan.md`.
- `src/response.php`: shared JSON response output, JSON body size limit, required-field helper, and base HTTP security headers.
- `src/stripe.php`: Stripe settings, API request helper, Checkout session creation, billing portal creation, and webhook signature verification.
- `src/stripe_webhook.php`: Stripe webhook idempotence, event logging, checkout completion handling, invoice/payment sync, and subscription sync.

### Data and migrations

- `migrations/001_init.sql`: SQLite schema baseline.
- `data/nichoir.sqlite`: local SQLite database used by dev server.
- `data/db-config.php`: optional local DB config generated by admin/installer, ignored by Git.
- `data/installed.lock.php`: optional installer lock, ignored by Git.

### Business invariants

- Credit cost must be read through `credit_policy_settings()` or `export_credit_cost()` from `src/credits.php`.
- `/api/exports/authorize` creates short-lived authorizations only for valid export types and active users with enough credits or allowed partial-balance bonus.
- `/api/exports/consume` must atomically claim an authorization before credit debit, then write `credit_ledger` and audit/app logs.
- Users with zero credits do not receive partial-balance bonus; users with positive but insufficient credits can be topped up when enabled.
- Contact POST must keep CSRF, honeypot, IP rate limit, input length checks, SMTP failure handling, and session flash messages.
- Admin credit changes and billing/subscription actions must be auditable.
- Stripe secrets and SMTP passwords should come from environment variables in production where possible.
- Geometry and fabrication files are generated client-side; PHP should not receive heavy geometry payloads.

### Current backend drift / risks

- Public pricing card display values are translation strings, while Stripe price IDs and credit package quantities are admin settings. These need one package config source before public launch.
- `pages.php` still contains inline scripts, blocking a strict no-inline CSP.
- Admin access still relies on local/dev trust or `NICHOIR_ADMIN_KEY`; production-grade admin auth/CSRF is still planned.
- Some public ARIA labels are still hardcoded in French.
- Ticket/webhook rate limiting is still weaker than auth/client-log rate limiting.

### Validation checklist after backend edits

1. Run PHP lint on each touched PHP file.
2. Smoke test `/`, `/pricing`, `/about`, `/contact`, `/account`, and `/admin`.
3. Submit invalid contact form and confirm flash errors render after redirect.
4. Test `/api/exports/authorize` and one successful `/api/exports/consume` path.
5. Repeat the same authorization consume and confirm the second request fails without another debit.
6. Change admin credit policy and confirm authorize/consume reflect the configured cost.
7. If Stripe code changed, test Checkout, portal, and webhook signature handling with Stripe test mode.
