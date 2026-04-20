// apps/demo/app/theme-resolver.ts
//
// Résolution server-side du thème à partir du cookie `nichoir-theme`.
// Fonction pure (aucune dep Next / DOM / React) → testable en isolation
// sans mocker next/headers.
//
// Contrat cookie :
//   - Nom  : 'nichoir-theme'
//   - Valeurs acceptées : 'dark' | 'light'
//   - Toute autre valeur (undefined, malformée, injection) → fallback 'light'.
//
// Le nom est dupliqué en tant que string literal dans
// `packages/nichoir-ui/src/components/primitives/ThemeToggle.tsx` (écriture
// client-side). Les 2 sites doivent rester synchronisés — si on change le
// nom, `grep -r "nichoir-theme"` localise les 2 occurrences.

export type Theme = 'light' | 'dark';

export const THEME_COOKIE_NAME = 'nichoir-theme';

export function resolveTheme(cookieValue: string | undefined): Theme {
  return cookieValue === 'dark' || cookieValue === 'light'
    ? cookieValue
    : 'light';
}
