# Migrations SQLite PHP

Role: schema versionne de la base SQLite utilisee par le serveur PHP.

Fichiers importants:

- `001_init.sql`: schema initial comptes, sessions, credits, exports, tickets, abonnements, paiements, Stripe events et audit admin.

Regles d'usage:

- Ajouter une nouvelle migration numerotee pour tout changement de schema.
- Ne pas modifier une migration deja appliquee sans raison explicite; preferer `002_...sql`.
- Garder les contraintes et index proches du schema.
- Verifier que `run_migrations()` dans `server-php/src/db.php` applique la nouvelle migration.

Point de vigilance:

- La base dev `server-php/data/nichoir.sqlite` peut etre versionnee pour demo locale, mais le schema doit rester reproductible par migrations.
