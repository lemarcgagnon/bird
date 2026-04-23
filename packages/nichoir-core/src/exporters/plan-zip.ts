// src/exporters/plan-zip.ts
//
// Génère un ZIP contenant un SVG par panneau du layout multi-bin.
// Fichiers nommés `panel-1.svg`, `panel-2.svg`, … (ordre préservé de CutLayout.panels).
// Nom neutre en anglais pour éviter i18n dans un nom de fichier ZIP.

import JSZip from 'jszip';
import type { CutLayout, Translator } from '../types.js';
import { generatePlanSVG } from './svg.js';

export async function generatePlanZIP(
  layout: CutLayout,
  translate: Translator,
): Promise<Uint8Array> {
  const zip = new JSZip();
  layout.panels.forEach((panel, i) => {
    const svg = generatePlanSVG(panel, translate);
    zip.file(`panel-${i + 1}.svg`, svg);
  });
  return zip.generateAsync({ type: 'uint8array' });
}
