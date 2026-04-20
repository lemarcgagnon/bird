import { describe, it, expect, beforeEach } from 'vitest';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

beforeEach(() => {
  useNichoirStore.getState().replaceState(createInitialState());
});

describe('store.setClipAxis', () => {
  it('patch partiel : muter seulement `on` préserve `pos` existant', () => {
    const s0 = useNichoirStore.getState();
    const initialPos = s0.clip.x.pos; // 0.5
    s0.setClipAxis('x', { on: true });
    const s1 = useNichoirStore.getState();
    expect(s1.clip.x.on).toBe(true);
    expect(s1.clip.x.pos).toBe(initialPos); // inchangé
  });

  it('patch partiel : muter seulement `pos` préserve `on` existant', () => {
    const s0 = useNichoirStore.getState();
    s0.setClipAxis('y', { on: true });       // prépare on=true
    s0.setClipAxis('y', { pos: 0.25 });      // patch pos seul
    const s1 = useNichoirStore.getState();
    expect(s1.clip.y.on).toBe(true);         // on préservé
    expect(s1.clip.y.pos).toBeCloseTo(0.25, 5);
  });

  it('axes indépendants : muter `x` ne touche pas `y` ni `z`', () => {
    const s0 = useNichoirStore.getState();
    const yRef = s0.clip.y;
    const zRef = s0.clip.z;
    s0.setClipAxis('x', { on: true, pos: 0.8 });
    const s1 = useNichoirStore.getState();
    expect(s1.clip.x.on).toBe(true);
    expect(s1.clip.x.pos).toBeCloseTo(0.8, 5);
    // Références identiques : aucune mutation sur y et z
    expect(s1.clip.y).toBe(yRef);
    expect(s1.clip.z).toBe(zRef);
  });

  it('patch simultané : `on` et `pos` dans le même call', () => {
    const s = useNichoirStore.getState();
    s.setClipAxis('z', { on: true, pos: 0.1 });
    const s1 = useNichoirStore.getState();
    expect(s1.clip.z.on).toBe(true);
    expect(s1.clip.z.pos).toBeCloseTo(0.1, 5);
  });

  it('patch vide : `setClipAxis(axis, {})` = no-op sémantique (valeurs inchangées)', () => {
    const s0 = useNichoirStore.getState();
    const before = { on: s0.clip.x.on, pos: s0.clip.x.pos };
    s0.setClipAxis('x', {});
    const s1 = useNichoirStore.getState();
    expect(s1.clip.x.on).toBe(before.on);
    expect(s1.clip.x.pos).toBe(before.pos);
  });

  it('ne touche pas aux autres slices (params, camera, decos, lang, activeTab)', () => {
    const s0 = useNichoirStore.getState();
    const paramsRef = s0.params;
    const cameraRef = s0.camera;
    const decosRef = s0.decos;
    const initialLang = s0.lang;
    const initialActiveTab = s0.activeTab;

    s0.setClipAxis('x', { on: true, pos: 0.7 });

    const s1 = useNichoirStore.getState();
    expect(s1.params).toBe(paramsRef);
    expect(s1.camera).toBe(cameraRef);
    expect(s1.decos).toBe(decosRef);
    expect(s1.lang).toBe(initialLang);
    expect(s1.activeTab).toBe(initialActiveTab);
  });

  it('convention de normalisation : `pos` est stocké tel quel (pas de clamp)', () => {
    // Le store ne clamp pas : la responsabilité de garantir pos ∈ [0,1] est
    // au consumer (VueClipSection passe toujours v/100 avec v ∈ [0,100]).
    // Ce test documente explicitement cette frontière.
    const s = useNichoirStore.getState();
    s.setClipAxis('x', { pos: 0.7 });
    expect(useNichoirStore.getState().clip.x.pos).toBeCloseTo(0.7, 5);
    s.setClipAxis('x', { pos: 0 });
    expect(useNichoirStore.getState().clip.x.pos).toBe(0);
    s.setClipAxis('x', { pos: 1 });
    expect(useNichoirStore.getState().clip.x.pos).toBe(1);
  });
});
