# Nichoir

Application web pour concevoir un nichoir parametrable, le visualiser en 3D et telecharger des fichiers de fabrication. L'etat actuel du repo est une app Rust/WebAssembly cote navigateur, encadree par un site PHP qui gere comptes, credits, support, admin, Stripe et deploiement cPanel.

Etat release: la branche `main` courante contient la stabilisation production Namecheap/cPanel, dont le fail-closed MySQL, Three.js local, l'artifact sans docs/dev/secrets, et le chemin admin configurable non evident. Le dernier artifact valide doit etre reconstruit depuis `main`, pas depuis les anciens zips.

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
- `docs/`: index de plans, audit et notes historiques. Voir `docs/README.md`.
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
http://127.0.0.1:8016/app/index.html?lang=fr&php_base=http%3A%2F%2F127.0.0.1%3A8021
```

Sans `php_base`, l'app utilise `window.location.origin` pour l'API. C'est le bon comportement dans l'artifact production, ou `public_html/app/` et le wrapper PHP sont sur la meme origine. L'override `php_base` est ignore hors hote local.

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
- Decorations SVG, PNG, JPG/JPEG, GIF fixe et WEBP en modes vectoriel ou heightmap.
- Clipping decor au panneau et aux trous, limite fichier navigateur de 2 Mo et limites decodees cote WASM.

## Exports

Telechargements factures autorises par PHP puis generes localement:

- STL maison complete;
- plan SVG;
- plan PNG;
- PDF du plan de coupe avec image d'assemblage;
- PNG de l'assemblage eclate.

Telechargements locaux/gratuits dans l'app actuelle:

- STL porte;
- STL bloc de fixation murale;
- ZIP de panneaux STL separes;
- PDF des calculs;
- OBJ maison complete pour debug;
- rapport mesh JSON.

Le rapport mesh JSON peut etre sauvegarde dans le navigateur sous `nichoir-last-mesh-report` pour eviter de le perdre en quittant l'ecran. Cette sauvegarde est seulement diagnostique; elle ne contient pas l'autorite compte/credits. Les credits, le bonus, les autorisations et le debit sont controles par le serveur PHP.

Les pieces separees du ZIP sont l'objectif principal pour fabrication par panneaux. Le STL maison complete reste un assemblage de panneaux en contact; une union booleenne/CSG serait necessaire pour produire une maison complete parfaitement fusionnee en un seul solide manifold.

## Backend PHP

`server-php/public/index.php` est le front controller actif. Il inclut les modules de `server-php/src/`, applique les migrations, emet les headers de base, route les pages publiques, l'espace client, l'admin, l'API JSON, le contact POST et Stripe.

Etat actuel:

- `/account` gere login/register/logout, activation par code email, profil, credits, historique, abonnement, paiements/factures Stripe, tickets, fils de messages et statut open/closed.
- L'admin utilise `NICHOIR_ADMIN_PATH` (par defaut `/gestion-nichoir`), `NICHOIR_ADMIN_PASSWORD_HASH`, session PHP, `password_verify()`, `session_regenerate_id(true)` et CSRF sur les POST.
- Les chemins evidents `/admin` et `/administration` sont reserves/interdits et ne doivent pas etre utilises en production.
- Le chemin admin reel ne doit pas etre expose dans les pages publiques: il est seulement rendu cote admin, et les pages publiques ne doivent pas injecter `NICHOIR_ADMIN_PATH` dans leur HTML/JS.
- L'admin gere clients, credits, statuts, abonnements manuels, tickets, logs, exports DB, reglages DB/Stripe/SMTP et tests email.
- `server-php/src/credits.php` est la source de verite pour le registre des apps WASM, les types d'export factures, le cout configure et le bonus de solde partiel.
- `/api/apps` expose les apps WASM connues du backend. L'app actuelle utilise `app_id=nichoir`.
- `/api/exports/quote` annonce le cout/solde/bonus par `app_id` sans creer d'autorisation; `/api/exports/authorize` cree une autorisation courte; `/api/exports/consume` la reclame atomiquement avant debit.
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
cd wasm && cargo check --target wasm32-unknown-unknown
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
- tester Checkout, portail et webhook Stripe en mode test avant production.

## Points ouverts

- Les cartes prix publiques sont encore des traductions statiques, alors que Stripe price IDs et quantites sont des reglages admin.
- Une cle de traduction WASM inutilisee `credits_three` existe encore; elle ne doit pas redevenir une source visible de prix.
- Le label UI `deco_clip` dit encore "coming later/bientot" alors que le clipping decor est deja cable dans le WASM.
- Les scripts inline PHP restent dans `layout.php`, `account_pages.php` et `admin_pages.php`; une CSP stricte attend leur extraction vers `server-php/public/site.js`.
- Ajouter rate limiting plus fort sur tickets et webhooks.
- Ajouter retention/rotation des logs et plafonds triangles/STL/ZIP plus explicites.
- Finir les tests live Stripe et la traversee clavier complete admin/account.

## Historique

L'ancien `main` GitHub a ete sauvegarde dans la branche:

```text
avant-le-wsam
```
