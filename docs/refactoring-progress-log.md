# Journal de progression du refactoring

## Rôle du document

Ce journal sert à reprendre une session sans perdre:

1. la phase en cours
2. le périmètre exact déjà traité
3. les invariants sensibles
4. ce qui a été vérifié
5. ce qui reste risqué

## Ordre de lecture pour une reprise

Avant de reprendre, lire entièrement:

1. `docs/refactoring-plan.md`
2. `docs/refactoring-non-regression-contract.md`
3. `docs/refactoring-smoke-checklist.md`
4. ce journal
5. les fichiers de code ciblés par la phase à reprendre

## Règles d’écriture du journal

1. Une entrée par phase ou sous-phase réellement exécutée.
2. Pas de formulation vague.
3. Pas de “semble ok” sans dire ce qui a été vérifié.
4. Pas de changement de périmètre non noté.
5. Le prochain agent doit pouvoir reprendre uniquement avec les docs et le code.

## Template d’entrée

Copier ce bloc pour chaque nouvelle entrée.

```md
## Entrée YYYY-MM-DD HH:MM TZ

### Phase

- phase:
- sous-scope:

### Fichiers lus entièrement

- 

### Fichiers modifiés

- 

### Ownership déplacé

- 

### Invariants concernés

- 

### Smoke tests prévus

- 

### Smoke tests exécutés

- bloc:
- résultat: ok | ko | non vérifié
- notes:

### Risques résiduels

- 

### Contradictions ou dettes documentaires

- 

### Prochain plus petit pas sûr

- 
```

## État initial

### Situation actuelle

1. Le plan de refactor principal existe.
2. Le contrat de non-régression existe.
3. La checklist de smoke test existe.
4. Aucun refactoring structurel de ces nouvelles phases n’est encore journalisé ici.

### Premier usage attendu

La première vraie entrée doit être créée au démarrage de la prochaine phase exécutée dans le code.

## Entrée 2026-06-24 17:43 EDT

### Phase

- phase: Phase 1 - Stabiliser le contrat HTML Rust/JS
- sous-scope: déplacer la structure du shell/menu créée après rendu par JS vers `render_app_html`, puis supprimer la chirurgie DOM structurelle après `root.innerHTML`.

### Fichiers lus entièrement

- `docs/refactoring-plan.md`
- `docs/refactoring-non-regression-contract.md`
- `docs/refactoring-smoke-checklist.md`
- `docs/refactoring-progress-log.md`
- `wasm/src/lib.rs`
- `app/app.js`

### Fichiers modifiés

- `wasm/src/lib.rs`
- `app/app.js`
- `docs/refactoring-progress-log.md`

### Ownership déplacé

- Rust rend maintenant directement les classes de shell menu, le bloc `menu-kicker`, les wrappers `details.menu-section`, le bouton compte dans les actions header, et le raccourci overlay vers les téléchargements.
- JS ne déplace plus le bouton compte, ne crée plus le bloc kicker, ne wrappe plus les sections de panneau, et n’insère plus le raccourci overlay après `root.innerHTML`.
- JS conserve l’enhancement non structurel des icônes, l’application du thème, la liaison d’événements, l’état UI vivant, le viewer et les appels API.

### Invariants concernés

- App WASM shell/navigation/langue/theme: structure initiale rendue sans panneau vide, onglets `dim`, `decor`, `calcs`, `plan`, bouton compte, et actions principales conservés.
- Viewer 3D: montage du conteneur `#viewer`, contrôles de vue, reset view et modes d’affichage conservés côté hooks.
- Interdits respectés: pas de changement de route publique/admin, endpoint API, code produit, règle billing/auth, géométrie, export ou persistance.

### Smoke tests prévus

- Bloc A: App WASM shell et navigation
- Bloc B: Viewer 3D
- Vérifications ciblées: tests Rust du contrat HTML rendu et parse JS.

### Smoke tests exécutés

- bloc: ciblé Rust
- résultat: ok
- notes: `cargo test` dans `wasm` passe, 27 tests ok, dont nouveaux tests `render_app_html_owns_app_shell_structure` et `render_app_html_localizes_menu_kicker`.

- bloc: ciblé build
- résultat: ok
- notes: `node --check app/app.js`, `cargo test`, et `wasm-pack build --target web` passent sur l’état final. `cargo fmt` a été lancé pendant la phase, puis les hunks de formatage sans lien avec le sous-scope ont été réduits manuellement pour garder un diff ciblé.

- bloc: Bloc A partiel
- résultat: ok
- notes: chargement headless statique sur `http://127.0.0.1:8017/app/index.html` réussi; DOM rendu contient `panel menu-shell`, `menu-kicker`, `menu-section`, onglets principaux, bouton compte header, bouton overlay téléchargements, `#viewer`, et contrôles de vue. Les appels backend `/api/library`, `/api/me`, `/api/admin/session` répondent 404 car test fait sur serveur statique uniquement.

- bloc: Bloc B partiel
- résultat: non vérifié
- notes: le conteneur viewer et les contrôles sont présents; Headless Chromium affiche le fallback WebGL dans cet environnement, donc rotation/zoom/reset réels non vérifiés manuellement.

### Risques résiduels

- Les interactions visuelles complètes A2/A3/B1/B2 restent à vérifier dans un vrai navigateur avec WebGL.
- Le test headless FR/EN complet n’a pas été relancé après le premier chargement: Chromium a ensuite échoué avec une erreur sandbox/crashpad `setsockopt: Operation not permitted`.
- `docs/refactoring-plan.md` était déjà modifié dans le worktree avant cette entrée; non touché pendant cette phase.

### Contradictions ou dettes documentaires

- Aucune contradiction constatée entre la documentation de reprise et le code ciblé pour ce sous-scope.

### Prochain plus petit pas sûr

- Ouvrir l’app dans un navigateur avec WebGL et exécuter manuellement Bloc A complet puis Bloc B complet avant de considérer Phase 1 totalement fermée, ou corriger toute régression visuelle détectée dans ce même périmètre.

## Entrée 2026-06-24 17:54 EDT

### Phase

- phase: Audit de vérification Phase 1 - Stabiliser le contrat HTML Rust/JS
- sous-scope: vérifier le refactoring Phase 1 contre le plan, le contrat de non-régression, la checklist smoke et le code final.

### Fichiers lus entièrement

- `docs/refactoring-resume-message.md`
- `docs/refactoring-plan.md`
- `docs/refactoring-non-regression-contract.md`
- `docs/refactoring-smoke-checklist.md`
- `docs/refactoring-progress-log.md`
- `wasm/src/lib.rs`
- `app/app.js`

### Fichiers modifiés

- `app/app.js`
- `docs/refactoring-progress-log.md`

### Ownership déplacé

- Correction d’audit: les clés i18n JS mortes `menu_kicker_*` et `jump_plan_downloads` ont été supprimées de `app/app.js`; ces textes sont maintenant uniquement rendus et possédés côté Rust pour le shell Phase 1.
- Aucun autre ownership n’a été déplacé pendant cet audit.

### Invariants concernés

- Shell/navigation/langue/thème: hooks de rendu et d’interaction conservés côté Rust/JS.
- I18n: suppression d’une duplication morte dans JS, sans retirer de clé encore utilisée par JS.
- Interdits respectés: aucun changement de route, endpoint API, code produit, règle billing/auth, géométrie, export ou persistance.

### Smoke tests prévus

- Bloc A: App WASM shell et navigation
- Bloc B: Viewer 3D
- Vérifications ciblées: diff, absence de chirurgie DOM structurelle, hooks critiques, parse JS, tests Rust, build WASM.

### Smoke tests exécutés

- bloc: audit diff / ownership
- résultat: ok
- notes: `rewriteLeftMenu`, `wrapPanelSections`, `addPlanDownloadShortcut`, `leftMenuRemodel` et `menuSectionsWrapped` absents de `app/app.js` et `wasm/src/lib.rs`; les hooks critiques `data-tab`, `data-panel`, `account-modal-open`, `reset-view`, `jump-plan-downloads` et `#viewer` sont rendus par Rust.

- bloc: ciblé JS
- résultat: ok
- notes: `node --check app/app.js` passe après suppression des clés i18n mortes.

- bloc: ciblé Rust
- résultat: ok
- notes: `cargo check` et `cargo test` dans `wasm` passent; 27 tests ok.

- bloc: ciblé build
- résultat: ok
- notes: `wasm-pack build --target web` passe sur l’état final.

- bloc: Bloc A navigateur headless
- résultat: non vérifié
- notes: Chromium et Google Chrome échouent avant chargement avec `crashpad setsockopt: Operation not permitted`; Firefox headless échoue avec code 139. Le serveur statique temporaire a été arrêté.

- bloc: Bloc B navigateur headless
- résultat: non vérifié
- notes: les moteurs headless disponibles ne permettent pas de vérifier les interactions WebGL dans cet environnement.

### Risques résiduels

- A2/A3/B1/B2 restent à exécuter dans un vrai navigateur avec WebGL: bascule FR/EN, clics onglets, ouverture compte, rotation/zoom/reset viewer et changement de modes.
- Les API backend ne sont pas concernées par Phase 1 et n’ont pas été exercées dans cet audit.

### Contradictions ou dettes documentaires

- Aucune contradiction détectée entre les documents de reprise et le code final Phase 1.

### Prochain plus petit pas sûr

- Effectuer le smoke manuel Bloc A complet et Bloc B complet dans le navigateur graphique local; si une régression visuelle ou WebGL apparaît, la corriger avant Phase 2.
