# Racine publique PHP

Role: document root du serveur PHP local. Seuls les fichiers de ce dossier sont exposes directement par `php -S`.

Fichiers importants:

- `index.php`: routeur HTTP principal pour pages, API JSON et webhook Stripe.
- `site.css`: styles du site PHP, compte et admin.

Regles d'architecture:

- Garder le routage HTTP dans `index.php` et deplacer la logique partagee dans `server-php/src`.
- Ne pas mettre la base SQLite, secrets ou fichiers internes dans `public`.
- Les endpoints `/api/...` doivent retourner JSON via `json_response`.
- Les pages HTML doivent rester dans `pages.php` sauf besoin clair.

Demarrage local:

```bash
php -S 127.0.0.1:8021 -t server-php/public
```
