# TASK — B2 hydration mismatch `data-theme` : vraie solution par cookie SSR

## Résumé

Éliminer le mismatch serveur/client sur `html[data-theme]` à sa racine, au lieu de le masquer via `suppressHydrationWarning` + script anti-FOUC inline. Le serveur devient la source d'autorité du thème via un cookie `nichoir-theme`, et rend directement `<html data-theme={theme}>`. Après le fix : aucun script avant paint, aucun warning supprimé, aucun FOUC possible.

## Contexte

État avant fix (lecture directe file:line) :

- `apps/demo/app/layout.tsx:15` : `<html lang="fr" suppressHydrationWarning>` — **masquage** du warning
- `apps/demo/app/layout.tsx:24` : `<script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />` — script client pré-paint qui mute `dataset.theme`
- `packages/nichoir-ui/src/theme-boot.ts:13` : lit localStorage puis `prefers-color-scheme`, mute `document.documentElement.dataset.theme`
- `packages/nichoir-ui/src/components/primitives/ThemeToggle.tsx:29-35` : écrit `dataset.theme` + `localStorage[THEME_STORAGE_KEY]` au click
- `packages/nichoir-ui/tests/root-layout.test.tsx:15` : locke `suppressHydrationWarning: true` — test du masquage actuel

Matériellement observé (`/tmp/nichoir-screenshots/diag-hydration-v2.mjs`, 4 scenarios) : le warning n'apparaît pas actuellement parce que `suppressHydrationWarning` le supprime. Le mismatch **existe toujours** — React voit que SSR HTML = `<html lang="fr">` (sans `data-theme`) et client DOM = `<html lang="fr" data-theme="light|dark">`. La suppression fait qu'on ne le voit pas.

## Intent lock

La vraie solution = le serveur rend déjà le bon `data-theme` en lisant un cookie. Résultat :
- SSR HTML = `<html lang="fr" data-theme="dark">` (valeur réelle)
- Client DOM = `<html lang="fr" data-theme="dark">` (identique)
- Aucun mismatch, aucun warning à supprimer, aucun script pré-paint à injecter.

## Contraintes

- **Next 15 App Router** : `cookies()` est async, fait dépendre la page de la requête. `/tools/nichoir` passe de **Static prerendered (○)** à **Dynamic (ƒ)** dans le build output. Trade-off explicitement accepté (coût par-requête négligeable pour un calculateur).
- **Zéro dépendance nouvelle** : pas d'ajout de lib (pas de `next-themes`, pas de cookie parser externe).
- **Pas de régression DÉCOR** : passe navigateur `capture-deco.mjs` doit rester 6/6 verte.
- **Pas de régression test suite** : 424 tests doivent rester verts (le test `root-layout.test.tsx` est retouché, pas cassé).
- **Cookie name** : `nichoir-theme`, aligné sur `THEME_STORAGE_KEY` actuel pour continuité sémantique.
- **Fallback 'light'** : cookie absent OU valeur invalide → SSR rend `data-theme="light"`. Le user toggle une fois et le cookie est écrit.
- **Persistance** : 1 an (`max-age=31536000`), `SameSite=Lax` (défaut raisonnable, pas besoin de Strict/None).

## Critères d'acceptance

- [ ] `apps/demo/app/layout.tsx` lit le cookie server-side via `cookies()` et rend `<html lang="fr" data-theme={theme}>` **sans** `suppressHydrationWarning` et **sans** script inline anti-FOUC.
- [ ] Preuve matérielle par curl :
  `curl -H 'Cookie: nichoir-theme=dark' http://localhost:3001/tools/nichoir | grep 'data-theme'` → retourne `<html ... data-theme="dark">` (le serveur lui-même rend le bon attribut, zéro JS client requis).
  `curl http://localhost:3001/tools/nichoir | grep 'data-theme'` → retourne `<html ... data-theme="light">` (fallback).
- [ ] `packages/nichoir-ui/src/theme-boot.ts` **supprimé** (plus de script inline). La constante du nom de cookie est inline dans ThemeToggle.
- [ ] `packages/nichoir-ui/src/components/primitives/ThemeToggle.tsx` écrit le cookie `nichoir-theme` via `document.cookie` en plus de muter `dataset.theme`. localStorage retiré (cookie est la source d'autorité).
- [ ] `packages/nichoir-ui/src/index.ts` ne ré-exporte plus `THEME_BOOT_SCRIPT` ni `THEME_STORAGE_KEY`.
- [ ] `packages/nichoir-ui/tests/root-layout.test.tsx` réécrit avec 4 tests : cookie=dark → data-theme=dark, cookie=light → light, cookie absent → light, cookie invalide → light. Plus un test négatif : `suppressHydrationWarning` absent.
- [ ] `packages/nichoir-ui/tests/lang-theme.test.tsx` : test ajouté qui vérifie que `document.cookie` contient `nichoir-theme=dark` après click ThemeToggle.
- [ ] `diag-hydration-v2.mjs` rerun contre le nouveau build → `html.outer` contient déjà `data-theme` avant l'exécution de tout script React.
- [ ] `pnpm -r typecheck && pnpm -r test && pnpm -r lint` verts (4/4).
- [ ] `pnpm -C apps/demo build` vert. Output du build montre explicitement `/tools/nichoir` marqué `ƒ (Dynamic)` au lieu de `○ (Static)` — dette acceptée, à documenter dans HANDOVER.
- [ ] `capture-deco.mjs` 6/6 vert (aucune régression DÉCOR).
- [ ] HANDOVER.md : B2 déplacé de la dette ouverte à la table des dettes résolues, avec citation file:line de la résolution + mention de la perte du prerender static.
- [ ] `runs/2026-04-19-B2-cookie-theme-ssr/RESULT.md` écrit avec evidence document.
- [ ] `runs/2026-04-19-B2-cookie-theme-ssr/state/attempts.jsonl` + `metrics.json` à jour.

## Périmètre

### Inclus
- Cookie-based SSR theme resolution
- Suppression du script inline et de `suppressHydrationWarning`
- Tests matériels (attribut rendu par SSR, pas par client)

### Exclus
- Migration localStorage → cookie (les utilisateurs existants verront light jusqu'au 1er toggle — accepté)
- Détection server-side de `prefers-color-scheme` (techniquement impossible sans cookie prealable — accepté)
- Passage à `next-themes` ou lib tierce
- Animations de transition entre light/dark

## Failure modes à surveiller

- **regression_static_prerender** : `/tools/nichoir` perd son statut static. Accepté. Doit être visible dans le build output.
- **test_async_root_layout** : `RootLayout` devient async ; le test actuel `tree = RootLayout(...)` reçoit une Promise. Doit être migré en `await RootLayout(...)`.
- **mock_next_headers** : le test doit mocker `next/headers` ; aucune fixture existante dans le repo. Premier mock de next/headers — pattern à établir proprement.
- **cookie_storage_regression** : si l'utilisateur a bloqué les cookies, son toggle devient non-persistant. document.cookie ne throw pas en général, mais l'écriture peut silencieusement échouer. Accepté : même limitation que localStorage actuellement.
