import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

import { DecoDimensionsSection } from '../src/components/tabs/DecoDimensionsSection.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

beforeEach(() => {
  cleanup();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('DecoDimensionsSection — rendu', () => {
  it('rend section label + 5 sliders (w, h, posX, posY, rotation)', () => {
    const { getByText, getAllByRole } = render(<DecoDimensionsSection />);
    expect(getByText('▸ DIMENSIONS')).toBeDefined();
    // 5 sliders → 5 <input type="range">
    const sliders = getAllByRole('slider');
    expect(sliders).toHaveLength(5);
    expect(getByText('Largeur')).toBeDefined();
    expect(getByText('Hauteur')).toBeDefined();
    expect(getByText('Position X')).toBeDefined();
    expect(getByText('Position Y')).toBeDefined();
    expect(getByText('Rotation image')).toBeDefined();
  });

  it('defaults state initial : w=60, h=60, posX=50, posY=50, rotation=0', () => {
    const { getAllByRole } = render(<DecoDimensionsSection />);
    const sliders = getAllByRole('slider') as HTMLInputElement[];
    expect(sliders[0]!.value).toBe('60');  // w
    expect(sliders[1]!.value).toBe('60');  // h
    expect(sliders[2]!.value).toBe('50');  // posX
    expect(sliders[3]!.value).toBe('50');  // posY
    expect(sliders[4]!.value).toBe('0');   // rotation
  });
});

describe('DecoDimensionsSection — mutations', () => {
  it('slide w → slot.front.w muté', () => {
    const { getAllByRole } = render(<DecoDimensionsSection />);
    const [w] = getAllByRole('slider') as HTMLInputElement[];
    act(() => { fireEvent.change(w!, { target: { value: '120' } }); });
    expect(useNichoirStore.getState().decos.front.w).toBe(120);
  });

  it('slide h → slot.h muté', () => {
    const { getAllByRole } = render(<DecoDimensionsSection />);
    const h = (getAllByRole('slider') as HTMLInputElement[])[1]!;
    act(() => { fireEvent.change(h, { target: { value: '200' } }); });
    expect(useNichoirStore.getState().decos.front.h).toBe(200);
  });

  it('slide posX → slot.posX muté', () => {
    const { getAllByRole } = render(<DecoDimensionsSection />);
    const posX = (getAllByRole('slider') as HTMLInputElement[])[2]!;
    act(() => { fireEvent.change(posX, { target: { value: '75' } }); });
    expect(useNichoirStore.getState().decos.front.posX).toBe(75);
  });

  it('slide posY → slot.posY muté', () => {
    const { getAllByRole } = render(<DecoDimensionsSection />);
    const posY = (getAllByRole('slider') as HTMLInputElement[])[3]!;
    act(() => { fireEvent.change(posY, { target: { value: '25' } }); });
    expect(useNichoirStore.getState().decos.front.posY).toBe(25);
  });

  it('slide rotation → slot.rotation muté', () => {
    const { getAllByRole } = render(<DecoDimensionsSection />);
    const rot = (getAllByRole('slider') as HTMLInputElement[])[4]!;
    act(() => { fireEvent.change(rot, { target: { value: '90' } }); });
    expect(useNichoirStore.getState().decos.front.rotation).toBe(90);
  });
});

describe('DecoDimensionsSection — isolation par slot', () => {
  it('mutation sur front ne touche pas back', () => {
    const { getAllByRole } = render(<DecoDimensionsSection />);
    const w = (getAllByRole('slider') as HTMLInputElement[])[0]!;
    act(() => { fireEvent.change(w, { target: { value: '200' } }); });
    expect(useNichoirStore.getState().decos.front.w).toBe(200);
    expect(useNichoirStore.getState().decos.back.w).toBe(60);
  });

  it('switch activeDecoKey → mutations appliquées sur le nouveau slot', () => {
    act(() => { useNichoirStore.getState().setActiveDecoKey('roofL'); });
    const { getAllByRole } = render(<DecoDimensionsSection />);
    const w = (getAllByRole('slider') as HTMLInputElement[])[0]!;
    act(() => { fireEvent.change(w, { target: { value: '180' } }); });
    expect(useNichoirStore.getState().decos.roofL.w).toBe(180);
    expect(useNichoirStore.getState().decos.front.w).toBe(60);
  });
});
