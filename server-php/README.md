# Nichoir PHP/SQLite backend local

Backend local minimal pour tester compte, credits, billing placeholder, autorisation de telechargement et tickets.

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
- `data/`: base SQLite locale de developpement. Voir `data/README.md`.

Etat actuel:

- `/`, `/pricing`, `/account` et `/admin` sont routes par PHP.
- `/admin` affiche deja les clients et autorisations recents depuis SQLite.
- `/admin` contient maintenant un repertoire utilisateurs avec recherche, filtres et pagination.
- `/admin` permet de creer un utilisateur, modifier profil/courriel/statut/credits, reset le mot de passe et supprimer un compte avec confirmation.
- `/admin` permet aussi de modifier manuellement le statut d'abonnement serveur en attendant le webhook Stripe.
- La fiche client affiche historique credits, abonnements, paiements, exports, tickets et audit admin.
- `/account` permet maintenant login/register/logout, affichage credits, historique credits, abonnement, paiements et creation/liste de tickets.
- `GET /api/credits/ledger` retourne l'historique credits du client connecte.
- `GET /api/billing/summary` retourne l'abonnement courant et les paiements synchronises du client connecte.
- `/stripe/webhook` accepte des evenements Stripe locaux/non signes en dev, journalise `stripe_events`, traite `checkout.session.completed` et les evenements `customer.subscription.*`.
- En local, `/admin` est accessible pour le dev. En production, definir `NICHOIR_ADMIN_KEY`.
- CORS est limite par `NICHOIR_CORS_ORIGINS` (`http://127.0.0.1:8016` par defaut en dev).
- Les payloads JSON sont limites a `256 KiB`; offres checkout, types d'export, tickets, profil et mots de passe sont valides cote serveur.
- `POST /api/exports/consume` reverifie le statut du compte et le solde avant debit.
- La verification reelle `Stripe-Signature` reste a implementer avant exposition production.

## Demarrer

```bash
cd /home/marc/Documents/nichoir16
php -S 127.0.0.1:8021 -t server-php/public
```

## Endpoints

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/credits/ledger`
- `GET /api/billing/summary`
- `POST /api/checkout/stripe-link`
- `POST /api/exports/authorize`
- `POST /api/exports/consume`
- `GET /api/tickets`
- `POST /api/tickets`
- `POST /stripe/webhook`

## Test rapide

```bash
curl http://127.0.0.1:8021/api/health
```

```bash
curl -X POST http://127.0.0.1:8021/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@nichoir.local","password":"password123","display_name":"Demo"}'
```

Le token retourne doit etre envoye comme ceci:

```bash
curl http://127.0.0.1:8021/api/me \
  -H "Authorization: Bearer TOKEN_ICI"
```

## A ajouter

- Espace client complet: edition profil, portail Stripe et factures reelles.
- Admin complet: reponses tickets, filtres billing avances et journal d'audit plus lisible.
- Rate limiting login/register/tickets/webhooks.
- CSRF et authentification admin production; eviter le `key` admin en query string.
- CSP, sanitizer SVG complet et plafonds Rust/WASM pour fichiers/meshes/exports.
- Stripe Checkout reel.
- Verification `Stripe-Signature` du webhook.
- Configuration dev/prod pour CORS, URL app, secrets Stripe et base de donnees.

## Notes

- Stripe est un placeholder: le lien Checkout est faux pour l'instant.
- Le webhook local est volontairement non signe seulement en local/dev. Ne pas l'exposer en production sans verification Stripe officielle.
- Le serveur ne recoit pas de geometrie et ne genere pas de STL/PDF/ZIP.
- Les credits sont debites par `POST /api/exports/consume` apres generation locale reussie.
