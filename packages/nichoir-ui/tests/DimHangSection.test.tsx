import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

import { DimTab } from '../src/components/tabs/DimTab.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

beforeEach(() => {
  cleanup();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('DimHangSection', () => {
  it('rend le label de toggle en français par défaut', () => {
    const { getByText } = render(<DimTab />);
    expect(getByText('Ajouter trous de suspension (débordement toit)')).toBeDefined();
  });

  it('hang=false (default) : aucun slider de suspension visible (unmount pattern)', () => {
    const { queryByText } = render(<DimTab />);
    expect(queryByText('Distance depuis bord')).toBeNull();
    expect(queryByText('Distance depuis crête')).toBeNull();
    expect(queryByText('Diamètre trou')).toBeNull();
  });

  it('hang=true : les 3 sliders apparaissent', () => {
    const { getByText, rerender } = render(<DimTab />);
    act(() => { useNichoirStore.getState().setParam('hang', true); });
    rerender(<DimTab />);
    expect(getByText('Distance depuis bord')).toBeDefined();
    expect(getByText('Distance depuis crête')).toBeDefined();
    expect(getByText('Diamètre trou')).toBeDefined();
  });

  it('toggle hang → store.params.hang change de false à true', () => {
    const { getByText } = render(<DimTab />);
    expect(useNichoirStore.getState().params.hang).toBe(false);
    const checkbox = getByText('Ajouter trous de suspension (débordement toit)')
      .closest('label')
      ?.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    act(() => { fireEvent.click(checkbox!); });
    expect(useNichoirStore.getState().params.hang).toBe(true);
  });

  it('hang=true : slider hangDiam change mutates store.params.hangDiam', () => {
    const { getAllByRole, rerender } = render(<DimTab />);
    act(() => { useNichoirStore.getState().setParam('hang', true); });
    rerender(<DimTab />);
    // On cherche le slider hangDiam — dernier slider ajouté par DimHangSection
    // (hangPosY, hangOffsetX, hangDiam dans cet ordre)
    const sliders = getAllByRole('slider') as HTMLInputElement[];
    const hangSliders = sliders.slice(-3); // les 3 derniers (section hang)
    const hangDiamSlider = hangSliders[2]!;
    act(() => { fireEvent.change(hangDiamSlider, { target: { value: '8' } }); });
    expect(useNichoirStore.getState().params.hangDiam).toBe(8);
  });

  it('hang=true : slider hangPosY change mutates store.params.hangPosY', () => {
    const { getAllByRole, rerender } = render(<DimTab />);
    act(() => { useNichoirStore.getState().setParam('hang', true); });
    rerender(<DimTab />);
    const sliders = getAllByRole('slider') as HTMLInputElement[];
    const hangSliders = sliders.slice(-3);
    const hangPosYSlider = hangSliders[0]!;
    act(() => { fireEvent.change(hangPosYSlider, { target: { value: '30' } }); });
    expect(useNichoirStore.getState().params.hangPosY).toBe(30);
  });

  it('hang=true → hang=false : sliders disparaissent à nouveau (unmount)', () => {
    const { queryByText, rerender } = render(<DimTab />);
    act(() => { useNichoirStore.getState().setParam('hang', true); });
    rerender(<DimTab />);
    expect(queryByText('Diamètre trou')).not.toBeNull();
    act(() => { useNichoirStore.getState().setParam('hang', false); });
    rerender(<DimTab />);
    expect(queryByText('Diamètre trou')).toBeNull();
  });

  it('labels en anglais après setLang("en")', () => {
    const { getByText, rerender } = render(<DimTab />);
    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<DimTab />);
    expect(getByText('Add suspension holes (roof overhang)')).toBeDefined();
  });

  it('hang=true EN : sliders en anglais', () => {
    const { getByText, rerender } = render(<DimTab />);
    act(() => {
      useNichoirStore.getState().setParam('hang', true);
      useNichoirStore.getState().setLang('en');
    });
    rerender(<DimTab />);
    expect(getByText('Distance from edge')).toBeDefined();
    expect(getByText('Distance from ridge')).toBeDefined();
    expect(getByText('Hole diameter')).toBeDefined();
  });
});
