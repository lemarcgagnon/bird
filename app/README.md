# App navigateur

Role: front-end principal charge par `/app/index.html`. Il monte l'interface generee par le module Rust/WASM, affiche le viewer Three.js, gere les controles, les exports et les appels au serveur PHP.

Fichiers importants:

- `index.html`: shell minimal de l'app et versions cache-busting CSS/JS.
- `app.js`: orchestration navigateur, viewer 3D, compte client, appels API PHP, imports decor, exports autorises.
- `style.css`: styles de l'app WASM.

Regles d'architecture:

- Le serveur PHP est la source de verite pour comptes, credits, abonnements, tickets et autorisations.
- L'app ne doit garder qu'un resume de compte et des liens vers le site PHP.
- Le WASM genere localement geometrie, plans, STL, OBJ, ZIP, PDF et PNG.
- Ne pas mettre de secret Stripe, admin, licence ou cle serveur dans ce dossier.
- Le modal compte peut afficher et repondre aux tickets, mais le serveur PHP reste la source de verite.

Points de vigilance:

- `window.NICHOIR_PHP_BASE` peut forcer l'origine PHP hors dev.
- `window.NICHOIR_DEMO_ACCOUNT` peut activer un compte demo explicite hors localhost.
- Les fichiers decor importes sont limites cote JS et les SVG passent par `assertSafeSvgText` avant stockage/rasterisation.
- Le SVG du plan insere dans `innerHTML` vient du WASM local, pas d'un fichier utilisateur importe.
- Les exports premium doivent passer par `/api/exports/authorize` puis `/api/exports/consume`.

Validation utile:

```bash
node --check app/app.js
```
