// src/store.ts
//
// Zustand store pour P2.1. Shape 1:1 avec `NichoirState` du contrat `@nichoir/core`.
// Actions minimales pour P2.1 : `setState(partial)` qui merge ; `replaceState(full)`
// pour reset. Les onglets de P2.2+ ajouteront des actions typées (setParam, toggleClip, etc.).
//
// Pas de `'use client'` ici — le store est un module pur, utilisable côté server
// (SSR) ou client. Les composants qui le consomment auront `'use client'`.

import { create } from 'zustand';
import { createInitialState } from '@nichoir/core';
import type {
  NichoirState, TabKey, Lang, Params, ClipAxis, ClipAxisKey,
  DecoKey, DecoSlotCore,
} from '@nichoir/core';

export interface NichoirStore extends NichoirState {
  /** Merge partiel de l'état (shallow merge top-level). */
  setState: (partial: Partial<NichoirState>) => void;

  /** Remplace complètement l'état. */
  replaceState: (next: NichoirState) => void;

  /** Change l'onglet actif (DIM/VUE/DÉCOR/CALC/PLAN/EXPORT). */
  setActiveTab: (tab: TabKey) => void;

  /** Change la langue d'affichage (fr/en). */
  setLang: (lang: Lang) => void;

  /**
   * Mute un paramètre individuel de façon typée.
   * Utilisé par les onglets (DimTab, VueTab, etc.) pour chaque slider/toggle.
   * Ne touche pas aux autres slices (clip, camera, decos).
   */
  setParam: <K extends keyof Params>(key: K, value: Params[K]) => void;

  /**
   * Mute un axe de plan de coupe (on, pos, ou les deux) via merge partiel.
   * `pos` est stocké normalisé dans [0..1] (contrat `@nichoir/core` ClipAxis).
   * La UI qui travaille en 0..100 doit multiplier/diviser par 100 explicitement.
   */
  setClipAxis: <A extends ClipAxisKey>(axis: A, patch: Partial<ClipAxis>) => void;

  /** Change le panneau cible de l'édition de décor (sélecteur de DecoTab). */
  setActiveDecoKey: (key: DecoKey) => void;

  /**
   * Mute un ou plusieurs champs d'un slot de décor via merge partiel sur
   * `decos[key]`. Ne touche pas aux autres slots. Utilisé par DecoEnableSection
   * (P2.7a) et prévu pour P2.7b/c (file handling, mode/dims/relief/clip).
   * Générique plutôt que spécifique — validé codex pour éviter le churn entre
   * sous-phases DÉCOR.
   */
  setDecoSlot: (key: DecoKey, patch: Partial<DecoSlotCore>) => void;
}

export const useNichoirStore = create<NichoirStore>((set) => ({
  ...createInitialState(),
  setState: (partial): void => set(partial),
  replaceState: (next): void => set(next),
  setActiveTab: (tab): void => set({ activeTab: tab }),
  setLang: (lang): void => set({ lang }),
  setParam: (key, value): void =>
    set((state) => ({ params: { ...state.params, [key]: value } })),
  setClipAxis: (axis, patch): void =>
    set((state) => ({
      clip: { ...state.clip, [axis]: { ...state.clip[axis], ...patch } },
    })),
  setActiveDecoKey: (key): void => set({ activeDecoKey: key }),
  setDecoSlot: (key, patch): void =>
    set((state) => ({
      decos: { ...state.decos, [key]: { ...state.decos[key], ...patch } },
    })),
}));
