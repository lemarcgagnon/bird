# PLAN — B2 cookie-based theme SSR

## 🎯 Intent lock

Remplacer le masquage de mismatch par une résolution server-authoritative. Le cookie `nichoir-theme` est lu en RSC dans `layout.tsx`, le HTML SSR contient déjà le bon `data-theme`. Zéro script pré-paint, zéro `suppressHydrationWarning`.

## ⚠️ RÉVISION après vérification matérielle

Vérif #2 a cassé : `vi.mock('next/headers')` échoue dans `packages/nichoir-ui/tests/` parce que `next` n'est pas une dépendance de nichoir-ui. Vite échoue à résoudre l'import avant même que vi.mock ne puisse intercepter.

**Décision** : isoler la logique de résolution dans un helper pur (testable sans next/headers), et retirer le test root-layout qui est incompatible avec async RSC + cookies().

## 📁 Files affected

### Création
| Fichier | Rôle |
|---|---|
| `apps/demo/app/theme-resolver.ts` | Fonction pure `resolveTheme(cookieValue: string \| undefined): 'light' \| 'dark'`. Toute la logique de validation + fallback. Zéro dep Next. Importable côté tests sans contaminer le module graph. |
| `packages/nichoir-ui/tests/theme-resolver.test.ts` | 4 tests unit : dark/light/absent/invalid → valeur retournée. |

### Modification
| Fichier | Changement | Lignes touchées (estim.) |
|---|---|---|
| `apps/demo/app/layout.tsx` | async RSC, `cookies()` + `resolveTheme()`, rend `<html data-theme={...}>`, retire script + suppressHydrationWarning + import THEME_BOOT_SCRIPT | tout le fichier (~30 l) |
| `packages/nichoir-ui/src/components/primitives/ThemeToggle.tsx` | `setTheme()` écrit `document.cookie` au lieu de localStorage ; retirer import `THEME_STORAGE_KEY` de theme-boot | ~10 l |
| `packages/nichoir-ui/src/index.ts` | Retirer `export { THEME_BOOT_SCRIPT, THEME_STORAGE_KEY } from './theme-boot.js'` | -1 l |
| `packages/nichoir-ui/package.json` | Retirer l'entrée `"./theme-boot"` des `exports` | -4 l |
| `packages/nichoir-ui/tests/lang-theme.test.tsx` | Tests cookie-based (remplace assertions localStorage) ; ajouter test round-trip cookie | ~20 l changées |
| `HANDOVER.md` | B2 clôturé avec citations file:line + mention dette "perte static prerender" | 2-3 l |

### Suppression
| Fichier | Raison |
|---|---|
| `packages/nichoir-ui/src/theme-boot.ts` | Plus de script à injecter. Cookie name `'nichoir-theme'` redevient un simple string inline dans ThemeToggle + theme-resolver. |
| `packages/nichoir-ui/tests/root-layout.test.tsx` | Incompatible architecturalement : testait `suppressHydrationWarning` (retiré) et utilisait un call sync de `RootLayout` (devient async). Remplacé par `theme-resolver.test.ts` (logique) + vérifs matérielles curl (rendering). |

### Création
| Fichier | Rôle |
|---|---|
| `runs/2026-04-19-B2-cookie-theme-ssr/RESULT.md` | Evidence document (rédigé à la fin) |
| `runs/2026-04-19-B2-cookie-theme-ssr/state/attempts.jsonl` | Log chronologique |
| `runs/2026-04-19-B2-cookie-theme-ssr/state/metrics.json` | Métriques de clôture |
| `runs/2026-04-19-B2-cookie-theme-ssr/state/NOTES.md` | Findings |

## ⚠️ Risk areas / side effects

1. **Perte du static prerender de `/tools/nichoir`** (CONFIRMÉ via doc Next 15) : `cookies()` rend la page dynamique. Visible dans output `pnpm -C apps/demo build` : ○ devient ƒ. Accepté comme trade-off du fix architectural.
2. **Test `root-layout.test.tsx` casse sans refactor** : `RootLayout` devient async. Test actuel `tree = RootLayout({children:null})` doit devenir `tree = await RootLayout({children:null})`.
3. **Mock `next/headers` inédit** : vitest.config.ts est minimaliste (jsdom + globals false). Le mock sera en `vi.mock('next/headers', () => ({ cookies: ... }))` au top du fichier de test.
4. **Migration perdue** : les users avec localStorage=dark et pas de cookie voient light au premier load post-fix, jusqu'au prochain toggle. Accepté.
5. **Cookie non-httpOnly (forcément, puisqu'écrit par JS)** : pas un risque de sécurité pour cette clé (pas de données sensibles). `SameSite=Lax` suffit.

## 🧪 Tests de qualité (TDD — à écrire AVANT le code)

### Test 1-4 : theme-resolver.test.ts — valeurs retournées par `resolveTheme`
```ts
// Pure function, no mock, no DOM, no cookies(). Just 4 unit cases :
expect(resolveTheme('dark')).toBe('dark');
expect(resolveTheme('light')).toBe('light');
expect(resolveTheme(undefined)).toBe('light');
expect(resolveTheme('<script>alert(1)</script>')).toBe('light');  // safe fallback, pas d'injection
```

### Test 5 : lang-theme.test.tsx — click ThemeToggle → cookie écrit
```ts
// Arrange : document.cookie cleared ; dataset.theme = 'light'
// Act : render + click button
// Assert : document.cookie contient 'nichoir-theme=dark'
//         dataset.theme === 'dark'
```

### Test 6 : lang-theme.test.tsx — click second → cookie remis à 'light'

### Test 7 : lang-theme.test.tsx — cookie storage bloqué (spy throw sur document.cookie assignment) : click n'explose pas, dataset.theme reste muté

### Test 8 : lang-theme.test.tsx — anciens tests localStorage supprimés (assertions remplacées par cookie)

### Test 9 (MATERIAL, hors vitest) : curl preuve SSR
```bash
# Démarrer prod server sur :3001
curl -s -H 'Cookie: nichoir-theme=dark' http://localhost:3001/tools/nichoir | grep -o '<html[^>]*>'
# Attendu : contient data-theme="dark"

curl -s http://localhost:3001/tools/nichoir | grep -o '<html[^>]*>'
# Attendu : contient data-theme="light"

curl -s http://localhost:3001/tools/nichoir | grep -c 'dangerouslySetInnerHTML'
# Attendu : 0 (plus de script inline)
```

### Test 10 (MATERIAL, puppeteer) : diag-hydration-v2.mjs rerun
- html.outer doit déjà contenir `data-theme` avant exécution React (SSR pur)
- Aucun warning même sans `suppressHydrationWarning` (plus de mismatch possible)

### Test 11 (MATERIAL, regression DÉCOR) : capture-deco.mjs 6/6 vert

### Test 12 (MATERIAL, regression test suite) : pnpm -r test → 424 tests - 1 supprimé + 5 ajoutés = 428 attendus (ou équivalent, on ajuste en fonction du résultat réel)

## ✅ Checklist de réalisation (ordonnée, strictement)

1. [x] **PROP** : plan proposé + révisé après vérif #2 cassée. En attente de GO final.
2. [ ] **READ FINAL** : Re-lire intégralement (pas skim) les 6 fichiers à toucher juste avant édition : `apps/demo/app/layout.tsx`, `packages/nichoir-ui/src/components/primitives/ThemeToggle.tsx`, `packages/nichoir-ui/src/theme-boot.ts`, `packages/nichoir-ui/src/index.ts`, `packages/nichoir-ui/package.json`, `packages/nichoir-ui/tests/lang-theme.test.tsx`, `packages/nichoir-ui/tests/root-layout.test.tsx`.
3. [ ] **CREATE theme-resolver** : écrire `apps/demo/app/theme-resolver.ts` (fonction pure + types).
4. [ ] **TEST RED** : Écrire `packages/nichoir-ui/tests/theme-resolver.test.ts` (4 tests) et modifier `lang-theme.test.tsx` (tests 5-7). Lancer → **ROUGE attendu** sur lang-theme (cookie pas écrit par ThemeToggle actuel). theme-resolver.test passe déjà (logique pure existante).
5. [ ] **IMPL 1** : Modifier `apps/demo/app/layout.tsx` : `async function`, `await cookies()`, `resolveTheme(...)`, rend `<html data-theme={theme}>`, retire script + suppressHydrationWarning + import THEME_BOOT_SCRIPT.
6. [ ] **IMPL 2** : Modifier `ThemeToggle.tsx` : `document.cookie = 'nichoir-theme=X; path=/; max-age=31536000; samesite=lax'`, retirer localStorage, retirer import THEME_STORAGE_KEY.
7. [ ] **IMPL 3** : Supprimer `packages/nichoir-ui/src/theme-boot.ts` via Bash `rm`.
8. [ ] **IMPL 4** : `packages/nichoir-ui/src/index.ts` : retirer la ligne export THEME_BOOT_SCRIPT + THEME_STORAGE_KEY.
9. [ ] **IMPL 5** : `packages/nichoir-ui/package.json` : retirer l'entrée `./theme-boot` des exports.
10. [ ] **DELETE root-layout test** : Supprimer `packages/nichoir-ui/tests/root-layout.test.tsx`.
11. [ ] **TYPECHECK** : `pnpm -r typecheck` — corriger erreurs éventuelles.
12. [ ] **TEST GREEN** : `pnpm -r test` — nouveaux tests verts, anciens regressions = 0.
13. [ ] **LINT** : `pnpm -r lint` vert.
14. [ ] **BUILD** : `pnpm -C apps/demo build` — vérifier explicitement que `/tools/nichoir` est noté `ƒ (Dynamic)` dans l'output. Archiver output dans `artifacts/build-output.txt`.
15. [ ] **KILL DEV/PROD SERVERS + START PROD** : lancer `pnpm -C apps/demo start` sur :3001.
16. [ ] **MATERIAL CURL** : exécuter les 3 curl de Test 9, archiver dans `artifacts/curl-evidence.txt`.
17. [ ] **MATERIAL PUPPETEER** : rerun `/tmp/nichoir-screenshots/diag-hydration-v2.mjs`, archiver dans `artifacts/diag-hydration-post-fix.json`.
18. [ ] **DECO REGRESSION** : rerun `/tmp/nichoir-screenshots/capture-deco.mjs http://localhost:3001/tools/nichoir`, archiver dans `artifacts/capture-deco-post-fix.json`. 6/6 attendu.
19. [ ] **HANDOVER** : mettre à jour les 2 tables (P3 + dette connue) avec B2 résolu + citations file:line + note "dynamic instead of static prerender — accepted trade-off".
20. [ ] **LOG** : appeder entrée dans `runs/2026-04-19-B2-cookie-theme-ssr/state/attempts.jsonl` avec failure_mode réel + causal_hypothesis.
21. [ ] **METRICS** : `runs/.../state/metrics.json` avec test_count_total actualisé + `acceptance_passed: true`.
22. [ ] **RESULT** : rédiger `RESULT.md` avec Evidence Document complet.
23. [ ] **REPORT** : rapport au user concis avec citations file:line + liens vers artefacts.

## 🤖 Plan de délégation

Pas de sous-agents. Scope unique, séquentiel, toutes les éditions sont ciblées et lisibles. L'orchestrateur (moi) fait tout.

## Ready to code : NO

Attendre **GO explicite du user** sur ce PLAN.md. Si GO → démarrage séquentiel strict sur la checklist ci-dessus, zéro improvisation hors-plan.
