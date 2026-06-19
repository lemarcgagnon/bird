# Nichoir

Application web pour concevoir un nichoir parametrable, le visualiser en 3D et telecharger des fichiers de fabrication. L'etat actuel du repo est une app Rust/WebAssembly cote navigateur, encadree par un site PHP qui gere comptes, credits, support, admin, Stripe et deploiement cPanel.

Etat release: le codebase PHP/WASM courant contient la stabilisation production Namecheap/cPanel, dont le fail-closed MySQL, Three.js local, l'artifact sans docs/dev/secrets, et le chemin admin configurable non evident. Le dernier artifact valide doit etre reconstruit depuis cette revision, pas depuis les anciens zips.

`nichoir_v16.html` reste une reference historique monofichier. Le chemin actif est `app/` + `wasm/` + `server-php/`.

## Surfaces actives

Le repo vise un site PHP unique pour les surfaces publiques et applicatives:

```text
/                         Landing publique
/pricing                  Offres et regles de credits
/about                    Page a propos
/contact                  Formulaire contact et liens support
/terms                    Conditions
/legal                    Mentions legales
/app/                     App statique Rust/WASM
/account                  Espace client
NICHOIR_ADMIN_PATH/login  Connexion admin par session PHP
NICHOIR_ADMIN_PATH        Back-office prive
NICHOIR_ADMIN_PATH/exports/download
                          Export admin CSV/XLS/JSON
/api/...                  API JSON compte, billing, exports, tickets, logs client
/stripe/webhook           Webhook Stripe
/installation/            Installateur temporaire dev/root seulement, exclu de l'artifact
```

Responsabilites actuelles:

- PHP: pages publiques, comptes, sessions, activation courriel, credits, billing Stripe, tickets, contact, admin, logs, SMTP, CORS, migrations et configuration.
- Rust/WASM: parametres, geometrie, calculs, maillages, decorations, plan SVG, exports STL/OBJ/ZIP et HTML dense de l'app.
- JavaScript: chargement WASM, viewer Three.js local, theme/langue, modal compte, appels API PHP, logs client, captures PNG/PDF, identification `app_id=nichoir` et flux autorisation/consommation des telechargements.
- Le serveur ne recoit pas de geometrie lourde et ne genere pas les fichiers de fabrication.

## Carte du repo

- `app/`: shell navigateur, glue JavaScript, Three.js vendorise localement, styles de l'app WASM. Voir `app/README.md`.
- `wasm/`: crate Rust compile en WebAssembly. Voir `wasm/README.md`.
- `server-php/`: backend et site PHP actifs, SQLite local/dev et MySQL obligatoire en production cPanel. Voir `server-php/README.md`.
- `installation/`: assistant web one-shot pour config DB/SMTP et lock d'installation. Voir `installation/README.md`.
- `deployment/namecheap/`: packaging public/private pour Namecheap/cPanel. Voir `deployment/namecheap/README.md`.
- `scripts/`: smoke tests mesh et script d'artifact cPanel. Voir `scripts/README.md`.
- `docs/`: index de plans, audit, notes historiques et diagramme d'architecture Mermaid. Voir `docs/README.md` et `docs/architecture.mmd`.
- `server/`: ancienne API FastAPI/SQLite de licence, gardee comme reference. Voir `server/README.md`.
- `nichoir_v16.html`: ancienne reference fonctionnelle monofichier.

## Lancer en local

Serveur PHP site/API:

```bash
cd /home/marc/Documents/nichoir16
php -S 127.0.0.1:8021 -t server-php/public
```

Serveur statique pour l'app:

```bash
cd /home/marc/Documents/nichoir16
php -S 127.0.0.1:8016 -t .
```

Ouvrir le site:

```text
http://127.0.0.1:8021/
```

Ouvrir l'app directement avec l'API PHP separee:

```text
http://127.0.0.1:8016/app/
```

Sur `localhost`/`127.0.0.1`, l'app servie sur le port `8016` pointe automatiquement l'API vers `8021`. L'override local `?php_base=http://127.0.0.1:8021` reste accepte pour tester une autre origine locale. Hors hote local, `php_base` est ignore et l'app utilise `window.location.origin`, ce qui correspond a l'artifact production ou `public_html/app/` et le wrapper PHP partagent la meme origine.

## Compiler le WASM

Prerequis:

```bash
rustc --version
wasm-pack --version
```

Build:

```bash
cd /home/marc/Documents/nichoir16/wasm
wasm-pack build --target web
```

Le package genere est `wasm/pkg/`; `app/app.js` importe `wasm/pkg/wasm.js`.

## Fonctionnalites app

- Unites `mm`, `cm` et `in`.
- Dimensions, epaisseur, evasement, plancher `enclave` ou `pose`.
- Toit avec pente, debordement pluie et crete `gauche`, `droit` ou `onglet`.
- Porte `aucune`, `ronde`, `carree` ou `pentagonale`, panneau de porte optionnel, perchoir cylindrique optionnel et bloc de fixation murale optionnel.
- Jusqu'a quatre trous de suspension dans le toit.
- Viewer Three.js avec modes plein, filaire, rayons X, aretes et mode eclate.
- Light/dark mode, langue FR/EN et liens de retour au site PHP.
- Decorations SVG, PNG, JPG/JPEG, GIF fixe, WEBP et import STL local. Les images deviennent des reliefs heightmap; les STL sont attaches au panneau cible et inclus dans le mesh maison.
- Librairie decors cote PHP: les clients telechargent un STL ou une image avec credits, le fichier arrive sur leur ordinateur, puis ils l'importent dans le panneau Decor de l'app WASM comme fichier local.
- Largeur/hauteur de decor peuvent etre liees pour garder les proportions pendant le redimensionnement.
- Clipping decor au panneau et aux trous: les trous de porte/perchoir dominent toujours le decor de facade. Le viewer affiche le STL importe en mode preview permissif pour permettre le placement. Si ce decor deviendrait ouvert ou non-manifold apres clipping, il est exclu des exports stricts au lieu de produire un fichier casse.
- Rapport mesh avec comptage des triangles degeneres, valeurs non finies, aretes ouvertes, aretes non-manifold et indicateur `watertight`.
- Limite navigateur de 2 Mo pour images/SVG; la librairie PHP accepte les STL jusqu a 25 Mo maximum, avec une limite active configurable dans les reglages admin.

## Exports

Telechargements factures autorises par PHP puis generes localement:

- STL maison complete;
- plan SVG;
- plan PNG;
- PDF du plan de coupe avec image d'assemblage;
- PNG de l'assemblage eclate.

Une session admin PHP valide contourne le debit credits pour ces exports: `/api/exports/quote`, `/api/exports/authorize` et `/api/exports/consume` renvoient alors `admin=true` et `cost=0`. Les autorisations admin sont stockees en session PHP, one-shot, et expirent apres 10 minutes.

Telechargements locaux/gratuits dans l'app actuelle:

- STL porte;
- STL bloc de fixation murale;
- ZIP de panneaux STL separes;
- PDF des calculs;
- OBJ maison complete pour debug;
- rapport mesh JSON.

Le rapport mesh JSON peut etre sauvegarde dans le navigateur sous `nichoir-last-mesh-report` pour eviter de le perdre en quittant l'ecran. Cette sauvegarde est seulement diagnostique; elle ne contient pas l'autorite compte/credits. Les credits, le bonus, les autorisations et le debit sont controles par le serveur PHP.

Les pieces separees du ZIP sont l'objectif principal pour fabrication par panneaux. Le smoke test exige que chaque piece separee, y compris les decors exportes, n'ait ni aretes ouvertes ni aretes non-manifold. Le STL maison complete reste un assemblage de panneaux en contact; il est watertight mais peut contenir des aretes sur-partagees la ou les pieces s'appuient l'une sur l'autre. Une union booleenne/CSG serait necessaire pour produire une maison complete parfaitement fusionnee en un seul solide manifold.

## Backend PHP

`server-php/public/index.php` est le front controller actif. Il inclut les modules de `server-php/src/`, applique les migrations, emet les headers de base, route les pages publiques, l'espace client, l'admin, l'API JSON, le contact POST et Stripe.

Etat actuel:

- `/account` gere login/register/logout, activation par code email, profil, credits, historique, abonnement, paiements/factures Stripe, tickets, fils de messages et statut open/closed.
- L'auth compte passe maintenant par le cookie HttpOnly `nichoir_account_session` en SameSite=Lax. Le navigateur nettoie l'ancienne cle locale `nichoir-auth-token` et utilise des requetes avec credentials, pas un bearer token persistant.
- L'admin utilise `NICHOIR_ADMIN_PATH` (par defaut `/gestion-nichoir`), `NICHOIR_ADMIN_PASSWORD_HASH`, session PHP, `password_verify()`, `session_regenerate_id(true)` et CSRF sur les POST.
- Les chemins evidents `/admin` et `/administration` sont reserves/interdits et ne doivent pas etre utilises en production.
- Le chemin admin reel ne doit pas etre expose dans les pages publiques: il est seulement rendu cote admin, et les pages publiques ne doivent pas injecter `NICHOIR_ADMIN_PATH` dans leur HTML/JS.
- L'admin gere clients, credits, statuts, abonnements manuels, tickets, logs, exports DB, reglages DB/Stripe/SMTP et tests email.
- `/library` liste les fichiers actifs de la librairie, leur description, leur taille et affiche une miniature PNG publique sans donner le fichier source. `/api/library/authorize` cree une autorisation courte et `/api/library/download` debite les credits atomiquement au moment ou le fichier est servi. Les fichiers sont stockes hors webroot dans `server-php/data/library`; le preview image original `/api/library/preview` est reserve a l'admin.
- `/api/admin/session` ne renvoie que l'etat admin de la session PHP courante; l'app statique l'utilise pour afficher les telechargements diagnostiques admin-only et debloquer les exports premium a cout zero sans exposer le chemin admin configure.
- `server-php/src/credits.php` est la source de verite pour le registre des apps WASM, les types d'export factures, le cout configure et le bonus de solde partiel.
- `/api/apps` expose les apps WASM connues du backend. L'app actuelle utilise `app_id=nichoir`.
- `/api/exports/quote` annonce le cout/solde/bonus par `app_id` sans creer d'autorisation; `/api/exports/authorize` cree une autorisation courte; `/api/exports/consume` la reclame atomiquement avant debit. Avec une session admin, le cout est zero et l'autorisation est stockee/consommee en session PHP sans ligne `credit_ledger`.
- `/api/client-log` accepte les erreurs navigateur/WASM avec rate limit de 10 logs/minute par utilisateur ou IP.
- `/stripe/webhook` verifie `Stripe-Signature` quand un secret est configure, journalise les evenements et synchronise checkout, invoices, paiements et abonnements.
- SQLite est le mode local/developpement uniquement.
- En production cPanel, le wrapper force `NICHOIR_ENV=production`; `NICHOIR_DB_DRIVER=mysql` et une config MySQL complete sont obligatoires.
- Sans config production valide, l'app echoue fermee et `/api/health` retourne `500 configuration_error`.
- Avec config MySQL valide, `/api/health` doit retourner `env=production` et `db_driver=mysql`.

## Deploiement cPanel

La cible documentee est un artifact `public_html/` + `nichoir_private/`, pas une copie brute de tout le repo:

```bash
scripts/build-cpanel-artifact.sh /tmp/nichoir-cpanel-artifact
```

Points critiques:

- `public_html/` contient seulement le wrapper PHP public, `.htaccess`, `site.css`, `app/` avec Three.js local, et `wasm/pkg/wasm.js` + `wasm_bg.wasm`.
- `nichoir_private/` contient `server-php/public/index.php`, les fichiers PHP runtime de `server-php/src/`, les migrations SQL runtime, des dossiers `data/` et `logs/` vides, config privee et logs generes.
- Ne pas mettre `server-php/src`, `server-php/data`, `server-php/migrations`, `installation`, `docs`, `.git`, bases SQLite, dumps ou secrets dans `public_html`.
- Remplir `nichoir_private/config/production.php` depuis `deployment/namecheap/config/production.example.php`.
- Definir au minimum `NICHOIR_PUBLIC_BASE_URL`, `NICHOIR_ADMIN_PATH`, `NICHOIR_ADMIN_PASSWORD_HASH`, la config MySQL, `NICHOIR_CORS_ORIGINS` et `NICHOIR_LOG_HASH_SALT`.
- `installation/` n'est pas inclus dans l'artifact Namecheap valide; si un installateur temporaire est utilise hors artifact, supprimer le repertoire entier apres setup.
- Configurer SMTP reel Namecheap avant emails production.
- Configurer `NICHOIR_STRIPE_SECRET_KEY` et `NICHOIR_STRIPE_WEBHOOK_SECRET` avant Stripe live.

## Validation utile

```bash
node --check app/app.js
find server-php installation deployment/namecheap -name '*.php' -print -exec php -l {} \;
cd wasm && cargo check
cd wasm && wasm-pack build --target web
node scripts/mesh-smoke.mjs
```

Checks manuels importants:

- ouvrir `/`, `/pricing`, `/about`, `/contact`, `/terms`, `/legal`, `/account`, puis `NICHOIR_ADMIN_PATH/login`;
- verifier que `/admin`, `/admin/login` et `/administration` ne servent pas le back-office;
- verifier que les sources HTML publiques ne contiennent pas le chemin admin configure;
- tester contact invalide et flash d'erreur apres redirection;
- tester autorisation puis consommation d'un export avec un compte connecte;
- consommer deux fois la meme autorisation et verifier qu'un seul debit passe;
- tester la session admin: quote/authorize/consume doivent retourner `admin=true`, `cost=0`, puis refuser une seconde consommation du meme token;
- tester Checkout, portail et webhook Stripe en mode test avant production.

## Points ouverts

- Les cartes prix publiques sont encore des traductions statiques, alors que Stripe price IDs et quantites sont des reglages admin.
- Une cle de traduction WASM inutilisee `credits_three` existe encore; elle ne doit pas redevenir une source visible de prix.
- Les scripts inline PHP restent dans `layout.php`, `account_pages.php` et `admin_pages.php`; une CSP stricte attend leur extraction vers `server-php/public/site.js`.
- Ajouter rate limiting plus fort sur tickets et webhooks.
- Ajouter retention/rotation des logs et plafonds triangles/STL/ZIP plus explicites.
- Finir les tests live Stripe et la traversee clavier complete admin/account.

## Historique

L'ancien `main` GitHub a ete sauvegarde dans la branche:

```text
avant-le-wsam
```
