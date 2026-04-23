// src/components/tabs/PlanCanvasSection2.tsx
//
// Miroir de PlanCanvasSection pour l'onglet Plan2. Appelle
// computeCutLayoutRectpack au lieu de computeCutLayout et passe
// algoBadge="rectangle-packer" au renderer.

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { computeCutLayoutRectpack } from '@nichoir/core';
import { CutLayoutRenderer } from '../cut-plan/CutLayoutRenderer.js';

export function PlanCanvasSection2(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const t = useT();
  const layout = computeCutLayoutRectpack(params);
  return <CutLayoutRenderer layout={layout} t={t} algoBadge="rectangle-packer" />;
}
