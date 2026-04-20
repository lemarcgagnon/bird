import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';

// Pas besoin de mocker Viewport pour DimTab seul (on rend DimTab directement).
// Mais dans Sidebar on pourrait rencontrer Viewport. Ici on teste DimTab isolé.

import { DimTab } from '../src/components/tabs/DimTab.js';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

beforeEach(() => {
  cleanup();
  act(() => { useNichoirStore.getState().replaceState(createInitialState()); });
});

describe('DimTab', () => {
  it('rend toutes les sections de corps (W, H, D, taper, floor, slope, overhang, ridge, T)', () => {
    const { getAllByRole, getByText } = render(<DimTab />);
    // Labels i18n fr par défaut
    expect(getByText('▸ CORPS (BOÎTE)')).toBeDefined();
    expect(getByText('▸ ASSEMBLAGE PLANCHER')).toBeDefined();
    expect(getByText('▸ TOITURE')).toBeDefined();
    expect(getByText('▸ JONCTION CRÊTE DU TOIT')).toBeDefined();
    expect(getByText('▸ MATÉRIAU')).toBeDefined();
    expect(getByText('▸ PORTE D\'ENTRÉE')).toBeDefined();

    // 7 sliders dans la section corps : W, H, D, taperX, slope, overhang, T
    const sliders = getAllByRole('slider');
    expect(sliders.length).toBeGreaterThanOrEqual(7);
  });

  it('slider W → setParam muté', () => {
    const { getAllByRole } = render(<DimTab />);
    const sliders = getAllByRole('slider');
    const wRange = sliders[0] as HTMLInputElement; // W = premier slider
    act(() => { fireEvent.change(wRange, { target: { value: '200' } }); });
    expect(useNichoirStore.getState().params.W).toBe(200);
  });

  it('ToggleBar floor → setParam', () => {
    const { getAllByRole } = render(<DimTab />);
    // Trouver les boutons radio de floor (premier radiogroup)
    const radiogroups = getAllByRole('radiogroup');
    const floorBtns = radiogroups[0]!.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    // Cliquer "Posé" (2e option)
    act(() => { fireEvent.click(floorBtns[1]!); });
    expect(useNichoirStore.getState().params.floor).toBe('pose');
  });

  it('ToggleBar ridge → setParam (miter)', () => {
    const { getAllByRole } = render(<DimTab />);
    const radiogroups = getAllByRole('radiogroup');
    // radiogroup[0] = floor, radiogroup[1] = ridge, radiogroup[2] = door
    const ridgeBtns = radiogroups[1]!.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    act(() => { fireEvent.click(ridgeBtns[2]!); }); // miter
    expect(useNichoirStore.getState().params.ridge).toBe('miter');
  });

  it('door=none par défaut : pas de sliders door visibles', () => {
    const { queryByText } = render(<DimTab />);
    // Pas de 'Largeur porte' ni 'Hauteur porte' — les contrôles sont unmount
    expect(queryByText('Largeur porte')).toBeNull();
    expect(queryByText('Hauteur porte')).toBeNull();
  });

  it('door=round → sliders door apparaissent (unmount/mount dynamique)', () => {
    const { getAllByRole, getByText, rerender } = render(<DimTab />);
    // Toggle door=round
    act(() => { useNichoirStore.getState().setParam('door', 'round'); });
    rerender(<DimTab />);
    // Les labels apparaissent
    expect(getByText('Largeur porte')).toBeDefined();
    expect(getByText('Hauteur porte')).toBeDefined();
    expect(getByText('Créer le panneau de porte')).toBeDefined();
    // Vérifier qu'il y a plus de sliders maintenant
    const sliders = getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(7); // base + door sliders
  });

  it('door=pentagon → checkbox "suivre évasement" visible', () => {
    const { getByText, rerender, queryByText } = render(<DimTab />);
    act(() => { useNichoirStore.getState().setParam('door', 'round'); });
    rerender(<DimTab />);
    expect(queryByText(/suivent l'évasement/)).toBeNull();
    act(() => { useNichoirStore.getState().setParam('door', 'pentagon'); });
    rerender(<DimTab />);
    expect(getByText(/suivent l'évasement/)).toBeDefined();
  });

  it('perch uniquement visible si door !== none', () => {
    const { queryByText, rerender } = render(<DimTab />);
    // door=none par défaut : perch invisible
    expect(queryByText('Ajouter un perchoir')).toBeNull();
    // Activer door → perch devient visible
    act(() => { useNichoirStore.getState().setParam('door', 'round'); });
    rerender(<DimTab />);
    expect(queryByText('Ajouter un perchoir')).not.toBeNull();
  });

  it('labels en anglais après setLang("en")', () => {
    const { getByText, rerender } = render(<DimTab />);
    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<DimTab />);
    expect(getByText('▸ BODY (BOX)')).toBeDefined();
    expect(getByText('▸ ROOF')).toBeDefined();
    expect(getByText('▸ ENTRY DOOR')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// P3 Feature doorFace : ToggleBar Façade dans DimDoorSection
// ---------------------------------------------------------------------------

describe('DimDoorSection — doorFace ToggleBar (P3)', () => {
  it('door="none" (default) : ToggleBar face invisible (unmount pattern)', () => {
    const { queryByText } = render(<DimTab />);
    expect(queryByText('Façade de la porte')).toBeNull();
    expect(queryByText('Devant')).toBeNull();
    expect(queryByText('Gauche')).toBeNull();
    expect(queryByText('Droite')).toBeNull();
  });

  it('door="round" : ToggleBar face visible avec 3 options traduites', () => {
    const { queryByText, rerender } = render(<DimTab />);
    act(() => { useNichoirStore.getState().setParam('door', 'round'); });
    rerender(<DimTab />);
    expect(queryByText('Façade de la porte')).not.toBeNull();
    expect(queryByText('Devant')).not.toBeNull();
    expect(queryByText('Gauche')).not.toBeNull();
    expect(queryByText('Droite')).not.toBeNull();
  });

  it('click sur "Gauche" → store.params.doorFace = "left"', () => {
    const { getByText, rerender } = render(<DimTab />);
    act(() => { useNichoirStore.getState().setParam('door', 'round'); });
    rerender(<DimTab />);
    expect(useNichoirStore.getState().params.doorFace).toBe('front'); // default
    const leftBtn = getByText('Gauche').closest('button');
    expect(leftBtn).not.toBeNull();
    act(() => { fireEvent.click(leftBtn!); });
    expect(useNichoirStore.getState().params.doorFace).toBe('left');
  });

  it('click sur "Droite" → store.params.doorFace = "right"', () => {
    const { getByText, rerender } = render(<DimTab />);
    act(() => { useNichoirStore.getState().setParam('door', 'round'); });
    rerender(<DimTab />);
    const rightBtn = getByText('Droite').closest('button');
    act(() => { fireEvent.click(rightBtn!); });
    expect(useNichoirStore.getState().params.doorFace).toBe('right');
  });

  it('labels en anglais : "Door face / Front / Left / Right"', () => {
    const { getByText, rerender } = render(<DimTab />);
    act(() => { useNichoirStore.getState().setParam('door', 'round'); });
    act(() => { useNichoirStore.getState().setLang('en'); });
    rerender(<DimTab />);
    expect(getByText('Door face')).toBeDefined();
    expect(getByText('Front')).toBeDefined();
    expect(getByText('Left')).toBeDefined();
    expect(getByText('Right')).toBeDefined();
  });
});
