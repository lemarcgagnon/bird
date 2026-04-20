import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { LangSwitcher } from '../src/components/primitives/LangSwitcher.js';
import { ThemeToggle } from '../src/components/primitives/ThemeToggle.js';
import { useNichoirStore } from '../src/store.js';

// Cookie name partagé avec apps/demo/app/theme-resolver.ts.
// Si on renomme : greper 'nichoir-theme' pour localiser les sites.
const THEME_COOKIE_NAME = 'nichoir-theme';

function clearThemeCookie(): void {
  document.cookie = `${THEME_COOKIE_NAME}=; path=/; max-age=0`;
}

beforeEach(() => {
  cleanup();
  // Reset store lang entre tests
  act(() => { useNichoirStore.getState().setLang('fr'); });
  // Reset DOM theme et cookie
  document.documentElement.dataset.theme = 'light';
  clearThemeCookie();
});

// ---------------------------------------------------------------------------
// LangSwitcher
// ---------------------------------------------------------------------------

describe('LangSwitcher', () => {
  it('rend 2 boutons FR / EN avec aria-pressed sur le courant', () => {
    const { getAllByRole } = render(<LangSwitcher />);
    const btns = getAllByRole('button');
    expect(btns).toHaveLength(2);
    expect(btns[0]!.textContent).toBe('FR');
    expect(btns[1]!.textContent).toBe('EN');
    expect(btns[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(btns[1]!.getAttribute('aria-pressed')).toBe('false');
  });

  it('click sur EN → store.lang = "en" + aria-pressed swap', () => {
    const { getAllByRole, rerender } = render(<LangSwitcher />);
    act(() => { fireEvent.click(getAllByRole('button')[1]!); });
    expect(useNichoirStore.getState().lang).toBe('en');
    rerender(<LangSwitcher />);
    const btns = getAllByRole('button');
    expect(btns[0]!.getAttribute('aria-pressed')).toBe('false');
    expect(btns[1]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('group aria-label est lu depuis i18n (fr par défaut)', () => {
    const { getByRole } = render(<LangSwitcher />);
    expect(getByRole('group').getAttribute('aria-label')).toBe('Langue');
  });
});

// ---------------------------------------------------------------------------
// ThemeToggle
// ---------------------------------------------------------------------------

describe('ThemeToggle', () => {
  it('rend un bouton avec aria-label lu depuis i18n (theme courant = light → "Passer en mode sombre")', () => {
    document.documentElement.dataset.theme = 'light';
    const { getByRole } = render(<ThemeToggle />);
    const btn = getByRole('button');
    expect(btn.getAttribute('aria-label')).toBe('Passer en mode sombre');
  });

  it('click → dataset.theme toggle + cookie set (P3 fix B2 : cookie = source d\'autorité SSR)', () => {
    document.documentElement.dataset.theme = 'light';
    const { getByRole } = render(<ThemeToggle />);
    act(() => { fireEvent.click(getByRole('button')); });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=dark`);
  });

  it('click second → retour à light + cookie remis à light', () => {
    document.documentElement.dataset.theme = 'dark';
    const { getByRole } = render(<ThemeToggle />);
    act(() => { fireEvent.click(getByRole('button')); });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=light`);
  });

  it('cookie assignment bloqué (document.cookie setter throw) : pas de throw, dataset.theme reste muté', () => {
    const originalDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(Document.prototype, 'cookie', {
      configurable: true,
      get() { return ''; },
      set() { throw new Error('blocked by browser'); },
    });
    try {
      document.documentElement.dataset.theme = 'light';
      const { getByRole } = render(<ThemeToggle />);
      act(() => { expect(() => fireEvent.click(getByRole('button'))).not.toThrow(); });
      expect(document.documentElement.dataset.theme).toBe('dark');
    } finally {
      if (originalDesc) Object.defineProperty(Document.prototype, 'cookie', originalDesc);
    }
  });

  it('MutationObserver : mute dataset.theme depuis l\'extérieur → re-render', () => {
    document.documentElement.dataset.theme = 'light';
    const { getByRole, rerender } = render(<ThemeToggle />);
    const btn1 = getByRole('button');
    expect(btn1.getAttribute('aria-label')).toBe('Passer en mode sombre');

    // Simule une autre source qui change le theme (ex: script externe)
    act(() => { document.documentElement.dataset.theme = 'dark'; });
    rerender(<ThemeToggle />);
    const btn2 = getByRole('button');
    expect(btn2.getAttribute('aria-label')).toBe('Passer en mode clair');
  });
});
