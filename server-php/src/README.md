# Source PHP

Role: logique serveur PHP partagee par le routeur public. C'est la source de verite pour comptes, sessions, credits, admin, billing placeholder et webhook Stripe dev.

Fichiers importants:

- `db.php`: chemin SQLite, connexion PDO, migrations.
- `auth.php`: tokens bearer, sessions, utilisateur courant et projection publique.
- `response.php`: reponses JSON, limites payload et headers de securite.
- `pages.php`: pages HTML PHP, espace client, admin, repertoire utilisateurs et actions admin.
- `stripe_webhook.php`: traitement local/dev des evenements Stripe et idempotence `stripe_events`.

Regles d'architecture:

- Garder les decisions compte/credits/abonnement cote PHP.
- Ne pas dupliquer l'admin ou le billing dans l'app WASM.
- Toute action qui debite ou modifie un compte doit etre validee serveur.
- Les placeholders Stripe doivent rester clairement marques jusqu'au branchement officiel.

Points de vigilance:

- `NICHOIR_ADMIN_KEY` protege l'admin hors local; l'auth admin production reste a ameliorer.
- `NICHOIR_CORS_ORIGINS` controle les origines autorisees pour l'app.
- La signature `Stripe-Signature` reelle reste obligatoire avant exposition production.
- Ajouter rate limiting, CSRF admin et CSP avant prod.
