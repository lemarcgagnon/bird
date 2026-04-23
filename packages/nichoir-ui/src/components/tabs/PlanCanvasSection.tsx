// src/components/tabs/PlanCanvasSection.tsx
//
// Thin wrapper : appelle computeCutLayout et délègue le rendu à
// CutLayoutRenderer (composant partagé multi-bin).

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { computeCutLayout } from '@nichoir/core';
import { CutLayoutRenderer } from '../cut-plan/CutLayoutRenderer.js';

export function PlanCanvasSection(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const t = useT();
  const layout = computeCutLayout(params);
  return <CutLayoutRenderer layout={layout} t={t} algoBadge="shelf-packing" />;
}
