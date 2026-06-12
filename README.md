# Nichoir WASM

Application web pour concevoir un nichoir parametrable, visualiser le modele 3D et exporter des fichiers de fabrication. Cette version migre la logique principale vers Rust compile en WebAssembly afin que les calculs, la geometrie et les exports s'executent cote client.

## Objectif du projet

Le but est de remplacer l'ancienne app HTML/JavaScript par une app WASM plus difficile a copier directement et plus robuste pour la generation de geometrie.

Principes du projet:

- Le navigateur calcule le modele, les pieces, le plan de coupe et les exports.
- Le serveur PHP sert la landing page, l'espace client/admin, l'API, l'autorisation, les credits, les abonnements et Stripe.
- Les fichiers STL/OBJ/ZIP sont generes localement pour eviter les couts CPU et transfert serveur.
- Le serveur ne recoit pas la geometrie lourde et ne genere pas les STL/PDF/ZIP.
- `nichoir_v16.html` reste une reference fonctionnelle historique, pas l'app finale.

## Architecture cible du site

En production, le site doit etre un site PHP unique qui sert les pages publiques, l'app WASM et l'API:

```text
/                 Landing page publique
/pricing          Offres, credits et abonnements
/app/             Application Rust/WASM de conception
/account          Espace client: profil, credits, abonnement, factures, tickets
/admin            Administration privee: clients, billing, exports, tickets, logs, reglages
/api/...          API JSON utilisee par l'app et l'espace client
/stripe/webhook   Webhook Stripe cote serveur
```

Separation des responsabilites:

- Rust/WASM: geometrie, calculs, viewer, plans, STL, ZIP, decorations.
- JavaScript front: glue navigateur, appels API, telechargements, Three.js.
- PHP/API: comptes, sessions, credits, abonnements, tickets, paiements, webhooks Stripe, autorisations courtes.
- Logs/audit: evenements applicatifs, securite, actions admin/client, erreurs client/WASM et webhooks Stripe.
- Stripe: paiement externe; les secrets et webhooks restent toujours cote PHP.

## Carte rapide du repo

- `app/`: interface navigateur, viewer Three.js, appels API PHP et exports. Voir `app/README.md`.
- `installation/`: assistant d'installation serveur temporaire. Voir `installation/README.md`.
- `wasm/`: coeur Rust compile en WebAssembly. Voir `wasm/README.md`.
- `server-php/`: serveur cible PHP SQLite/MySQL pour site, API, admin, comptes, credits, tickets, Stripe et cPanel. Voir `server-php/README.md`.
- `server/`: prototype FastAPI historique de licence, secondaire. Voir `server/README.md`.
- `docs/`: roadmap et securite. Voir `docs/README.md`.
- `scripts/`: validations locales, surtout smoke tests mesh. Voir `scripts/README.md`.
- `nichoir_v16.html`: ancienne reference fonctionnelle monofichier, pas l'app finale.

## Lancer l'app localement

En dev, utiliser deux serveurs pour eviter de melanger l'app statique et l'API:

```bash
cd /home/marc/Documents/nichoir16
php -S 127.0.0.1:8016 -t /home/marc/Documents/nichoir16
```

Dans un autre terminal:

```bash
cd /home/marc/Documents/nichoir16
php -S 127.0.0.1:8021 -t /home/marc/Documents/nichoir16/server-php/public
```

Puis ouvrir l'app:

```text
http://127.0.0.1:8016/app/index.html
```

Si le navigateur garde une ancienne version, faire `Ctrl+F5`.

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

Le package genere est dans:

```text
wasm/pkg/
```

Ce dossier est utilise par `app/app.js`.

## Structure du projet

```text
app/
  index.html      Coquille web minimale
  app.js          Glue JS, viewer Three.js, telechargements
  style.css       Interface, light/dark mode

wasm/
  Cargo.toml
  src/lib.rs      Logique Rust/WASM: UI, geometrie, calculs, exports
  pkg/            Sortie wasm-pack

docs/
  reste-a-faire.md  Etat fonctionnel et roadmap
  securizons.md     Notes de securite fichiers/inputs/WASM

server/
  Ancienne API FastAPI/SQLite de prototype, gardee comme reference historique

server-php/
  Backend PHP local/cPanel: site public, compte, admin, credits, billing Stripe, autorisations, tickets, config DB

installation/
  index.php       Installateur web temporaire pour DB/migrations/SMTP/lock

scripts/
  mesh-smoke.mjs  Smoke test mesh/STL

nichoir_v16.html  Ancienne reference fonctionnelle
rust-plan.md      Plan de migration Rust/WASM
```

## Fonctionnalites principales

- Dimensions en `mm`, `cm` et `in`.
- Largeur, hauteur, profondeur, epaisseur et evasement.
- Plancher `enclave` ou `pose`.
- Toit avec pente, debordement pluie et jonction de crete.
- Jonction de crete `gauche`, `droit` ou `onglet`.
- Porte `aucune`, `ronde`, `carree` ou `pentagonale`.
- Panneau de porte optionnel.
- Perchoir cylindrique optionnel.
- Jusqu'a quatre trous de suspension dans le toit.
- Viewer 3D avec modes plein, filaire, rayons X et aretes.
- Mode eclate.
- Recentrage de la vue.
- Light mode et dark mode.
- Interface avec divulgation progressive pour reduire les menus.

## Decorations

La section `Decor` permet d'importer des fichiers pour generer du relief sur les panneaux.

Formats supportes:

- SVG
- PNG
- JPG/JPEG
- GIF comme image fixe
- WEBP

Modes:

- `Vectoriel`: extrusion simple de formes SVG.
- `Heightmap`: relief selon la luminance de l'image.

Controles disponibles:

- taille;
- position;
- rotation;
- profondeur;
- resolution;
- suppression optionnelle du fond blanc/transparent;
- inversion;
- autosmooth;
- bevel/chamfer;
- seuil anti-bruit;
- clipping au panneau.

Sur la facade avant, le decor est coupe pour ne pas recouvrir la porte d'entree ou le trou du perchoir.

## Exports

Exports actuellement disponibles:

- STL maison complete;
- OBJ maison complete pour debug;
- STL porte;
- ZIP de panneaux separes;
- plan de coupe SVG.

Important pour l'impression 3D:

- Les pieces separees du ZIP sont l'objectif principal pour fabrication par panneaux.
- Le STL maison complete est un assemblage de panneaux en contact.
- Pour une maison complete parfaitement fusionnee en un seul solide manifold, il faudra ajouter une vraie union booleenne/CSG.

## Plan de coupe

Le plan de coupe utilise:

- formats de panneaux commerciaux;
- dimensions custom;
- trait de scie;
- placement 2D des pieces;
- statistiques d'utilisation.

Les valeurs affichees respectent l'unite choisie par l'utilisateur.

## Tests et diagnostics

Build WASM:

```bash
cd wasm
wasm-pack build --target web
```

Smoke test mesh:

```bash
node scripts/mesh-smoke.mjs
```

Diagnostic depuis l'interface:

- bouton `Rapport mesh`;
- export OBJ pour ouvrir dans Blender ou inspecter la geometrie.

## Securite

Le document detaille est ici:

```text
docs/securizons.md
```

Points importants:

- Ne jamais faire confiance aux fichiers importes.
- Sanitize les SVG avant rasterisation ou extrusion.
- Limiter la taille des fichiers et images decodees.
- Clamper les inputs numeriques cote Rust/WASM, pas seulement dans l'UI.
- Refuser les meshes vides, non finis ou trop lourds avant export.
- Ne jamais placer de secrets Stripe ou licence dans le WASM.

## Backend PHP local

Le dossier `server-php/` contient le backend cible pour tester le site PHP, les comptes, les credits, le billing Stripe, l'autorisation d'export et les tickets. SQLite est le mode local; MySQL/cPanel est supporte via `/admin` > `Reglages`.

Demarrage:

```bash
cd /home/marc/Documents/nichoir16
php -S 127.0.0.1:8021 -t server-php/public
```

Cette API ne fait pas la geometrie. Elle valide la session, retourne l'etat du compte, expose l'historique credits et billing, cree les sessions Stripe, autorise les exports et debite les credits apres generation locale reussie.

Etat actuel:

- PHP sert deja `/`, `/pricing`, `/account`, `/admin` et `/api/...`.
- `/account` gere login/register/logout, activation compte par code email, edition profil, credits, historique, abonnement, portail Stripe, paiements/factures, creation de tickets, fil de messages, reponses client et statut open/closed.
- `/admin` gere repertoire utilisateurs, creation, edition profil, reset mot de passe, suppression confirmee, credits, suspension/reactivation, abonnement manuel, tickets avec fil/reponse/statut/priorite/assignation, logs applicatifs/audit/Stripe, configuration DB cPanel/MySQL, configuration Stripe, configuration SMTP cPanel, paiements/factures et exports DB CSV/Excel/JSON.
- `/api/client-log` recoit les erreurs client/WASM limitees a 10/minute par user/IP, sans geometrie ni contenu de formulaire.
- `/stripe/webhook` verifie `Stripe-Signature` quand le secret est configure, journalise `stripe_events` et `stripe_event_logs`, puis applique `checkout.session.completed`, `invoice.*` ou `customer.subscription.*`.
- L'app WASM garde seulement un resume compte et des liens vers le site; le serveur PHP reste la source de verite. Le shell WASM expose maintenant une navigation FR/EN avec icones sur les zones denses, un modal compte plus lisible et une sortie persistante `Site` dans l'en-tete pour revenir au site PHP. Hors localhost, le login demo rapide est desactive sauf config explicite `window.NICHOIR_DEMO_ACCOUNT`.
- Garde-fous API ajoutes: CORS configurable par `NICHOIR_CORS_ORIGINS`, payload JSON limite, validation stricte des offres/types d'export, revalidation du compte au debit, rate limit auth par IP/email, quotas email activation, limites serveur sur tickets/profil et headers HTTP de base.
- Garde-fous app ajoutes: limite `2 Mo` sur les fichiers decor importes et configuration PHP/demo hors build local.
- Stripe Checkout/portail/factures sont branches cote PHP. Avant production, il faut tester avec les vrais price IDs, activer le portail dans le dashboard Stripe et configurer `NICHOIR_STRIPE_WEBHOOK_SECRET`.

Deploiement cPanel:

- pointer le document root vers `server-php/public`;
- garder `server-php/src`, `server-php/data` et `server-php/migrations` hors web public;
- creer la base et l'utilisateur MySQL dans cPanel, puis tester/enregistrer dans `/admin` > `Reglages` > `Base de donnees`;
- le fichier local `server-php/data/db-config.php` est ignore par Git;
- sinon, deployer la racine du projet avec le `.htaccess` versionne, ouvrir `/installation/`, terminer le setup, puis supprimer ce dossier du serveur;
- l'installateur pose `server-php/data/installed.lock.php` pour bloquer une seconde installation; ce fichier est local, non versionne, et doit rester hors Git;
- definir `NICHOIR_LOG_HASH_SALT` en production pour hasher IP/courriels dans les logs sans exposer les valeurs brutes.

Risques securite encore ouverts avant production:

- Ajouter rate limiting sur tickets et webhooks; login, inscription, activation, renvoi de code et logs client sont deja limites.
- Ajouter CSRF et authentification admin propre; ne pas utiliser un `key` en query string en production.
- Configurer `NICHOIR_STRIPE_WEBHOOK_SECRET` et tester les webhooks Stripe live.
- Ajouter CSP, retention/rotation des logs, CSRF admin et plafonds triangles/STL/ZIP. Sanitizer SVG et clamps Rust/WASM ont maintenant une premiere passe.

## Roadmap courte

- Finaliser la parite fonctionnelle avec `nichoir_v16.html`.
- Continuer le nettoyage HIG de l'interface.
- Ajouter les coupes X/Y/Z dans le viewer.
- Completer la parite du plan de coupe.
- Ajouter une suite de tests de parite entre presets.
- Renforcer la validation securite des fichiers et inputs.
- Etudier une union booleenne/CSG pour produire une maison complete fusionnee.
- Completer le contenu produit de la landing page et de `/pricing`.
- Ajouter filtres billing avances, surveillance des echecs email et audit lisible dans `/admin`.
- Tester Stripe live avec les vrais price IDs et le portail active dans Stripe.
- Documenter la procedure finale cPanel autour de `/installation/`, `.htaccess` et suppression post-setup.

## Branche de sauvegarde

L'ancien `main` GitHub a ete sauvegarde dans:

```text
avant-le-wsam
```

La branche `main` contient maintenant la version Rust/WASM.
