// src/components/Viewport.tsx
//
// Wrapper React autour de `ImperativeThreeViewport` (classe TS non-React).
// Pattern canonique documenté dans VIEWPORT.md §"Contrat d'usage côté React" :
//   - useRef pour le host div ET l'adapter
//   - useEffect mount-once (deps=[]) qui fait mount+unmount
//   - useEffect sur state qui appelle update()
//
// Frontière client explicite — ce composant touche au DOM et à Three.js.

'use client';

import { useEffect, useRef } from 'react';
import { ImperativeThreeViewport } from '../viewports/ImperativeThreeViewport.js';
import type { ViewportAdapter } from '../viewports/ViewportAdapter.js';
import { useNichoirStore } from '../store.js';
import { useViewportRef } from '../viewports/ViewportRefContext.js';

export interface ViewportProps {
  /** Style CSS du conteneur hôte. Par défaut : plein écran. */
  style?: React.CSSProperties;
  /** Classe CSS du conteneur hôte. */
  className?: string;
}

export function Viewport({ style, className }: ViewportProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<ViewportAdapter | null>(null);
  // Ref partagé via ViewportRefContext : permet à ExportPng3dSection (sidebar)
  // d'appeler captureAsPng() sur l'adapter monté sans prop drilling.
  const viewportRefCtx = useViewportRef();
  // Sélecteur qui renvoie l'état complet. Zustand re-render à chaque changement
  // (même référence sur même contenu via sa logique interne). Suffisant pour P2.1
  // où il n'y a qu'un state initial figé. P2.2+ pourra split les sélecteurs pour
  // minimiser les rerenders quand un onglet mute seulement un sous-slice.
  const state = useNichoirStore();

  // Mount une seule fois (deps=[])
  useEffect(() => {
    if (!hostRef.current) return;
    const adapter = new ImperativeThreeViewport();
    // state ici est une closure capturée au premier render — c'est OK parce que
    // le 2e useEffect rafraîchit via update().
    adapter.mount(hostRef.current, state);
    adapterRef.current = adapter;
    // Populer le ref partagé pour que les composants sidebar puissent capturer.
    viewportRefCtx.current = adapter;
    return (): void => {
      adapter.unmount();
      adapterRef.current = null;
      viewportRefCtx.current = null;
    };
    // deps=[] intentionnel : mount une seule fois au premier render.
    // Le 2e useEffect ci-dessous synchronise l'adapter avec les changements
    // de state via update(). viewportRefCtx est stable (useRef dans NichoirApp).
  }, []);

  // Update sur changement de state
  useEffect(() => {
    adapterRef.current?.update(state);
  }, [state]);

  const defaultStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    ...style,
  };

  return <div ref={hostRef} style={defaultStyle} className={className} />;
}
