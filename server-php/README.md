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

Etat actuel:

- `/`, `/pricing`, `/account` et `/admin` sont routes par PHP.
- `/admin` affiche deja les clients et autorisations recents depuis SQLite.
- `/admin` permet maintenant de chercher un client, ouvrir sa fiche, ajuster ses credits et suspendre/reactiver son compte.
- `/admin` permet aussi de modifier manuellement le statut d'abonnement serveur en attendant le webhook Stripe.
- La fiche client affiche historique credits, abonnements, paiements, exports, tickets et audit admin.
- `/account` permet maintenant login/register/logout, affichage credits, historique credits, abonnement, paiements et creation/liste de tickets.
- `GET /api/credits/ledger` retourne l'historique credits du client connecte.
- `GET /api/billing/summary` retourne l'abonnement courant et les paiements synchronises du client connecte.
- En local, `/admin` est accessible pour le dev. En production, definir `NICHOIR_ADMIN_KEY`.
- `/stripe/webhook` reste a implementer.

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
- Admin complet: reponses tickets, pagination, filtres billing et journal d'audit plus lisible.
- Stripe Checkout reel.
- Webhook Stripe pour mettre a jour credits, abonnements et paiements.
- Configuration dev/prod pour CORS, URL app, secrets Stripe et base de donnees.

## Notes

- Stripe est un placeholder: le lien Checkout est faux pour l'instant.
- Le serveur ne recoit pas de geometrie et ne genere pas de STL/PDF/ZIP.
- Les credits sont debites par `POST /api/exports/consume` apres generation locale reussie.
