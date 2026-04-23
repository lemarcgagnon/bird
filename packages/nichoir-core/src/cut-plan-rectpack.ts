// src/cut-plan-rectpack.ts
//
// Algorithme alternatif de layout 2D utilisant `rectangle-packer` (MIT, v1.0.4).
// Signature identique à `computeCutLayout` (CutLayout multi-bin).
//
// `GuillotineBinPack` est single-bin natif ; ce fichier implémente la boucle
// multi-bin autour : pour chaque panneau, on instancie un nouveau bin, on y
// insère ce qui rentre via InsertSizes (batch), le reste passe au panneau
// suivant. Une pièce plus grande que le panneau lui-même atterrit directement
// dans `overflow`.
//
// Partage la même `buildCutList` que `cut-plan.ts` (import intra-package)
// pour garantir une comparaison d'algos à armes strictement égales.
//
// Note sur `allowFlip`: on utilise `allowFlip=false` intentionnellement.
// La librairie v1.0.4 ne met pas à jour `node.width/node.height` lors d'une
// rotation — seul le `newNode` interne de découpe est swaté. Activer le flip
// sans correction manuelle produirait des `LayoutPiece` avec des dimensions
// incohérentes par rapport à la position occupée dans le bin.

import { GuillotineBinPack } from 'rectangle-packer';
import { buildCutList, type WorkingPiece } from './cut-plan.js';
import type { CutLayout, LayoutPiece, Panel, Params } from './types.js';

const GAP = 5;

/**
 * Rectangle à insérer dans le packer. Doit étendre la forme attendue par
 * `GuillotineBinPack<T extends Rect>` : champs `x, y, width, height`.
 * Le champ `piece` est préservé car `InsertSizes` ne touche que `x`/`y`.
 */
interface InsertableRect {
  /** Largeur passée au packer (pièce + 2*GAP pour marges). */
  width: number;
  /** Hauteur passée au packer (pièce + 2*GAP pour marges). */
  height: number;
  /** Posés par InsertSizes quand placé. */
  x: number;
  y: number;
  /** Référence à la pièce originale — conservée après splice. */
  piece: WorkingPiece;
}

/** Vrai si la pièce passe dans le panneau (marges GAP de chaque côté). */
function fitsInPanel(w: number, h: number, shW: number, shH: number): boolean {
  return w + 2 * GAP <= shW && h + 2 * GAP <= shH;
}

export function computeCutLayoutRectpack(params: Params): CutLayout {
  const shW = params.panelW;
  const shH = params.panelH;
  const allPieces = buildCutList(params);

  const overflow: LayoutPiece[] = [];
  const panels: Panel[] = [];

  // 1) Filtrer les pièces strictement trop grandes AVANT la boucle multi-bin.
  //    Elles vont en overflow directement.
  const packable: InsertableRect[] = [];
  for (const piece of allPieces) {
    if (!fitsInPanel(piece._w0, piece._h0, shW, shH)) {
      const { _w0, _h0, ...clean } = piece;
      void _w0; void _h0;
      overflow.push(clean);
    } else {
      // Inflation par GAP : on insère (w + 2*GAP, h + 2*GAP). La position
      // retournée par le packer est l'origine de la zone inflatée ; on soustrait
      // GAP pour retrouver la position réelle de la pièce avec sa marge.
      packable.push({
        width: piece._w0 + 2 * GAP,
        height: piece._h0 + 2 * GAP,
        x: 0,
        y: 0,
        piece,
      });
    }
  }

  // 2) Boucle multi-bin : à chaque itération, un nouveau bin tente d'absorber
  //    les rects restants. InsertSizes splice les placés vers `usedRectangles`
  //    et laisse les non-placés dans le tableau passé. On passe une copie
  //    shallow pour que `remaining` pointe sur les objets non consommés.
  //
  //    `allowFlip=false` : la librairie ne mute pas width/height lors d'un flip,
  //    donc on désactive la rotation pour garantir la cohérence des dimensions.
  let remaining = packable.slice();
  while (remaining.length > 0) {
    const toInsert: InsertableRect[] = remaining.slice();
    const bin = new GuillotineBinPack(shW, shH, false); // allowFlip=false
    bin.InsertSizes(
      toInsert as Parameters<typeof bin.InsertSizes>[0],
      true, // merge freeRects after each placement
      GuillotineBinPack.FreeRectChoiceHeuristic.RectBestAreaFit,
      GuillotineBinPack.GuillotineSplitHeuristic.SplitShorterLeftoverAxis,
    );

    // Après InsertSizes : les rects placés ont été splicés vers
    // `bin.usedRectangles` (avec x/y posés). Les non-placés restent dans
    // `toInsert`.
    const usedRectangles = bin.usedRectangles as unknown as InsertableRect[];

    if (usedRectangles.length === 0) {
      // Defense in depth — ne devrait pas arriver car les pièces trop grandes
      // ont été filtrées avant. Si ça arrive malgré tout, on les met en overflow.
      for (const r of remaining) {
        const { _w0, _h0, ...clean } = r.piece;
        void _w0; void _h0;
        overflow.push(clean);
      }
      break;
    }

    const panelPieces: LayoutPiece[] = usedRectangles.map(r => {
      // `allowFlip=false` → pas de rotation → w=_w0, h=_h0 toujours.
      // La position retournée est l'origine de la zone inflatée ; on ajoute
      // GAP pour se décaler à l'intérieur de la marge.
      const { _w0, _h0, ...clean } = r.piece;
      void _w0; void _h0;
      return {
        ...clean,
        px: r.x + GAP,
        py: r.y + GAP,
        rot: false,
        w: r.piece._w0,
        h: r.piece._h0,
      };
    });

    const usedArea = panelPieces.reduce((acc, p) => acc + p.w * p.h, 0);
    panels.push({
      pieces: panelPieces,
      shW,
      shH,
      usedArea,
      occupation: shW * shH > 0 ? usedArea / (shW * shH) : 0,
    });

    // Les rects non-placés restent dans `toInsert` (non splicés).
    remaining = toInsert;
  }

  const totalUsedArea = panels.reduce((acc, p) => acc + p.usedArea, 0);
  const meanOccupation =
    panels.length === 0
      ? 0
      : panels.reduce((acc, p) => acc + p.occupation, 0) / panels.length;

  return { panels, overflow, totalUsedArea, meanOccupation };
}
