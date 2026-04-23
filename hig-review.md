# HIG Review — Plan de reprise

**Date audit** : 2026-04-19
**Cible** : http://localhost:3001/tools/nichoir (apps/demo + packages/nichoir-ui)
**Statut** : audit terminé, corrections non commencées.

---

## Contexte de reprise

Audit conduit sur le code source uniquement (HTML SSR + CSS Modules + composants React). **Pas encore validé en navigateur** (Lighthouse / axe DevTools). À faire avant de déclarer victoire.

Mémoire projet à garder en tête :
- `apps/demo` consomme `nichoir-ui/dist` → rebuild du package avant toute validation navigateur.
- Lecture complète des fichiers obligatoire (pas d'assumption sur partial reads).

---

## Ordre d'attaque recommandé (du plus impactant au moins)

### 1. 🔴 Contrastes WCAG AA — `packages/nichoir-ui/src/styles/theme.css`

**Fichier unique, 3 tokens à modifier, impact massif.**

Tokens actuels qui FAIL AA (ratio calculé) :
- `--n-text-subtle: #3a3d45` sur dark `#0f1117` → **1.71:1** (critique)
- `--n-text-muted: #5a5f6a` sur dark `#0f1117` → **3.16:1**
- `--n-text-subtle: #8a8f9a` sur light `#f5f3ef` → **2.92:1**

Propositions à valider via https://webaim.org/resources/contrastchecker/ :
```css
[data-theme='light'] {
  --n-text-subtle: #6a6f7a;  /* ~5:1 sur #f5f3ef */
}
[data-theme='dark'] {
  --n-text-muted: #a0a5ae;   /* ~6:1 sur #0f1117 */
  --n-text-subtle: #8a8f9a;  /* ~5.6:1 sur #0f1117 */
}
```

**Vérification** : rebuild `nichoir-ui`, reload `/tools/nichoir`, tester les 2 thèmes, passer axe DevTools.

---

### 2. 🟠 Touch targets 44×44 px (HIG Apple / WCAG 2.5.5)

Fichiers :
- `packages/nichoir-ui/src/components/primitives/Tabs.module.css` — `.tab { padding: 6px 8px }` trop petit
- `packages/nichoir-ui/src/components/primitives/ThemeToggle.module.css` — `.btn { padding: 4px 10px }`
- `packages/nichoir-ui/src/components/primitives/ToggleBar.module.css` — à vérifier
- `packages/nichoir-ui/src/components/primitives/LangSwitcher.module.css` — à vérifier

Patch type :
```css
.tab, .btn {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

**Attention** : la sidebar fait 340 px. Un tab à 44 px × 6 tabs = 264 px + gaps. Vérifier que ça rentre ou envisager wrap / scroll. Si ça casse le layout, discuter avant de forcer 44.

---

### 3. 🟠 Nettoyage caractères décoratifs dans aria-label et contenu

Fichier principal : `packages/nichoir-ui/src/i18n/messages.ts` (à lire complètement d'abord, ~260 lignes d'après subagent).

Pattern à fuir :
- `'app.title': '⌂ NICHOIR'` → lecteur d'écran annonce "HOUSE"
- `'dim.body': '▸ CORPS (BOÎTE)'` → "BLACK RIGHT-POINTING TRIANGLE"
- `'export.stl.house': '⬇ Maison complète'` → "DOWNWARDS ARROW"

Correction : texte propre dans i18n + symbole décoratif via CSS `::before` avec `aria-hidden` implicite (les pseudo-elements ne sont pas annoncés par défaut dans la plupart des SR, mais confirmer).

**Double check** : vérifier aussi `Sidebar.tsx` et `NichoirApp.tsx` pour des aria-label hardcodés qui dupliquent ce contenu.

---

### 4. 🟠 `ToggleBar.tsx` — `aria-disabled` sans `disabled` natif

Fichier : `packages/nichoir-ui/src/components/primitives/ToggleBar.tsx`

Ajouter l'attribut natif `disabled` sur `<button>` en plus de `aria-disabled`. Sinon le bouton reste focusable au clavier mais inactif → UX buggy.

---

### 5. 🟡 Reste (priorité basse, faire si temps)

- **`prefers-reduced-motion`** — wrapper toutes les `transition:` dans les `.module.css`. ~6 fichiers.
- **`aria-live="polite"` sur tabpanel** — `Sidebar.tsx` ligne ~52.
- **Responsive tablette** — ajouter breakpoint 768–1024 px dans `NichoirApp.module.css`.
- **Tab labels non-abrégés** — `messages.ts` : remplacer `'DIM.'` par `'Dimensions'` + `text-transform: uppercase` en CSS.
- **Focus-ring sur range slider** — `Slider.module.css` : `box-shadow` en plus de `outline`.
- **Metadata OG/SEO** — `apps/demo/app/tools/nichoir/page.tsx`.

---

## Validation finale (AVANT de déclarer fini)

1. `pnpm build` sur `packages/nichoir-ui` (rebuild dist consommé par demo).
2. Démarrer `apps/demo` sur :3001.
3. Lancer axe DevTools sur `/tools/nichoir` en light ET dark mode.
4. Lancer Lighthouse a11y → viser score ≥95.
5. Test clavier manuel : Tab complet du haut au bas, vérifier focus visible partout.
6. Tester avec NVDA ou VoiceOver au moins les changements de tab et le theme toggle.

---

## Claims non vérifiés (à valider demain)

Ces points viennent du subagent mais je ne les ai pas lus moi-même :

- `ToggleBar.tsx` ligne ~46 — confirmer `aria-disabled` sans `disabled`
- `Sidebar.tsx` ligne ~52 — confirmer structure tabpanel
- `messages.ts` — exhaustivité des symboles spéciaux
- `Slider.tsx` lignes 115-145 — structure double input
- Contenu exact de `ExportStlSection.tsx:118` (`role="alert"` déjà présent d'après subagent)

→ Relire ces fichiers en entier avant de patcher.

---

## Fichier de suivi

Si corrections non triviales : créer `runs/2026-04-20-hig-fixes/` avec TASK.md + PLAN.md + attempts.jsonl comme d'habitude.

Bonne nuit 🌙
