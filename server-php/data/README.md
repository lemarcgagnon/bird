# Donnees locales et config DB

Role: donnees de developpement du serveur PHP et configuration locale non versionnee.

Fichiers importants:

- `nichoir.sqlite`: base SQLite locale/dev seulement. Elle est ignoree par Git et exclue des artifacts de production.
- `db-config.php`: config DB locale generee par `/admin` > `Reglages` quand on enregistre les coordonnees cPanel/MySQL. Ce fichier est ignore par Git.
- `installed.lock.php`: verrou ecrit par `installation/` une fois le setup termine. Ce fichier est ignore par Git.

Regles d'usage:

- Ne pas committer `*.sqlite`, `*.db`, `db-config.php` ou `installed.lock.php`.
- Ne pas mettre de secrets ni donnees client reelles dans ce dossier.
- Garder seulement des donnees demo/locales.
- En production cPanel, utiliser l artifact `public_html/` + `nichoir_private/`; `data/` reste hors du web public.
- La cible production approuvee est MySQL avec configuration privee hors `public_html`; SQLite reste local/dev sauf decision explicite contraire.
- Nettoyer les utilisateurs, tickets, sessions ou evenements de test avant commit si le changement de base n'est pas voulu.
- Le schema doit venir des migrations dans `server-php/migrations`.

Etat attendu en demo:

- utilisateur `demo@nichoir.local`;
- pas de tickets ou evenements Stripe de test persistants sauf besoin documente.
