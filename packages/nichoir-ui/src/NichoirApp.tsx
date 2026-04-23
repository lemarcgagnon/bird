// src/NichoirApp.tsx
//
// Composant racine du module Nichoir. Grid 2-colonnes : Sidebar à gauche,
// Viewport 3D à droite. Responsive : en-dessous de 640px, stack vertical.
//
// P2.2b :
//   - DimTab opérationnel dans la Sidebar (pour activeTab='dim').
//   - Sync `document.documentElement.lang = store.lang` via useEffect.
//
// 'use client' ici — première frontière client (la page Next.js reste server).

'use client';

import { useEffect, useMemo } from 'react';
import { BrowserDownloadService, type DownloadService } from '@nichoir/adapters';
import { Sidebar } from './components/Sidebar.js';
import { Viewport } from './components/Viewport.js';
import { ViewportBoundary } from './components/ViewportBoundary.js';
import { ViewportErrorFallback } from './components/ViewportErrorFallback.js';
import { DownloadServiceProvider } from './adapters/DownloadServiceContext.js';
import { ViewportRefProvider, useCreateViewportRef } from './viewports/ViewportRefContext.js';
import { useNichoirStore } from './store.js';
import styles from './NichoirApp.module.css';

export interface NichoirAppProps {
  /** Classe CSS additionnelle sur le conteneur racine. */
  className?: string;
  /**
   * Adapter d'export (download) optionnel. Si non fourni, NichoirApp instancie
   * un `BrowserDownloadService` côté client via useMemo.
   *
   * IMPORTANT (contrainte RSC Next.js) : cette prop NE PEUT PAS être passée
   * depuis un Server Component (les instances de classe ne traversent pas la
   * frontière RSC et `BrowserDownloadService` dépend de `document`). Les
   * hosts SaaS qui veulent injecter un adapter custom (télémétrie, quotas)
   * doivent le faire depuis un composant 'use client'.
   */
  downloadService?: DownloadService;
}

export function NichoirApp({
  className,
  downloadService,
}: NichoirAppProps = {}): React.JSX.Element {
  const lang = useNichoirStore((s) => s.lang);
  // Ref partagé entre Viewport (qui le peuple au mount) et ExportPng3dSection
  // (qui l'appelle pour capturer). Créé une seule fois via useCreateViewportRef.
  const viewportRef = useCreateViewportRef();

  // Fallback DownloadService instancié client-side. useMemo pour éviter de
  // recréer une instance à chaque render ; `downloadService` en deps pour
  // que, si le host fournit un service custom plus tard, on le prenne.
  const effectiveDownloadService = useMemo<DownloadService>(
    () => downloadService ?? new BrowserDownloadService(),
    [downloadService],
  );

  // Sync html[lang] avec le store. SSR initial = layout hardcoded 'fr',
  // le client hydrate puis remet la bonne valeur. Geste minimal pour que
  // les technos d'assistance annoncent la bonne langue après un switch.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  return (
    <ViewportRefProvider viewportRef={viewportRef}>
      <DownloadServiceProvider service={effectiveDownloadService}>
        <div className={`${styles.root}${className ? ` ${className}` : ''}`}>
          <Sidebar />
          <main className={styles.viewport}>
            <ViewportBoundary fallback={<ViewportErrorFallback />}>
              <Viewport />
            </ViewportBoundary>
          </main>
        </div>
      </DownloadServiceProvider>
    </ViewportRefProvider>
  );
}
