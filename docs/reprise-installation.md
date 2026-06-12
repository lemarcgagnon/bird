# Reprise travail installation

Etat laisse en place au 2026-06-12:

- installateur web livre dans `installation/index.php`;
- verrou d'installation gere par `server-php/src/db.php` via `server-php/data/installed.lock.php`;
- `.htaccess` racine ajoute pour le cas cPanel avec `DocumentRoot` sur la racine du projet;
- `.htaccess` dans `server-php/public/` ajoute pour le cas recommande avec `DocumentRoot` sur `server-php/public`;
- README mis a jour pour decrire ce flux.

Ce qui a ete verifie:

- syntaxe PHP:
  - `php -l installation/index.php`
  - `php -l server-php/src/db.php`
- hygiene diff:
  - `git diff --check`
- test reel dans une copie jetable sous `/tmp/nichoir16-install-test`:
  - GET `/installation/`
  - POST succes en mode SQLite
  - creation de `server-php/data/db-config.php`
  - creation de `server-php/data/installed.lock.php`
  - migrations appliquees
  - `support_email` enregistre dans `app_settings`

Ce qu'il reste a faire a la reprise:

1. Revue UX de l'installateur
- verifier le rendu mobile;
- verifier les etats de blocage en cas d'erreur MySQL reelle;
- eventuellement ajouter un bouton ou un texte plus direct pour rappeler la suppression de `installation/`.

2. Durcissement securite
- decider si l'installateur doit exiger un code d'installation unique ou un secret serveur temporaire;
- decider si l'installateur doit refuser de tourner hors localhost tant qu'un secret n'est pas fourni;
- revoir les headers et la CSP cote Apache/PHP avant mise en prod.

3. Cas MySQL cPanel reel
- tester sur un vrai hebergement cPanel avec credentials MySQL;
- verifier les permissions fichier sur `server-php/data`;
- verifier le comportement si `NICHOIR_DB_*` est partiellement defini par l'hebergeur.

4. Regles de deploiement
- documenter la procedure finale pas a pas pour le serveur cible:
  - copie des fichiers;
  - choix du `DocumentRoot`;
  - lancement de `/installation/`;
  - definition de `NICHOIR_ADMIN_KEY`;
  - suppression de `installation/`.

5. Nettoyage possible
- si le mode de deploiement final impose toujours `DocumentRoot = server-php/public`, reevaluer si le `.htaccess` racine doit rester ou seulement etre documente comme fallback;
- verifier si l'installateur doit vivre dans la racine ou dans un emplacement externe fourni temporairement au serveur.

Points de vigilance:

- ne pas committer `server-php/data/db-config.php`;
- ne pas committer `server-php/data/installed.lock.php`;
- ne pas committer `server-php/data/nichoir.sqlite` sauf si un changement de dataset est voulu;
- l'installateur ne doit pas devenir une deuxieme surface d'administration.
