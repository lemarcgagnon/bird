# Securisons Nichoir WASM

Date: 2026-06-12

Objectif: reduire les risques d'attaque dans l'app Nichoir WASM tout en gardant le calcul, la geometrie et les exports cote client. Le serveur futur servira surtout a l'autorisation/licence/facturation, pas au calcul lourd.

## 1. Principe general

L'app ne doit jamais faire confiance aux donnees utilisateur, meme si tout tourne dans le navigateur.

Surfaces a proteger:

- Fichiers importes: SVG, PNG, JPG/JPEG, GIF, WEBP.
- Parametres UI: sliders, champs numeriques, toggles.
- JSON envoye au WASM.
- Decodeurs image Rust/WASM.
- Generation mesh/STL/ZIP.
- Couche PHP d'autorisation/facturation/admin/webhook.

## 2. Risques principaux

### SVG

Un SVG peut contenir autre chose que de la geometrie:

- scripts;
- events inline comme `onload`, `onclick`;
- `foreignObject` avec HTML embarque;
- references externes;
- CSS avec `@import`;
- liens `href` ou `xlink:href` vers reseau;
- definitions enormes ou tres complexes;
- chemins/path tres longs.

Meme sans backend, un SVG malveillant peut viser le navigateur, saturer la memoire ou ralentir l'app.

### Images raster

PNG/JPG/GIF/WEBP peuvent poser probleme:

- fichier trop gros;
- dimensions decodees enormes;
- decompression bomb;
- GIF anime tres lourd;
- image volontairement creee pour faire planter un decodeur;
- explosion du nombre de triangles si la resolution heightmap est trop haute.

### Inputs numeriques

Les champs utilisateur peuvent causer:

- `NaN`;
- `Infinity`;
- valeurs negatives absurdes;
- dimensions enormes;
- profondeur relief trop grande;
- resolution heightmap trop haute;
- STL/ZIP gigantesque;
- mesh non fini ou impossible a imprimer.

## 3. Mesures de securite fichier

### 3.1 Validation fichier avant lecture

Cote JS, avant de lire un fichier:

- taille max fichier: `2 MB` par defaut dans l'app actuelle;
- extensions acceptees: `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`;
- MIME accepte si disponible: `image/svg+xml`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`;
- refuser tout autre type.

Pour GIF:

- utiliser comme image fixe seulement;
- ne pas supporter l'animation dans la premiere version securisee.

Etat: limite fichier et validation type deja ajoutees cote app.

### 3.2 Sanitization SVG

Avant rasterisation SVG:

- refuser `<script>`;
- refuser `<foreignObject>`;
- refuser `<iframe>`;
- refuser `<object>`;
- refuser `<embed>`;
- refuser les attributs `on...=`;
- refuser `href="http..."` et `xlink:href="http..."`;
- refuser `@import`;
- limiter la longueur du texte SVG;
- ne jamais injecter le SVG brut dans `innerHTML`.

Approche recommandee:

- parser le SVG comme texte;
- appliquer une fonction `assertSafeSvgText(svgText)`;
- si un pattern interdit est detecte, refuser le fichier avec message clair;
- rasteriser seulement le SVG sanitise.

Etat: premiere passe ajoutee cote app. Elle refuse scripts, `foreignObject`, embeds, events inline, styles externes, references externes dangereuses, DOCTYPE/entity et SVG invalide.

### 3.3 Limites rasterisation

Pour la rasterisation SVG vers PNG:

- taille canvas max: `1024 x 1024`;
- taille par defaut: `resolution * 4`, clamp entre `64` et `1024`;
- pas de chargement reseau externe;
- fond controle localement par l'app.

### 3.4 Validation image decodee cote Rust/WASM

Cote Rust, apres decode image:

- refuser si largeur ou hauteur inferieure a `2`;
- refuser si largeur ou hauteur superieure a `4096`;
- refuser si `width * height` depasse un plafond, par exemple `16_777_216` pixels;
- refuser si decode impossible;
- retourner un mesh vide ou une erreur structuree, pas un panic.

Etat: plafonds `4096 x 4096` et `16_777_216` pixels ajoutes avant conversion RGBA.

## 4. Validation des parametres WASM

Une fonction Rust de normalisation stricte existe maintenant et est appelee par les entrees WASM qui passent par `parse_input`:

```rust
fn sanitize_params(mut p: NichoirParams) -> NichoirParams {
    p.w = clamp_finite(p.w, 80.0, 400.0, 160.0);
    p.h = clamp_finite(p.h, 80.0, 500.0, 220.0);
    p.d = clamp_finite(p.d, 80.0, 400.0, 160.0);
    p.slope = clamp_finite(p.slope, 10.0, 60.0, 45.0);
    p.t = clamp_finite(p.t, 3.0, 25.0, 12.0);
    p
}
```

Champs decor a limiter:

- largeur decor: `5..400 mm`;
- hauteur decor: `5..400 mm`;
- profondeur: `0.2..20 mm`;
- resolution heightmap: `8..256`;
- smooth: `0..100`;
- bevel: `0..100`;
- threshold: `0..60`;
- rotation: `0..360`;
- source text SVG max: par exemple `1 MB`;
- source data base64 max: `3_000_000` caracteres dans l'etat actuel.

Regle importante:

- Les limites UI ne suffisent pas.
- Les limites doivent exister dans Rust/WASM aussi.
- Etat: premiere passe faite pour dimensions, modes, unites, panneaux, porte, perchoir, trous, decor, source SVG et source image.

## 5. Protection exports STL/ZIP

Avant export:

- refuser mesh vide;
- refuser valeurs non finies;
- refuser triangle count trop haut;
- refuser taille STL estimee trop haute;
- garder `mesh_report_json` comme diagnostic.

Plafonds proposes:

- STL maison complete: max `1_000_000` triangles;
- chaque piece ZIP: max `500_000` triangles;
- ZIP final: max `250 MB` en premiere version;
- resolution par defaut raisonnable: `64` ou `128`, pas `256`.

## 6. Backend futur et facturation

Le client/WASM ne doit pas etre considere comme une protection forte.

Pour la facturation/licence/gestion client:

- le serveur valide session/licence;
- le serveur gere comptes, credits, abonnements, paiements, messages et tickets;
- le serveur sert aussi les pages publiques, l'espace client, l'admin prive et les webhooks Stripe;
- le serveur ne fait pas les calculs lourds;
- le serveur emet une autorisation court terme pour un export precis;
- l'app verifie cette autorisation pour debloquer le telechargement;
- Stripe reste cote serveur via un lien Checkout genere par l'API;
- Stripe synchronise les paiements/abonnements via un webhook PHP, jamais via le WASM;
- ne jamais mettre les secrets Stripe dans le WASM;
- ne jamais stocker le solde de credits comme verite dans le WASM;
- ne jamais mettre l'admin client dans le WASM;
- ne jamais faire confiance a une verification uniquement cote client.

Architecture serveur cible:

- `/`: landing page publique.
- `/pricing`: credits et abonnements.
- `/app/`: application Rust/WASM.
- `/account`: espace client authentifie.
- `/admin`: back-office prive pour gerer clients, credits, abonnements, paiements, consommations et tickets.
- `/api/...`: API JSON.
- `/stripe/webhook`: reception des evenements Stripe.

Flux cible pour un telechargement:

1. L'utilisateur demande un export dans l'app WASM.
2. Le front-end appelle `POST /api/exports/authorize` avec le type d'export.
3. Le serveur verifie session, abonnement, credits et regles commerciales.
4. Si autorise, le serveur retourne une autorisation courte et reserve/debite les credits selon la strategie retenue.
5. Le WASM genere le fichier localement.
6. Le front-end appelle `POST /api/exports/consume` pour confirmer la consommation si necessaire.

Le serveur ne doit pas recevoir le STL, le PDF, le ZIP, les panneaux ou la geometrie complete sauf besoin volontaire de support/debug.

Objectif realiste:

- Le WASM protege mieux que HTML/JS clair contre la copie directe.
- Mais il ne remplace pas une vraie autorisation serveur.

## 6.1 Surface API/admin actuelle

Mesures deja en place:

- Sanitizer SVG cote app avant rasterisation.
- Normalisation stricte des parametres cote Rust/WASM.
- Plafonds image decodee cote Rust/WASM.
- CORS configurable via `NICHOIR_CORS_ORIGINS`; par defaut seul `http://127.0.0.1:8016` est autorise pour le dev.
- Headers PHP de base: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
- Payload JSON limite a `256 KiB`.
- Offres checkout limitees a `credits`, `atelier`, `pro`.
- Types d'export limites a `svg`, `png`, `pdf`, `stl`, `zip`; type inconnu refuse.
- `consume` reverifie le statut du compte et le solde au moment du debit.
- Champs compte/tickets limites cote serveur.
- Admin CRUD centralise cote PHP; le WASM ne gere pas les clients.
- SMTP tickets configurable dans `/admin`; le mot de passe peut venir de `NICHOIR_SMTP_PASSWORD` pour eviter de stocker le secret dans SQLite en production.

Risques restants avant production:

- Ajouter plafonds triangles/STL/ZIP et refus explicite d'export trop lourd.
- Ajouter rate limiting sur login, inscription, tickets et webhooks.
- Ajouter CSRF robuste si l'admin passe a une session/cookie.
- Remplacer le `key` admin en query string par une authentification admin propre.
- Brancher la vraie signature Stripe (`Stripe-Signature`) et desactiver tout webhook non signe hors local.
- Ajouter une politique CSP adaptee aux pages PHP et a l'app.
- Remplacer ou completer le hard delete admin par une politique de retention/soft delete.
- Revoir le stockage du bearer token dans `localStorage` si l'app devient exposee a du contenu tiers.
- Proteger les secrets SMTP comme les secrets Stripe: acces admin strict, variables serveur preferees, pas de commit de base contenant un vrai mot de passe.

## 7. Plan d'implementation recommande

### Phase 1: securite fichiers

- Ajouter `assertSafeSvgText` dans `app/app.js`. Fait.
- Ajouter limite taille fichier. Fait: `2 MB`.
- Ajouter messages d'erreur utilisateur. Fait, premiere passe.
- Rejeter SVG dangereux avant rasterisation. Fait, premiere passe.

### Phase 2: validation Rust

- Ajouter `sanitize_params`. Fait.
- Appliquer `sanitize_params` dans toutes les entrees WASM. Fait via `parse_input` pour:
  - `render_app_html`;
  - `scene_meshes_json`;
  - `export_house_stl`;
  - `export_house_obj`;
  - `export_door_stl`;
  - `export_panels_zip`;
  - `mesh_report_json`;
  - `plan_preview_svg`.

### Phase 3: limites mesh/export

- Ajouter plafonds triangles.
- Ajouter refus export si STL trop gros.
- Ajouter diagnostic clair dans `mesh_report_json`.

### Phase 4: autorisation/facturation/compte

- Ajouter mini serveur PHP/SQLite d'autorisation et compte. Fait.
- Tester SQLite local. Fait.
- Ajouter API pour compte, credits, abonnement, tickets et messages. Fait, avec limites de base.
- Ajouter landing page, espace client et admin PHP. Fait.
- Ajouter Stripe Checkout link puis webhook PHP. En place en placeholder/dev; signature reelle reste a brancher.
- Garder calcul client-side. Fait.

## 8. Checklist rapide

- [x] Refuser fichier > 2 MB dans l'app.
- [x] Refuser SVG avec scripts/events/foreignObject/liens externes.
- [x] Refuser raster > 4096 x 4096.
- [x] Clamper les inputs principaux en Rust.
- [x] Refuser ou neutraliser les valeurs non finies via parsing/clamps.
- [ ] Limiter triangles STL/ZIP.
- [ ] Garder GIF comme image fixe.
- [x] Ne pas injecter les SVG importes dans `innerHTML`; seulement les SVG generes par le WASM pour le plan.
- [ ] Ne jamais stocker secrets dans WASM.
- [x] Limiter payload JSON API.
- [x] Valider offres checkout et types d'export.
- [x] Revalider statut/credits au debit d'export.
- [ ] Ajouter rate limiting serveur.
- [ ] Ajouter CSRF/admin auth production.
- [ ] Activer signature Stripe reelle.
- [x] Ajouter tests avec entrees invalides pour clamps et SVG dangereux.
