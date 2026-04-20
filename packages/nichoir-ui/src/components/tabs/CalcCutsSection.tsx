// src/components/tabs/CalcCutsSection.tsx
//
// Section "liste de coupe" de CalcTab (read-only). Port v15
// index.html:329-330 + src/main.js:87-107. Divergence sémantique :
// v15 utilisait <div class="cut-table|cut-header|cut-row">, on passe à
// <table> sémantique pour accessibilité (décision P2.4 validée par codex).
//
// Les données viennent de `computeCutList(params, derived)` du core. Chaque
// CutItem porte `nameKey`, `noteKey?`, `noteParams?`, `doorShape?`, `qty`,
// `dim`. La UI ne fait que la résolution i18n + le rendu.

'use client';

import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { computeCalculations, computeCutList } from '@nichoir/core';
import type { CutItem, Translator } from '@nichoir/core';
import styles from './CalcTab.module.css';

/** Résout la "note" affichée après le label de la pièce.
 *  - `doorShape` a priorité sur `noteKey` (v15 src/main.js:96-99)
 *  - `doorShape.percent` ajoute un suffixe ` N%` si non-null
 *  - `noteKey` + `noteParams` utilise le remplacement {name} standard de useT
 */
function resolveNote(cut: CutItem, t: Translator): string | null {
  if (cut.doorShape) {
    const shape = t(cut.doorShape.key);
    return cut.doorShape.percent !== null
      ? `${shape} ${cut.doorShape.percent}%`
      : shape;
  }
  if (cut.noteKey) {
    return t(cut.noteKey, cut.noteParams ?? {});
  }
  return null;
}

export function CalcCutsSection(): React.JSX.Element {
  const params = useNichoirStore((s) => s.params);
  const t = useT();
  const { derived } = computeCalculations(params);
  const { cuts } = computeCutList(params, derived);

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('calc.cuts')}</div>
      <table className={styles.cutTable}>
        <thead>
          <tr>
            <th className={styles.piece} scope="col">{t('calc.cuts.header.piece')}</th>
            <th className={styles.qty} scope="col">{t('calc.cuts.header.qty')}</th>
            <th className={styles.dims} scope="col">{t('calc.cuts.header.dims')}</th>
          </tr>
        </thead>
        <tbody>
          {cuts.map((c, i) => {
            const note = resolveNote(c, t);
            return (
              <tr key={`${c.nameKey}-${i}`}>
                <td className={styles.piece}>
                  {t(c.nameKey)}
                  {note && <span className={styles.cutNote}> ({note})</span>}
                </td>
                <td className={styles.qty}>×{c.qty}</td>
                <td className={styles.dims}>{c.dim}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
