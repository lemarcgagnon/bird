// src/components/tabs/ExportTab.tsx
//
// Orchestrateur de l'onglet EXPORT. Consolide TOUS les exports (STL house,
// STL door, ZIP panneaux, SVG plan de coupe) sous un DownloadService
// injecté via Context React.
//
// DIVERGENCES vs v15 (documentées ici pour review) :
//   1. Déplacement des boutons plan SVG/PNG de l'onglet PLAN vers EXPORT
//      (décision P2.5 validée codex). Centralise les side-effects de
//      téléchargement en un seul site de consommation DownloadService.
//   2. `export.stl.hint` HTML inline (v15 `<br>` dans une string)
//      → éclaté en 3 clés i18n séparées et rendu en <ul>/<li>.
//   3. `plan.export.png` reporté à P3 (pas de raster browser en P2.6 ;
//      SVG reste le format vectoriel de référence pour découpe).
//   4. `export.error.noJSZip` supprimée (JSZip bundled en dépendance npm,
//      plus de check CDN externe).

'use client';

import { ExportStlSection } from './ExportStlSection.js';
import { ExportPlanSection } from './ExportPlanSection.js';
import styles from './ExportTab.module.css';

export function ExportTab(): React.JSX.Element {
  return (
    <div className={styles.root}>
      <ExportStlSection />
      <ExportPlanSection />
    </div>
  );
}
