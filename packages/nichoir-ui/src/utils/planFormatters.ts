// src/utils/planFormatters.ts
//
// Formateurs spécifiques à l'onglet PLAN. Port fidèle v15
// (src/main.js:172-174). `formatArea` est volontairement redéfini ici avec
// `toFixed(0)` (divergence d'arrondi vs CalcTab qui utilise toFixed(1),
// port fidèle v15 dans les deux cas).

/**
 * Aire en mm² convertie en cm² avec toFixed(0) — arrondi entier,
 * port fidèle v15 src/main.js:172-173 (différent de calcFormatters.formatArea
 * qui utilise toFixed(1) par port fidèle de v15 src/main.js:72).
 */
export function formatPlanArea(mmSq: number): string {
  return (mmSq / 100).toFixed(0) + ' cm²';
}

/**
 * Taille du panneau au format "W × H mm". Port v15 src/main.js:174.
 */
export function formatPlanSize(shW: number, shH: number): string {
  return shW + ' × ' + shH + ' mm';
}
