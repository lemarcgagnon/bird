# Nichoir PHP/SQLite backend local

Backend local minimal pour tester compte, credits, autorisation de telechargement et tickets.

## Demarrer

```bash
cd /home/marc/Documents/nichoir16
php -S 127.0.0.1:8020 -t server-php/public
```

## Endpoints

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/checkout/stripe-link`
- `POST /api/exports/authorize`
- `POST /api/exports/consume`
- `GET /api/tickets`
- `POST /api/tickets`

## Test rapide

```bash
curl http://127.0.0.1:8020/api/health
```

```bash
curl -X POST http://127.0.0.1:8020/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@nichoir.local","password":"password123","display_name":"Demo"}'
```

Le token retourne doit etre envoye comme ceci:

```bash
curl http://127.0.0.1:8020/api/me \
  -H "Authorization: Bearer TOKEN_ICI"
```

## Notes

- Stripe est un placeholder: le lien Checkout est faux pour l'instant.
- Le serveur ne recoit pas de geometrie et ne genere pas de STL/PDF/ZIP.
- Les credits sont debites par `POST /api/exports/consume` apres generation locale reussie.
