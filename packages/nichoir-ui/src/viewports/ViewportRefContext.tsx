// src/viewports/ViewportRefContext.tsx
//
// Context React qui expose un MutableRefObject<ViewportAdapter | null>
// partageable entre Viewport.tsx (qui le peuple lors du mount) et les
// composants sidebar (ExportPng3dSection) qui l'appellent pour capturer
// l'image courante.
//
// Architecture : un seul ViewportAdapter actif à la fois dans NichoirApp.
// Le ref est peuplé après mount() et mis à null après unmount().
//
// V1 de VIEWPORT.md : pas de leak React dans l'adapter. Ce contexte est
// côté consommateur React — pas touché par l'adapter lui-même.

'use client';

import { createContext, useContext, useRef, type ReactNode, type MutableRefObject } from 'react';
import type { ViewportAdapter } from './ViewportAdapter.js';

const ViewportRefContext = createContext<MutableRefObject<ViewportAdapter | null> | null>(null);

export interface ViewportRefProviderProps {
  children: ReactNode;
  viewportRef: MutableRefObject<ViewportAdapter | null>;
}

export function ViewportRefProvider({
  children,
  viewportRef,
}: ViewportRefProviderProps): React.JSX.Element {
  return (
    <ViewportRefContext.Provider value={viewportRef}>
      {children}
    </ViewportRefContext.Provider>
  );
}

/**
 * Hook d'accès au ref de l'adapter ViewportAdapter courant.
 * Retourne un MutableRefObject<ViewportAdapter | null>.
 * Le `.current` vaut null si le viewport n'est pas encore monté.
 *
 * @throws si appelé hors ViewportRefProvider.
 */
export function useViewportRef(): MutableRefObject<ViewportAdapter | null> {
  const ref = useContext(ViewportRefContext);
  if (ref === null) {
    throw new Error(
      '[nichoir-ui] useViewportRef called outside ViewportRefProvider. ' +
      'Wrap your tree with NichoirApp which provides ViewportRefProvider by default.',
    );
  }
  return ref;
}

/**
 * Hook factory pour créer le ref à passer au ViewportRefProvider.
 * Utilisé dans NichoirApp pour créer le ref une seule fois.
 */
export function useCreateViewportRef(): MutableRefObject<ViewportAdapter | null> {
  return useRef<ViewportAdapter | null>(null);
}
