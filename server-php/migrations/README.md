# Migrations PHP

Role: schema versionne de la base utilisee par le serveur PHP. Le runtime supporte SQLite pour le local/dev et MySQL pour la production.

Fichiers importants:

- `001_init.sql`: schema initial comptes, sessions, credits, exports, tickets, messages tickets, notifications tickets, reglages applicatifs, abonnements, paiements, Stripe events et audit admin.

Regles d'usage:

- Ajouter une nouvelle migration numerotee pour tout changement de schema.
- Ne pas modifier une migration deja appliquee sans raison explicite; preferer `002_...sql`.
- Garder les contraintes et index proches du schema.
- `run_migrations()` applique les fichiers `*.sql` par ordre alphabetique et journalise les fichiers deja appliques dans `schema_migrations`.

Point de vigilance:

- Ne jamais versionner `server-php/data/nichoir.sqlite`; la base SQLite est locale/dev seulement.
- La cible production approuvee est MySQL avec configuration privee hors `public_html`.
- Ne jamais committer une base, un dump ou une config contenant un vrai mot de passe SMTP; preferer `NICHOIR_SMTP_PASSWORD` ou `config/production.php` prive en production.
