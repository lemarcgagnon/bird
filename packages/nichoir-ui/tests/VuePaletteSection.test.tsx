import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { VuePaletteSection } from '../src/components/tabs/VuePaletteSection.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

beforeEach(() => {
  cleanup();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('VuePaletteSection', () => {
  it('renders 4 palette options in FR with correct labels', () => {
    const { getByText } = render(<VuePaletteSection />);
    expect(getByText('▸ PALETTE')).toBeDefined();
    expect(getByText('Bois naturel')).toBeDefined();
    expect(getByText('Bois contrasté')).toBeDefined();
    expect(getByText('Couleurs distinctes')).toBeDefined();
    expect(getByText('Monochrome')).toBeDefined();
  });

  it('wood palette selected by default (aria-checked=true on first button)', () => {
    const { getAllByRole } = render(<VuePaletteSection />);
    const radiogroup = getAllByRole('radiogroup')[0]!;
    const buttons = radiogroup.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    expect(buttons.length).toBe(4);
    expect(buttons[0]!.getAttribute('aria-checked')).toBe('true'); // wood
    expect(buttons[1]!.getAttribute('aria-checked')).toBe('false');
    expect(buttons[2]!.getAttribute('aria-checked')).toBe('false');
    expect(buttons[3]!.getAttribute('aria-checked')).toBe('false');
  });

  it('click on "Couleurs distinctes" → store.params.palette === "colorful"', () => {
    const { getByText } = render(<VuePaletteSection />);
    act(() => { fireEvent.click(getByText('Couleurs distinctes')); });
    expect(useNichoirStore.getState().params.palette).toBe('colorful');
  });

  it('click on "Monochrome" → store.params.palette === "mono"', () => {
    const { getByText } = render(<VuePaletteSection />);
    act(() => { fireEvent.click(getByText('Monochrome')); });
    expect(useNichoirStore.getState().params.palette).toBe('mono');
  });

  it('click on "Bois contrasté" → store.params.palette === "wood-contrast"', () => {
    const { getByText } = render(<VuePaletteSection />);
    act(() => { fireEvent.click(getByText('Bois contrasté')); });
    expect(useNichoirStore.getState().params.palette).toBe('wood-contrast');
  });

  it('renders EN labels after setLang("en")', () => {
    const { rerender, getByText } = render(<VuePaletteSection />);
    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<VuePaletteSection />);
    expect(getByText('Natural wood')).toBeDefined();
    expect(getByText('Wood contrast')).toBeDefined();
    expect(getByText('Colorful')).toBeDefined();
    expect(getByText('Monochrome')).toBeDefined();
  });
});
