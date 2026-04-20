# NOTES — session state

## Décisions verrouillées (avant GO user)

- Cookie `nichoir-theme`, valeur `'light'` ou `'dark'`, `max-age=31536000`, `path=/`, `SameSite=Lax`.
- Fallback 'light' pour cookie absent ou invalide.
- Abandon de localStorage pour le thème (cookie devient source d'autorité).
- Abandon du script anti-FOUC (plus nécessaire avec SSR correct).
- Abandon de `suppressHydrationWarning` (plus nécessaire avec SSR correct).
- `/tools/nichoir` passe de Static à Dynamic : trade-off accepté pour cette app (calculateur, pas un content site CDN-critical).

## Assumptions (statut après vérifications spike)

- [x] **Next.js 15 `cookies()` est async** — VÉRIFIÉ via `node_modules/next/dist/server/request/cookies.d.ts:24` : `export declare function cookies(): Promise<ReadonlyRequestCookies>`.
- [x] **Next.js 15 `cookies()` rend la page dynamique** — à vérifier MATÉRIELLEMENT dans le build output après impl (checklist étape 14). Cohérent avec doc Next.
- [x] **vitest mock de `next/headers`** — **CASSÉ** : spike `_spike-next-headers.test.ts` a échoué avec `Failed to resolve import "next/headers"`. Conséquence : plan révisé pour isoler la logique dans un helper pur testable sans importer de code Next.
- [x] **`document.cookie =` en jsdom fonctionne** — VÉRIFIÉ via spike `_spike-jsdom-cookie.test.ts` : write + read round-trip OK, overwrite same-name OK. 2/2 green.
- [ ] **Chrome headless (puppeteer) envoie les cookies** — non-bloquant pour planning. Sera vérifié à l'étape matérielle post-impl.

## Découverte annexe (indirect hit)

- `packages/nichoir-ui/package.json` a été mis à jour aujourd'hui à 20:31 par codex (ou user) avec 2 nouveaux subpath exports : `./app` (pour NichoirApp) et `./theme-boot` (pour isoler le script anti-FOUC). Mon plan tient compte de la suppression de `./theme-boot`.
- Un fichier `packages/nichoir-ui/src/app.ts` ('use client' barrel de NichoirApp) a été créé aujourd'hui. Non affecté par B2 — ignoré.

## Failure modes identifiés

- `mock_next_headers_fails` : le mock ne s'applique pas à l'import de `apps/demo/app/layout.tsx` car il résout hors de vitest scope.
- `cookie_not_read_in_rsc` : oubli de `await` sur `cookies()` → objet Promise retourné au parseur de cookies plutôt que les cookies eux-mêmes.
- `build_output_unchanged` : l'appel à `cookies()` ne suffit pas à basculer la page en dynamic (si Next inline-cache). **À vérifier.**
- `theme_toggle_cookie_not_persistent` : écriture `document.cookie` silencieusement perdue (test 9 doit catcher ça via spy).
- `render_vs_hook_boundary` : layout.tsx est RSC (no 'use client'). Vérifier qu'aucun hook client n'y est introduit.
