import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

import { DecoClipSection } from '../src/components/tabs/DecoClipSection.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

beforeEach(() => {
  cleanup();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('DecoClipSection', () => {
  it('rend section label + checkbox + hint fr', () => {
    const { getByText, getByRole } = render(<DecoClipSection />);
    expect(getByText('▸ CONFINEMENT')).toBeDefined();
    expect(getByText('Clipper par la forme du panneau')).toBeDefined();
    expect(getByRole('checkbox')).toBeDefined();
    expect(getByText(/N'affecte PAS l'export STL/)).toBeDefined();
  });

  it('checkbox reflète slot.front.clipToPanel (false par défaut)', () => {
    const { getByRole } = render(<DecoClipSection />);
    const cb = getByRole('checkbox') as HTMLInputElement;
    expect(cb.checked).toBe(false);
  });

  it('toggle checkbox → slot.clipToPanel muté', () => {
    const { getByRole } = render(<DecoClipSection />);
    act(() => { fireEvent.click(getByRole('checkbox')); });
    expect(useNichoirStore.getState().decos.front.clipToPanel).toBe(true);
  });

  it('isolation : toggle sur front ne touche pas back', () => {
    const { getByRole } = render(<DecoClipSection />);
    act(() => { fireEvent.click(getByRole('checkbox')); });
    expect(useNichoirStore.getState().decos.front.clipToPanel).toBe(true);
    expect(useNichoirStore.getState().decos.back.clipToPanel).toBe(false);
  });

  it('i18n en : labels traduits', () => {
    act(() => { useNichoirStore.getState().setLang('en'); });
    const { getByText } = render(<DecoClipSection />);
    expect(getByText('▸ CLIPPING')).toBeDefined();
    expect(getByText('Clip to panel shape')).toBeDefined();
    expect(getByText(/Does NOT affect STL/)).toBeDefined();
  });
});
