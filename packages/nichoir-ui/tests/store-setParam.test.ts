import { describe, it, expect, beforeEach } from 'vitest';
import { useNichoirStore } from '../src/store.js';
import { createInitialState } from '@nichoir/core';

beforeEach(() => {
  useNichoirStore.getState().replaceState(createInitialState());
});

describe('store.setParam', () => {
  it('mute params.<key> sans toucher aux autres params', () => {
    const s0 = useNichoirStore.getState();
    const initialSlope = s0.params.slope;
    const initialFloor = s0.params.floor;
    s0.setParam('W', 220);
    const s1 = useNichoirStore.getState();
    expect(s1.params.W).toBe(220);
    expect(s1.params.slope).toBe(initialSlope);
    expect(s1.params.floor).toBe(initialFloor);
  });

  it('ne touche pas aux autres slices (clip, camera, decos, lang, activeTab)', () => {
    const s0 = useNichoirStore.getState();
    const clipRef = s0.clip;
    const cameraRef = s0.camera;
    const decosRef = s0.decos;
    const initialLang = s0.lang;
    const initialActiveTab = s0.activeTab;

    s0.setParam('H', 300);

    const s1 = useNichoirStore.getState();
    expect(s1.clip).toBe(clipRef); // référence préservée (shallow merge)
    expect(s1.camera).toBe(cameraRef);
    expect(s1.decos).toBe(decosRef);
    expect(s1.lang).toBe(initialLang);
    expect(s1.activeTab).toBe(initialActiveTab);
  });

  it('typage : setParam accepte des unions (DoorType, RidgeType, FloorType)', () => {
    const s = useNichoirStore.getState();
    s.setParam('door', 'pentagon');
    s.setParam('ridge', 'miter');
    s.setParam('floor', 'pose');
    const s1 = useNichoirStore.getState();
    expect(s1.params.door).toBe('pentagon');
    expect(s1.params.ridge).toBe('miter');
    expect(s1.params.floor).toBe('pose');
  });

  it('typage : setParam accepte booléens', () => {
    const s = useNichoirStore.getState();
    s.setParam('doorPanel', true);
    s.setParam('perch', true);
    s.setParam('doorFollowTaper', true);
    const s1 = useNichoirStore.getState();
    expect(s1.params.doorPanel).toBe(true);
    expect(s1.params.perch).toBe(true);
    expect(s1.params.doorFollowTaper).toBe(true);
  });
});
