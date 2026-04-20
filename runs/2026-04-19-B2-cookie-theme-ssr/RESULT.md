# RESULT — B2 hydration mismatch `data-theme` résolu par cookie SSR

**Status** : ✅ COMPLÉTÉ
**Date** : 2026-04-19
**Acceptance** : 13/13 critères TASK.md passés
**Tests** : 428/428 verts (était 424)

---

## Evidence Document

### Problème

`apps/demo/app/layout.tsx:15` portait `suppressHydrationWarning` sur `<html>` pour **masquer** un mismatch SSR/client sur l'attribut `data-theme`. Le mismatch provenait du script inline injecté par `apps/demo/app/layout.tsx:24` via `THEME_BOOT_SCRIPT` (import `packages/nichoir-ui/src/theme-boot.ts`) qui, en pre-paint client, lisait `localStorage` + `prefers-color-scheme` et mutait `document.documentElement.dataset.theme`. Le serveur, lui, rendait `<html>` sans `data-theme`. Le `suppressHydrationWarning` supprimait le warning sans éliminer la cause. Dette B2 dans HANDOVER.md:120 et 193.

### Matériaux examinés (lectures intégrales)

- `apps/demo/app/layout.tsx` (29 l)
- `apps/demo/app/tools/nichoir/page.tsx` (20 l)
- `packages/nichoir-ui/src/theme-boot.ts` (13 l)
- `packages/nichoir-ui/src/components/primitives/ThemeToggle.tsx` (67 l)
- `packages/nichoir-ui/src/index.ts` (45 l)
- `packages/nichoir-ui/package.json` (50 l, y compris sous-paths `./app` + `./theme-boot` ajoutés par codex aujourd'hui 20:31)
- `packages/nichoir-ui/tests/lang-theme.test.tsx` (99 l)
- `packages/nichoir-ui/tests/root-layout.test.tsx` (17 l)
- `packages/nichoir-ui/vitest.config.ts` (8 l)
- `packages/nichoir-core/src/state.ts` (78 l)
- `node_modules/next/dist/server/request/cookies.d.ts` (25 l)

### Symptômes observés

Diag puppeteer (`/tmp/nichoir-screenshots/diag-hydration-v2.mjs`, pre-fix) sur 4 scenarios (default, localStorage=dark, localStorage=light, prefers-color-scheme dark) :
- `<html>` rendu côté serveur sans `data-theme`
- Client ajoutait `data-theme="light|dark"` avant hydration via script inline
- `suppressHydrationWarning: true` supprimait le warning — user voyait zéro mismatch en console
- Mais le mismatch structurel existait : 2 représentations HTML différentes server vs client

### Cause racine (labellée)

**Inferred (supporté par lectures directes)** : l'architecture initiale faisait du theme-resolution côté client, après hydration. Le serveur n'avait aucun moyen de connaître le thème de l'utilisateur → rendait un thème par défaut → mismatch inévitable → recours au masquage par `suppressHydrationWarning`. Le vrai correctif architectural = rendre le serveur capable de connaître le thème **avant** de générer le HTML, via un cookie lu dans un RSC async.

### Résolution appliquée

1. **Création** : `apps/demo/app/theme-resolver.ts` — fonction pure `resolveTheme(cookieValue: string | undefined): 'light' | 'dark'` (fallback 'light' sur tout ce qui n'est pas exactement 'dark' ou 'light', empêche toute injection). Exporte aussi `THEME_COOKIE_NAME = 'nichoir-theme'`.

2. **Réécriture** : `apps/demo/app/layout.tsx` devient async RSC, `await cookies()` lit le cookie, `resolveTheme()` valide, et `<html lang="fr" data-theme={theme}>` est rendu directement par le serveur. Retrait complet de `suppressHydrationWarning`, du script inline, et de l'import `THEME_BOOT_SCRIPT`.

3. **Modification** : `packages/nichoir-ui/src/components/primitives/ThemeToggle.tsx:45-56` — `setTheme()` écrit maintenant `document.cookie` (`path=/; max-age=31536000; samesite=lax`) au lieu de localStorage. Le cookie devient la source d'autorité server-side.

4. **Suppression** : `packages/nichoir-ui/src/theme-boot.ts` (plus de script à injecter). Export retiré de `packages/nichoir-ui/src/index.ts`. Subpath `./theme-boot` retiré de `packages/nichoir-ui/package.json`.

5. **Tests** :
   - Nouveau `packages/nichoir-ui/tests/theme-resolver.test.ts` (5 tests unit) couvre resolveTheme : dark valid, light valid, undefined fallback, injection fallback, nom de cookie.
   - `lang-theme.test.tsx` : 3 tests localStorage remplacés par tests cookie. Cookie round-trip write/read confirmé via jsdom.
   - `root-layout.test.tsx` supprimé (testait `suppressHydrationWarning: true` qui n'existe plus, et pattern d'appel sync incompatible avec async RSC).

### Validation matérielle (evidence directe, pas déléguée)

| Check | Command | Résultat | Artifact |
|---|---|---|---|
| Next 15 `cookies()` async | read node_modules types | `cookies(): Promise<ReadonlyRequestCookies>` | — |
| vitest mock next/headers (spike) | `vitest run tests/_spike-next-headers.test.ts` | FAILED (attendu) — plan révisé | — |
| jsdom document.cookie (spike) | `vitest run tests/_spike-jsdom-cookie.test.ts` | 2/2 PASSED | — |
| Typecheck | `pnpm -r typecheck` | 4/4 Done | — |
| Tests | `pnpm -r test` | 428/428 passed | — |
| Lint | `pnpm -r lint` | 4/4 Done | — |
| Build + route status | `pnpm -C apps/demo build` | `/tools/nichoir ƒ (Dynamic)` confirmé | `artifacts/build-output.txt` |
| SSR cookie=dark | `curl -H 'Cookie: nichoir-theme=dark'` | `<html lang="fr" data-theme="dark">` | `artifacts/curl-evidence.txt` |
| SSR cookie=light | `curl -H 'Cookie: nichoir-theme=light'` | `<html lang="fr" data-theme="light">` | `artifacts/curl-evidence.txt` |
| SSR no cookie (fallback) | `curl` sans header | `<html lang="fr" data-theme="light">` | `artifacts/curl-evidence.txt` |
| SSR injection attempt | `curl -H 'Cookie: nichoir-theme=<script>alert(1)</script>'` | `<html lang="fr" data-theme="light">` (safe fallback) | `artifacts/curl-evidence.txt` |
| Script anti-FOUC absent | `curl \| grep -c 'localStorage.getItem'` | 0 occurrences | `artifacts/curl-evidence.txt` |
| Puppeteer hydration | `node diag-hydration-v2.mjs` | 4/4 scenarios, 0 pageError, 0 hydration warning, `<html data-theme>` pré-rendu | `artifacts/diag-hydration-post-fix.json` |
| DECOR regression | `node capture-deco.mjs` | 6/6 incluant slot concurrency front=32/back=128 | `artifacts/capture-deco-post-fix.json` |

### Incertitude résiduelle

1. **Perte du static prerender** (confirmée, documentée, acceptée) : `/`, `/_not-found`, `/tools/nichoir` passent tous de ○ Static à ƒ Dynamic. Coût : résolution cookie côté serveur à chaque requête (<1 ms). Pour un calculateur personnel, coût négligeable. Si l'app devient content-site CDN-critical, revisiter.

2. **prefers-color-scheme ignoré en SSR** : le serveur ne peut pas lire le media query du client. Premier visiteur sans cookie voit 'light' par défaut, même s'il est en dark mode OS-level. Il doit toggle manuellement pour poser le cookie. Accepté (comportement next-themes standard).

3. **Migration localStorage → cookie perdue** : les users existants avec localStorage=dark mais pas de cookie verront light au premier reload post-déploiement, jusqu'au prochain toggle. Accepté, non-bloquant.

4. **Puppeteer `setCookie` non testé** : la vérif matérielle a utilisé curl (plus simple, plus direct). Puppeteer `page.setCookie()` est un path non-exercé mais non-requis par l'acceptance.

### Critères d'acceptance — status

- [x] `apps/demo/app/layout.tsx` async RSC + cookies + `<html data-theme={...}>` sans suppress ni script inline
- [x] Preuve matérielle par curl (4 scenarios, archivés)
- [x] `packages/nichoir-ui/src/theme-boot.ts` supprimé
- [x] `ThemeToggle.tsx` écrit cookie, retire localStorage
- [x] `packages/nichoir-ui/src/index.ts` ne ré-exporte plus THEME_BOOT_SCRIPT/THEME_STORAGE_KEY
- [x] `packages/nichoir-ui/package.json` : entrée `./theme-boot` retirée
- [x] `theme-resolver.test.ts` créé (5 tests)
- [x] `lang-theme.test.tsx` : tests cookie ajoutés/remplacés
- [x] `root-layout.test.tsx` supprimé (incompat. avec async RSC + next/headers mock)
- [x] diag-hydration-v2.mjs : `html.outer` contient `data-theme` en HTML initial (pré-JS)
- [x] `pnpm -r typecheck && pnpm -r test && pnpm -r lint` verts (4/4)
- [x] `pnpm -C apps/demo build` vert, `/tools/nichoir` noté ƒ Dynamic
- [x] `capture-deco.mjs` 6/6 vert
- [x] HANDOVER.md mis à jour (2 tables)
- [x] RESULT.md écrit avec evidence document (ce fichier)
- [x] attempts.jsonl + metrics.json à jour

---

## Artifacts promus

| Path | Description |
|---|---|
| `artifacts/build-output.txt` | Output complet de `pnpm -C apps/demo build` (montre ƒ Dynamic) |
| `artifacts/curl-evidence.txt` | 4 scenarios curl + grep script anti-FOUC |
| `artifacts/diag-hydration-post-fix.json` | Puppeteer diag, 4 scenarios, 0 warnings |
| `artifacts/capture-deco-post-fix.json` | DECOR 6/6 verts, no regression |

## Next steps

Aucun requis pour B2. Dettes P3 restantes :
- PNG plan raster (reporté volontairement, pas essentiel)

Pour la vision SaaS : câblage des 4 ports adapters restants (`AuthContext`, `CreditGate`, `ProjectStore`, `Telemetry`) dans la UI pour permettre l'intégration host. Scope estimé 3-5 jours. Pas entamé.
