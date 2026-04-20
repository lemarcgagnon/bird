// src/calculations.js
// Calculs dérivés des paramètres : volumes, aires, liste de coupe.
// Retourne des structures pures (pas de DOM).

const D2R = Math.PI / 180;

export function computeCalculations(params) {
  const { W, H, D, slope, overhang, T, floor, ridge, taperX } = params;
  const ang = slope * D2R;
  const isPose = floor === 'pose';

  const wallH = isPose ? H - T : H;
  const rH = (W/2) * Math.tan(ang);
  const sL = (W/2 + overhang) / Math.cos(ang);
  const rL = D + 2*overhang;
  const bev = T * Math.tan(ang);
  const sL_L = ridge === 'left' ? sL + T : sL;
  const sL_R = ridge === 'right' ? sL + T : sL;

  const Wtop = W;
  const Wbot = W + 2 * taperX;
  const wallHreal = Math.sqrt(wallH*wallH + taperX*taperX);
  const hasTaper = taperX !== 0;

  const floorW = isPose ? Wbot : Wbot - 2*T;
  const floorD = isPose ? D : D - 2*T;
  const sideD = D - 2*T;

  // Volume extérieur : prisme trapézoïdal (base) + pignons (×2)
  const wallPrismV = ((Wtop + Wbot) / 2) * wallH * D;
  const gableV = W * D * rH / 2;
  const extV = wallPrismV + gableV;

  // Volume intérieur
  // FIX bug #4 : en mode 'pose', le plancher est DANS le volume extérieur et occupe
  // une couche de T × iW × iD qui doit être retirée. L'ancien code donnait la même
  // valeur dans les deux modes parce que la compensation de wallH était mal faite.
  const iW = W - 2*T;
  const iD = D - 2*T;
  // Hauteur intérieure réellement creuse : H total - 2T (plancher + toit) en 'pose',
  // et H total - T (seulement toit) en 'enclave' car le plancher est entre les murs
  // et son épaisseur n'est pas déduite de wallH dans ce cas.
  const iWH = isPose ? (H - 2*T) : (wallH - T);
  const iWbot = iW + 2 * taperX;
  const iWallPrismV = ((iW + iWbot) / 2) * iWH * iD;
  const iRH = (iW/2) * Math.tan(ang);
  const iGableV = iW * iD * iRH / 2;
  const intV = iWallPrismV + iGableV;

  // Surfaces
  const facadeA = ((Wtop + Wbot) / 2) * wallH + W * rH / 2;
  const sideA = sideD * wallHreal;
  const bottomA = floorW * floorD;
  let rLA, rRA;
  if (ridge === 'miter') {
    rLA = rRA = (sL + bev/2) * rL;
  } else {
    rLA = sL_L * rL;
    rRA = sL_R * rL;
  }
  const totalA = 2*facadeA + 2*sideA + bottomA + rLA + rRA;

  return {
    volumes: { ext: extV, int: intV, mat: extV - intV },
    surfaces: {
      total: totalA, facades: 2*facadeA, sides: 2*sideA, bottom: bottomA, roof: rLA + rRA,
    },
    derived: {
      wallH, rH, sL, rL, bev, sL_L, sL_R, Wtop, Wbot, wallHreal, hasTaper,
      floorW, floorD, sideD, isPose, ang,
    },
  };
}

// Liste des pièces à découper, prête pour affichage.
// Retourne des clés i18n + valeurs (le template rend avec t()).
export function computeCutList(params, derived) {
  const { slope, T, floor, ridge, taperX, door, doorW, doorH, doorVar, doorPanel, perch, perchDiam, perchLen } = params;
  const { Wtop, Wbot, wallH, wallHreal, rH, sideD, floorW, floorD, sL, rL, sL_L, sL_R, hasTaper } = derived;
  const isPose = floor === 'pose';

  const facadeDim = hasTaper
    ? `${Wbot.toFixed(0)}↕${Wtop.toFixed(0)} × ${(wallH + rH).toFixed(0)}`
    : `${Wtop.toFixed(0)} × ${(wallH + rH).toFixed(0)}`;

  const facadeNoteKey = hasTaper
    ? (taperX > 0 ? 'calc.cuts.note.flared' : 'calc.cuts.note.narrowed')
    : 'calc.cuts.note.pentagon';

  const sideDim = `${sideD.toFixed(0)} × ${wallHreal.toFixed(0)}`;
  const sideNoteKey = hasTaper
    ? (taperX > 0 ? 'calc.cuts.note.flaredBy' : 'calc.cuts.note.narrowedBy')
    : null;
  const sideNoteParams = hasTaper ? { v: Math.abs(taperX).toFixed(0) } : null;

  const floorNoteKey = isPose ? 'calc.cuts.note.full' : 'calc.cuts.note.enclave';

  const cuts = [];
  cuts.push({ nameKey: 'calc.cuts.facade', noteKey: facadeNoteKey, qty: 2, dim: facadeDim });
  cuts.push({ nameKey: 'calc.cuts.side', noteKey: sideNoteKey, noteParams: sideNoteParams, qty: 2, dim: sideDim });
  cuts.push({ nameKey: 'calc.cuts.bottom', noteKey: floorNoteKey, qty: 1, dim: `${floorW.toFixed(0)} × ${floorD.toFixed(0)}` });

  if (ridge === 'miter') {
    cuts.push({ nameKey: 'calc.cuts.roof', noteKey: 'calc.cuts.note.miter', noteParams: { slope }, qty: 2, dim: `${sL.toFixed(0)} × ${rL.toFixed(0)}` });
  } else {
    cuts.push({ nameKey: 'calc.cuts.roofL', noteKey: ridge === 'left' ? 'calc.cuts.note.ridgeT' : null, qty: 1, dim: `${sL_L.toFixed(0)} × ${rL.toFixed(0)}` });
    cuts.push({ nameKey: 'calc.cuts.roofR', noteKey: ridge === 'right' ? 'calc.cuts.note.ridgeT' : null, qty: 1, dim: `${sL_R.toFixed(0)} × ${rL.toFixed(0)}` });
  }

  if (door !== 'none' && doorPanel) {
    const v = doorVar / 100;
    const dpW = (doorW * v).toFixed(0);
    const dpH = (doorH * v).toFixed(0);
    const shapeKey = `calc.door.shape.${door}`;
    cuts.push({
      nameKey: 'calc.cuts.door',
      doorShape: { key: shapeKey, percent: doorVar !== 100 ? doorVar : null },
      qty: 1,
      dim: `${dpW} × ${dpH}`,
    });
  }
  if (perch && door !== 'none') {
    cuts.push({
      nameKey: 'calc.cuts.perch',
      noteKey: 'calc.cuts.note.cylinder',
      noteParams: { d: perchDiam },
      qty: 1,
      dim: `∅${perchDiam.toFixed(0)} × ${perchLen.toFixed(0)}`,
    });
  }

  // Compte de pièces
  let nPieces = 7; // 2 façades + 2 côtés + 1 plancher + 2 toits
  if (door !== 'none' && doorPanel) nPieces++;
  if (perch && door !== 'none') nPieces++;

  return { cuts, nPieces };
}
