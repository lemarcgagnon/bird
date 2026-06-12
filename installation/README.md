# Installateur temporaire

Role: interface d'installation serveur a utiliser une seule fois, puis a supprimer du disque.

Fichiers importants:

- `index.php`: assistant d'installation web pour DB, migrations, SMTP optionnel et verrou d'installation.

Ce que fait l'installateur:

- verifie PHP, PDO, drivers MySQL/SQLite, acces a `server-php/data` et lisibilite des migrations;
- accepte une config MySQL cPanel ou SQLite local;
- ecrit `server-php/data/db-config.php` si la DB n'est pas deja pilotee par `NICHOIR_DB_*`;
- initialise le schema via la meme logique que l'app (`run_migrations_for_pdo()`);
- peut enregistrer l'email support et les reglages SMTP de base;
- pose `server-php/data/installed.lock.php` pour bloquer une seconde installation.

Regles d'usage:

- supprimer le dossier `installation/` des que le setup est termine;
- definir `NICHOIR_ADMIN_KEY` cote serveur avant d'ouvrir `/admin`;
- preferer un `DocumentRoot` sur `server-php/public`; si le `DocumentRoot` reste a la racine du projet, garder le `.htaccess` versionne;
- ne pas reafficher ni committer `db-config.php` ou `installed.lock.php`.

Limites actuelles:

- pas de test SMTP actif dans l'installateur; il enregistre seulement la config initiale;
- pas de gestion multi-etapes ni reprise de formulaire complexe;
- pas de creation de compte admin: l'acces admin reste base sur `NICHOIR_ADMIN_KEY`.
