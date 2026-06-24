# Message de reprise prêt à copier-coller

Copier-coller ce message tel quel au prochain agent quand tu veux reprendre le refactoring.

---

Tu reprends un refactoring structurel du dépôt. Tu dois suivre strictement la documentation de reprise et ne faire aucune hypothèse basée sur une lecture partielle.

Ordre de lecture obligatoire, entièrement, avant toute action:

1. `docs/refactoring-plan.md`
2. `docs/refactoring-non-regression-contract.md`
3. `docs/refactoring-smoke-checklist.md`
4. `docs/refactoring-progress-log.md`

Ensuite:

5. choisis une seule phase
6. lis entièrement tous les fichiers de code ciblés par cette phase avant d’éditer
7. annonce la phase exacte, le sous-scope exact, les fichiers exacts à toucher, les invariants concernés, et les blocs de smoke test prévus

Règles impératives:

1. ne lis pas partiellement un gros fichier ciblé puis n’extrapole pas
2. ne touche qu’une seule phase à la fois, sauf dépendance mécanique directe
3. ne duplique pas la logique déplacée
4. ne change pas silencieusement les chemins publics, chemins admin, endpoints API, codes produit, règles de débit, règles d’autorisation, ou invariants géométriques
5. mets à jour `docs/refactoring-progress-log.md` à la fin de la phase

Phases et fichiers de code à lire entièrement:

### Phase 1: stabiliser le contrat HTML Rust/JS

Lire:

1. `wasm/src/lib.rs`
2. `app/app.js`

### Phase 2: mutualiser le runtime STL preview

Lire:

1. `app/app.js`
2. `server-php/public/library-preview.js`

### Phase 3: découper le frontend app

Lire:

1. `app/app.js`
2. `app/style.css`

### Phase 4: découper le WASM

Lire:

1. `wasm/src/lib.rs`

### Phase 5: découper les routes PHP

Lire:

1. `server-php/public/index.php`

### Phase 6: découper l’admin

Lire:

1. `server-php/src/admin_pages.php`
2. `server-php/public/site.css`
3. `server-php/src/admin_actions.php`
4. `server-php/src/admin_core.php`

### Phase 7: découper les CSS

Lire:

1. `app/style.css`
2. `server-php/public/site.css`

### Phase 8: centraliser l’i18n

Lire:

1. `server-php/src/i18n.php`
2. `app/app.js`
3. `wasm/src/lib.rs`

Livrable attendu avant toute modification:

1. la phase choisie
2. le sous-scope choisi
3. la liste des fichiers lus
4. la liste des fichiers à modifier
5. les invariants à préserver
6. les blocs de smoke test à exécuter

Livrable attendu en fin de phase:

1. mise à jour de `docs/refactoring-progress-log.md`
2. description de l’ownership déplacé
3. liste des vérifications réellement effectuées
4. risques résiduels
5. prochain plus petit pas sûr

Si la doc et le code se contredisent:

1. arrête
2. note la contradiction dans `docs/refactoring-progress-log.md`
3. corrige d’abord la documentation de reprise
4. seulement ensuite poursuis le refactoring

---

## Version courte

Si tu veux une version minimale à coller:

```text
Lis entièrement, dans cet ordre:
1. docs/refactoring-plan.md
2. docs/refactoring-non-regression-contract.md
3. docs/refactoring-smoke-checklist.md
4. docs/refactoring-progress-log.md

Ensuite choisis une seule phase, lis entièrement tous les fichiers de code ciblés par cette phase, puis annonce:
- phase exacte
- sous-scope exact
- fichiers lus
- fichiers à modifier
- invariants à préserver
- smoke tests prévus

Règles:
- pas de lecture partielle avec extrapolation
- pas de mélange de phases
- pas de duplication de logique déplacée
- pas de changement silencieux sur routes, billing, auth, géométrie, exports
- mise à jour obligatoire de docs/refactoring-progress-log.md en fin de phase
```
