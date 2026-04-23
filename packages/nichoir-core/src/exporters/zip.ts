// src/exporters/zip.ts
//
// Port **fidèle avec divergences documentées** de la logique ZIP depuis
// src/exporters/stl.js:exportPanelsZIP. Retourne un `Uint8Array` — le trigger
// du download est de la responsabilité de `nichoir-adapters/DownloadService`.
// "Port fidèle" ≠ "1:1 littéral" : les divergences ci-dessous sont intentionnelles.
//
// Divergences vs src/exporters/stl.js:exportPanelsZIP (lignes 152-183) :
//   1. `JSZip` est importé nommément au lieu d'être une globale (src l'attendait
//      depuis `<script src="...jszip.min.js">`).
//   2. L'alerte `if (typeof JSZip === 'undefined') { alert(...); return; }` est
//      supprimée — le bundle npm garantit la présence.
//   3. L'alerte `if (!totalFiles) { alert(...); return; }` est remplacée par
//      un retour d'un ZIP vide. Le contrat dit `Promise<Uint8Array>` (non-nullable).
//      En pratique, un `buildResult.defs` sans aucun HOUSE_KEYS n'arrive pas
//      dans le flow standard ; le comportement "ZIP vide" est un fail-safe.
//   4. Le download via `URL.createObjectURL + <a download>` est supprimé (UI).
//   5. Les noms de fichiers sont passés par `translate('panel.<key>')` injecté
//      (au lieu de l'import global `t()` dans src).

import JSZip from 'jszip';
import type { BuildResult, Params, Translator } from '../types.js';
import { _collectDefsTriangles, _trisToSTL, _HOUSE_KEYS, _applyPrintTransform } from './stl.js';

// Keys qui, si présentes dans defs, reçoivent aussi leur deco associée fusionnée
// dans le STL zippé correspondant. Même politique que src/exporters/stl.js:162.
const DECO_PARENT_KEYS = new Set<string>(['front', 'back', 'left', 'right', 'roofL', 'roofR']);

/**
 * Génère un ZIP contenant 1 STL par panneau physique.
 *
 * Politique de regroupement (parité avec src/exporters/stl.js:156-169) :
 * - Pour chaque `key` de HOUSE_KEYS, collecte les triangles du panneau
 *   ET ceux de sa déco associée (`deco_<key>`) si elle existe, fusionnés
 *   dans un même STL.
 * - Le `doorPanel` est inclus **uniquement** si
 *   `params.door !== 'none' && params.doorPanel`.
 * - Les fichiers sans triangle (panneaux absents, ex: perch désactivé) sont omis.
 *
 * `translate` résout les noms de fichiers via la clé `panel.<key>`
 * (ex: `panel.front` → `'facade_avant'`).
 */
export async function generatePanelsZIP(
  buildResult: BuildResult,
  params: Params,
  translate: Translator,
): Promise<Uint8Array> {
  const zip = new JSZip();
  const allKeys: string[] = [..._HOUSE_KEYS];
  if (params.door !== 'none' && params.doorPanel) allKeys.push('doorPanel');

  for (const key of allKeys) {
    const collectKeys: string[] = [key];
    if (DECO_PARENT_KEYS.has(key)) collectKeys.push('deco_' + key);
    const tris = _collectDefsTriangles(buildResult.defs, collectKeys);
    if (tris.length === 0) continue;
    // Orientation Z-up, plancher à Z=0 pour chaque panneau indépendamment :
    // chaque STL dans le ZIP est autonome (l'utilisateur imprime un panneau à la fois).
    const stlBytes = _trisToSTL(_applyPrintTransform(tris), key);
    const fname = translate('panel.' + key) + '.stl';
    zip.file(fname, stlBytes);
  }

  // JSZip renvoie `Uint8Array` directement quand type='uint8array'.
  return zip.generateAsync({ type: 'uint8array' });
}
