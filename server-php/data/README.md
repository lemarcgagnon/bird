# Donnees SQLite locales

Role: donnees de developpement du serveur PHP.

Fichiers importants:

- `nichoir.sqlite`: base SQLite locale utilisee par le serveur PHP.

Regles d'usage:

- Ne pas mettre de secrets ni donnees client reelles dans ce dossier.
- Garder seulement des donnees demo/locales.
- Nettoyer les utilisateurs, tickets, sessions ou evenements de test avant commit si le changement de base n'est pas voulu.
- Le schema doit venir des migrations dans `server-php/migrations`.

Etat attendu en demo:

- utilisateur `demo@nichoir.local`;
- pas de tickets ou evenements Stripe de test persistants sauf besoin documente.
