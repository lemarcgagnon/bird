// src/adapters/DownloadServiceContext.tsx
//
// Context React qui transporte l'adapter `DownloadService` du host SaaS (ou
// du fallback par défaut) jusqu'aux composants qui produisent un export
// (typiquement ExportTab).
//
// Contrainte d'architecture (codex P2.6) :
//   - Les hosts SaaS qui veulent injecter leur propre DownloadService
//     (avec télémétrie, quotas, etc.) DOIVENT le faire depuis un composant
//     CLIENT ('use client'), pas depuis un Server Component.
//   - Raison : une instance de classe n'est pas sérialisable à travers la
//     frontière RSC de Next.js, et BrowserDownloadService dépend de
//     `document` qui n'existe pas côté server.
//   - NichoirApp instancie un fallback BrowserDownloadService via useMemo si
//     aucun provider n'enveloppe l'app côté consumer — voir NichoirApp.tsx.

'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { DownloadService } from '@nichoir/adapters';

const DownloadServiceContext = createContext<DownloadService | null>(null);

export interface DownloadServiceProviderProps {
  service: DownloadService;
  children: ReactNode;
}

export function DownloadServiceProvider({
  service,
  children,
}: DownloadServiceProviderProps): React.JSX.Element {
  return (
    <DownloadServiceContext.Provider value={service}>
      {children}
    </DownloadServiceContext.Provider>
  );
}

/**
 * Hook d'accès au DownloadService. Throw explicite si appelé hors Provider
 * — pattern standard React pour éviter les silent-fail (un composant Export
 * qui ne déclenche rien sans message serait pire qu'une erreur claire).
 */
export function useDownloadService(): DownloadService {
  const service = useContext(DownloadServiceContext);
  if (service === null) {
    throw new Error(
      '[nichoir-ui] useDownloadService called outside DownloadServiceProvider. ' +
      'Wrap your tree with <DownloadServiceProvider service={...}>, or use NichoirApp ' +
      'which provides a BrowserDownloadService fallback by default.',
    );
  }
  return service;
}
