# Source PHP

Role: logique serveur PHP partagee par le routeur public. C'est la source de verite pour comptes, sessions, credits, admin, billing Stripe et webhooks.

Fichiers importants:

- `db.php`: config SQLite/MySQL, connexion PDO, migrations SQLite et schema MySQL cPanel.
- `auth.php`: tokens bearer, sessions, activation email, utilisateur courant et projection publique.
- `response.php`: reponses JSON, limites payload et headers de securite.
- `pages.php`: pages HTML PHP, espace client, admin, repertoire utilisateurs et actions admin.
- `mail.php`: reglages SMTP, envoi email tickets/activation et journal `ticket_notifications`.
- `stripe.php`: configuration Stripe, client API minimal, Checkout, portail client et verification de signature webhook.
- `stripe_webhook.php`: traitement des evenements Stripe, factures, abonnements et idempotence `stripe_events`.

Regles d'architecture:

- Garder les decisions compte/credits/abonnement cote PHP.
- Ne pas dupliquer l'admin ou le billing dans l'app WASM.
- Toute action qui debite ou modifie un compte doit etre validee serveur.
- Les secrets Stripe restent cote PHP; l'app WASM ne recoit jamais de cle.

Points de vigilance:

- `NICHOIR_ADMIN_KEY` protege l'admin hors local; l'auth admin production reste a ameliorer.
- `NICHOIR_CORS_ORIGINS` controle les origines autorisees pour l'app.
- Configurer `NICHOIR_STRIPE_WEBHOOK_SECRET` en production pour imposer `Stripe-Signature`.
- Ajouter rate limiting, CSRF admin et CSP avant prod.
- Preferer `NICHOIR_SMTP_PASSWORD` pour le mot de passe SMTP en production si possible; sinon il est stocke dans SQLite via `/admin`.
- Preferer `NICHOIR_STRIPE_SECRET_KEY` et `NICHOIR_STRIPE_WEBHOOK_SECRET` pour Stripe en production; sinon `/admin` peut stocker les valeurs dans SQLite.
- Preferer les variables `NICHOIR_DB_*` pour la DB en production si disponibles; sinon `/admin` ecrit `server-php/data/db-config.php`, ignore par Git.
