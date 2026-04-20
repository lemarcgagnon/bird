// src/utils/calcFormatters.ts
//
// Formateurs d'unités pour l'onglet CALC. Port fidèle 1:1 de v15
// (src/main.js:71-72, 84). Extrait dans un module pur pour permettre des
// tests unitaires sans monter le DOM.
//
// Conventions de seuils et d'arrondis (voir tests/calcFormatters.test.ts) :
//   - formatVolume : mm³ → 'X.X cm³' si v ≤ 1e6, sinon 'X.XX L'.
//     Le seuil est STRICT (v > 1e6) pour matcher v15 `v > 1e6 ? ... : ...`.
//   - formatArea   : mm² → 'X.X cm²' (division par 100 = 10×10).
//   - formatThickness : mm → 'X.X mm (Y.YY")' (double unité métrique/imperial).

/** Formate un volume en mm³. Seuil 1e6 → litres. Port v15 src/main.js:71. */
export function formatVolume(mmCube: number): string {
  return mmCube > 1e6
    ? (mmCube / 1e6).toFixed(2) + ' L'
    : (mmCube / 1e3).toFixed(1) + ' cm³';
}

/** Formate une aire en mm². Port v15 src/main.js:72. */
export function formatArea(mmSq: number): string {
  return (mmSq / 100).toFixed(1) + ' cm²';
}

/** Formate une épaisseur en mm (dual mm + inch). Port v15 src/main.js:84. */
export function formatThickness(mm: number): string {
  return mm.toFixed(1) + ' mm (' + (mm / 25.4).toFixed(2) + '")';
}
