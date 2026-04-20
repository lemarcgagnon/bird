// src/components/ViewportBoundary.tsx
//
// React Error Boundary générique (class). Capture les erreurs JS du tree
// qu'il enveloppe (render, lifecycle, useEffect après commit) et affiche un
// fallback fourni par le parent.
//
// Générique par design : les class components ne peuvent pas utiliser les
// hooks React (useT, useNichoirStore, etc.), donc la résolution i18n du
// fallback est reportée côté parent via la prop `fallback: React.ReactNode`.
// Le parent construit typiquement un composant fonctionnel
// (cf. ViewportErrorFallback.tsx) et le passe en JSX.
//
// Signature de `onError` alignée avec React : `(Error, ErrorInfo)`. Le
// `ErrorInfo.componentStack` permet de câbler une télémétrie ultérieurement
// sans changer le contrat.
//
// Ne PAS capturer globalement l'app : ce boundary est destiné à envelopper
// **seulement** le sous-tree fragile (le Viewport 3D). La Sidebar et les
// autres tabs non-viewport restent vivants si le Viewport crash.

'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ViewportBoundaryProps {
  children: ReactNode;
  /** JSX à afficher quand un enfant throw. Typiquement un composant
   *  fonctionnel du parent qui peut résoudre l'i18n via useT(). */
  fallback: ReactNode;
  /** Callback invoqué après qu'une erreur a été capturée. Si omis, le
   *  boundary log l'erreur via `console.error`. Le `info.componentStack`
   *  permet de câbler une télémétrie plus tard sans changer le contrat. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ViewportBoundaryState {
  hasError: boolean;
}

export class ViewportBoundary extends Component<
  ViewportBoundaryProps,
  ViewportBoundaryState
> {
  override state: ViewportBoundaryState = { hasError: false };

  static getDerivedStateFromError(_error: Error): ViewportBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const { onError } = this.props;
    if (onError) {
      onError(error, info);
    } else {
      // Fallback par défaut : log console. Matérialisé pour qu'un dev
      // voie quand même passer l'erreur en l'absence d'un adapter
      // Telemetry injecté.
      // eslint-disable-next-line no-console
      console.error('[ViewportBoundary] Caught error:', error, info.componentStack);
    }
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
