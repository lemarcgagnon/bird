// tests/theme-resolver.test.ts
//
// Tests unit de la fonction pure `resolveTheme` dans
// apps/demo/app/theme-resolver.ts. Pas de mock, pas de DOM, pas de next/headers.
// Valide les 4 branches : dark valid, light valid, undefined fallback,
// invalid fallback (sécurité : aucune injection possible).

import { describe, it, expect } from 'vitest';
import {
  resolveTheme,
  THEME_COOKIE_NAME,
  type Theme,
} from '../../../apps/demo/app/theme-resolver.js';

describe('resolveTheme', () => {
  it("cookie='dark' → 'dark'", () => {
    expect(resolveTheme('dark')).toBe<Theme>('dark');
  });

  it("cookie='light' → 'light'", () => {
    expect(resolveTheme('light')).toBe<Theme>('light');
  });

  it('cookie undefined → fallback light', () => {
    expect(resolveTheme(undefined)).toBe<Theme>('light');
  });

  it('cookie malformé / injection tentative → fallback light (pas de passe-plat)', () => {
    expect(resolveTheme('<script>alert(1)</script>')).toBe<Theme>('light');
    expect(resolveTheme('')).toBe<Theme>('light');
    expect(resolveTheme('DARK')).toBe<Theme>('light'); // case-sensitive
    expect(resolveTheme('random')).toBe<Theme>('light');
  });

  it('THEME_COOKIE_NAME exporté égal à la valeur attendue', () => {
    expect(THEME_COOKIE_NAME).toBe('nichoir-theme');
  });
});
