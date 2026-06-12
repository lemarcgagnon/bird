# Donnees locales et config DB

Role: donnees de developpement du serveur PHP et configuration locale non versionnee.

Fichiers importants:

- `nichoir.sqlite`: base SQLite locale utilisee par le serveur PHP.
- `db-config.php`: config DB locale generee par `/admin` > `Reglages` quand on enregistre les coordonnees cPanel/MySQL. Ce fichier est ignore par Git.
- `installed.lock.php`: verrou ecrit par `installation/` une fois le setup termine. Ce fichier est ignore par Git.

Regles d'usage:

- Ne pas mettre de secrets ni donnees client reelles dans ce dossier sauf config serveur locale necessaire au deploiement.
- Garder seulement des donnees demo/locales.
- En production cPanel, pointer le document root vers `server-php/public` pour garder `data/` hors du web public.
- Nettoyer les utilisateurs, tickets, sessions ou evenements de test avant commit si le changement de base n'est pas voulu.
- Le schema doit venir des migrations dans `server-php/migrations`.

Etat attendu en demo:

- utilisateur `demo@nichoir.local`;
- pas de tickets ou evenements Stripe de test persistants sauf besoin documente.
