# Migrations SQLite PHP

Role: schema versionne de la base SQLite utilisee par le serveur PHP.

Fichiers importants:

- `001_init.sql`: schema initial comptes, sessions, credits, exports, tickets, messages tickets, notifications tickets, reglages applicatifs, abonnements, paiements, Stripe events et audit admin.

Regles d'usage:

- Ajouter une nouvelle migration numerotee pour tout changement de schema.
- Ne pas modifier une migration deja appliquee sans raison explicite; preferer `002_...sql`.
- Garder les contraintes et index proches du schema.
- `run_migrations()` applique les fichiers `*.sql` par ordre alphabetique et journalise les fichiers deja appliques dans `schema_migrations`.

Point de vigilance:

- La base dev `server-php/data/nichoir.sqlite` peut etre versionnee pour demo locale, mais le schema doit rester reproductible par migrations.
- Ne jamais committer une base SQLite contenant un vrai mot de passe SMTP; preferer `NICHOIR_SMTP_PASSWORD` en production.
