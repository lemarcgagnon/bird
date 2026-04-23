// src/geometry/panels.ts
// Construction des géométries de panneaux. Pure — ne touche pas au store ni au DOM.
//
// Divergences documentées vs src/geometry/panels.js :
//   1. Tuples → objets PanelDef (mécanique, mêmes champs).
//   2. `buildDecoGeo(d)` → `buildDecoGeoVector` OU `buildDecoGeoHeightmap` selon `d.mode`,
//      **sans fallback cross-mode**. Dans src, un mode='vector' avec shapes vides
//      retombait sur la branche heightmap via le contrôle de flow interne. Ici,
//      le contrat scinde strictement les deux branches — pas de fallback.
//   3. `materializeDefs` (UI) exclue intentionnellement.
//   4. `mkPent` : garde `door.type !== 'none'` omise. `DoorInfo.type` est typé
//      `Exclude<DoorType, 'none'>` — l'invariant est préservé par le type, pas
//      par un check runtime. L'appelant doit passer `null` si door='none'.
//   5. Check d'emptiness post-buildDecoGeo* : src se reposait sur un retour `null`
//      pour les cas dégénérés ; le contrat TS garantit une BufferGeometry non-null
//      mais possiblement **vide** (`position.count === 0`). On check explicitement
//      cette vacuité pour ne pas pousser un def deco vide dans `defs`.

import * as THREE from 'three';
import { PALETTES, hexToNumber } from '../palettes.js';
import { DECO_KEYS } from '../state.js';
import {
  buildDecoGeoVector,
  buildDecoGeoHeightmap,
  placeDecoOnPanel,
  buildPanelClipPlanes,
} from './deco.js';
import type {
  NichoirState,
  BuildResult,
  PanelDef,
  PanelDefKey,
  Vec3,
  RoofPlaneFn,
  RidgeType,
  DoorInfo,
  PerchHoleInfo,
  DecoCtx,
} from '../types.js';

const D2R = Math.PI / 180;

// ---------------------------------------------------------------------------
// mkPent
// ---------------------------------------------------------------------------

/**
 * Pentagone trapézoïdal (façade) avec trou de porte optionnel et trou de perchoir.
 * Port fidèle de mkPent() dans src/geometry/panels.js.
 * Divergence : garde `door.type !== 'none'` omise (redondante vs type
 * `DoorInfo.type = Exclude<DoorType, 'none'>`).
 */
export function mkPent(
  Wtop: number,
  Wbot: number,
  wH: number,
  rH: number,
  T: number,
  door: DoorInfo | null,
  perch: PerchHoleInfo | null,
): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-Wbot / 2, 0);
  s.lineTo( Wbot / 2, 0);
  s.lineTo( Wtop / 2, wH);
  s.lineTo(0, wH + rH);
  s.lineTo(-Wtop / 2, wH);
  s.closePath();

  if (door) {
    const { type, w, h, cx, cy } = door;
    const hole = new THREE.Path();

    if (type === 'round') {
      hole.absellipse(cx, cy, w / 2, h / 2, 0, Math.PI * 2, true);
    } else if (type === 'square') {
      hole.moveTo(cx - w / 2, cy - h / 2);
      hole.lineTo(cx - w / 2, cy + h / 2);
      hole.lineTo(cx + w / 2, cy + h / 2);
      hole.lineTo(cx + w / 2, cy - h / 2);
      hole.closePath();
    } else if (type === 'pentagon') {
      const peakH = w * 0.35;
      const boxH = h - peakH;
      const slope = (door.followTaper && door.taperX !== undefined && door.wallH)
        ? door.taperX / door.wallH
        : 0;
      const yBot = cy - h / 2;
      const yShoulder = cy - h / 2 + boxH;
      const xL_bot      = cx - w / 2 + slope * (yBot      - cy);
      const xL_shoulder = cx - w / 2 + slope * (yShoulder - cy);
      const xR_bot      = cx + w / 2 - slope * (yBot      - cy);
      const xR_shoulder = cx + w / 2 - slope * (yShoulder - cy);
      hole.moveTo(xL_bot,      yBot);
      hole.lineTo(xR_bot,      yBot);
      hole.lineTo(xR_shoulder, yShoulder);
      hole.lineTo(cx,          cy + h / 2);
      hole.lineTo(xL_shoulder, yShoulder);
      hole.closePath();
    }
    s.holes.push(hole);
  }

  if (perch) {
    const ph = new THREE.Path();
    ph.absellipse(perch.cx, perch.cy, perch.diam / 2, perch.diam / 2, 0, Math.PI * 2, true);
    s.holes.push(ph);
  }

  return new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false });
}

// ---------------------------------------------------------------------------
// mkHexPanel
// ---------------------------------------------------------------------------

/**
 * Hexaèdre planaire pour murs latéraux avec évasement optionnel et coupe de toit.
 * Port 1:1 de mkHexPanel() dans src/geometry/panels.js (seules annotations TS ajoutées).
 */
export function mkHexPanel(
  v0: Vec3,
  v1: Vec3,
  v2: Vec3,
  v3: Vec3,
  outwardNormal: Vec3,
  T: number,
  roofPlane: RoofPlaneFn | null = null,
): THREE.BufferGeometry {
  const n = outwardNormal;

  // Sommets intérieurs du haut : Y corrigé par le plan du toit si fourni
  const tv2: Vec3 = roofPlane ? [v2[0], roofPlane(v2[0], v2[2]), v2[2]] : v2;
  const tv3: Vec3 = roofPlane ? [v3[0], roofPlane(v3[0], v3[2]), v3[2]] : v3;

  const off = (v: Vec3): Vec3 => [v[0] + n[0] * T, v[1] + n[1] * T, v[2] + n[2] * T];
  const o0 = off(v0), o1 = off(v1);

  // Sommets extérieurs du haut : X/Z décalés par la normale, Y projeté sur le plan du toit
  let o2: Vec3, o3: Vec3;
  if (roofPlane) {
    const r2 = off(tv2); o2 = [r2[0], roofPlane(r2[0], r2[2]), r2[2]];
    const r3 = off(tv3); o3 = [r3[0], roofPlane(r3[0], r3[2]), r3[2]];
  } else {
    o2 = off(tv2); o3 = off(tv3);
  }

  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  const tri = (a: Vec3, b: Vec3, c: Vec3) =>
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);

  tri(v0, tv2, v1);  tri(v0, tv3, tv2);  // face intérieure
  tri(o0, o1, o2);   tri(o0, o2, o3);    // face extérieure
  tri(v0, v1, o1);   tri(v0, o1, o0);    // bord bas
  tri(v1, tv2, o2);  tri(v1, o2, o1);    // bord arrière
  tri(tv2, tv3, o3); tri(tv2, o3, o2);   // bord haut
  tri(tv3, v0, o0);  tri(tv3, o0, o3);   // bord avant

  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// mkSidePanelWithDoor (P3 feature doorFace)
// ---------------------------------------------------------------------------

/**
 * Construit un panneau latéral PLAN avec trou de porte (et optionnel perchoir).
 * Alternative à `mkHexPanel` utilisée UNIQUEMENT quand `params.doorFace` cible
 * un mur latéral ('left' ou 'right'). `mkHexPanel` reste intacte pour le cas
 * sans porte (backward-compat strict des fixtures).
 *
 * Algorithme :
 *   1. Applique le roof-cut sur v2/v3 (comme mkHexPanel).
 *   2. Calcule un frame 2D local au mur : origine = v0 (bas-arrière), u-axis
 *      = (v1-v0) (bord bas), v-axis = perpendiculaire dans le plan du mur vers v3.
 *   3. Projette les 4 sommets en (u, v), construit un THREE.Shape quadrilateral.
 *   4. Ajoute un trou pour `door` (round/square/pentagon) + un trou pour `perch`
 *      si fourni, coordonnées locales calculées depuis `door.cx/cy` et
 *      `perch.cx/cy` qui restent dans le frame centré du mur (convention
 *      identique à mkPent) — translation +uLen/2 pour aligner sur notre frame
 *      origine-coin.
 *   5. Extrude sur T, applique la transformation matrice pour replacer en 3D.
 *
 * Limitation MVP : le taper dans l'axe du mur (hasTaper avec wall gauche/droite
 * non parallèle à X monde) fonctionne parce que la projection gère n'importe
 * quel plan, tant que les 4 sommets v0..tv3 sont coplanaires (ce qu'ils sont
 * par construction dans `buildPanelDefs`).
 */
export function mkSidePanelWithDoor(
  v0: Vec3,
  v1: Vec3,
  v2: Vec3,
  v3: Vec3,
  outwardNormal: Vec3,
  T: number,
  roofPlane: RoofPlaneFn | null,
  door: DoorInfo,
  perch: PerchHoleInfo | null,
): THREE.BufferGeometry {
  // Roof-cut sur v2, v3 (idem mkHexPanel)
  const tv2: Vec3 = roofPlane ? [v2[0], roofPlane(v2[0], v2[2]), v2[2]] : v2;
  const tv3: Vec3 = roofPlane ? [v3[0], roofPlane(v3[0], v3[2]), v3[2]] : v3;

  const V0 = new THREE.Vector3(v0[0], v0[1], v0[2]);
  const V1 = new THREE.Vector3(v1[0], v1[1], v1[2]);
  const V2 = new THREE.Vector3(tv2[0], tv2[1], tv2[2]);
  const V3 = new THREE.Vector3(tv3[0], tv3[1], tv3[2]);
  const nVec = new THREE.Vector3(outwardNormal[0], outwardNormal[1], outwardNormal[2]).normalize();

  // u-axis : le long du bord bas, de v0 vers v1
  const uAxis = V1.clone().sub(V0);
  const uLen = uAxis.length();
  uAxis.normalize();

  // v-axis : perpendiculaire dans le plan du mur, vers le haut (v3 direction)
  const vAxis = new THREE.Vector3().crossVectors(nVec, uAxis).normalize();
  const v03 = V3.clone().sub(V0);
  if (vAxis.dot(v03) < 0) vAxis.negate();

  // Projection (p - v0) dot (u_axis, v_axis)
  const project = (p: THREE.Vector3): [number, number] => {
    const rel = p.clone().sub(V0);
    return [rel.dot(uAxis), rel.dot(vAxis)];
  };

  const [u0, y0] = project(V0);
  const [u1, y1] = project(V1);
  const [u2, y2] = project(V2);
  const [u3, y3] = project(V3);

  // Outline CCW : v0 (bas-arrière) → v1 (bas-avant) → tv2 (haut-avant) → tv3 (haut-arrière)
  // Note: v2 est "avant" ou "arrière" selon la convention de l'appelant ; suit v1 côté haut.
  const shape = new THREE.Shape();
  shape.moveTo(u0, y0);
  shape.lineTo(u1, y1);
  shape.lineTo(u2, y2);
  shape.lineTo(u3, y3);
  shape.closePath();

  // Door hole. door.cx est en convention centrée (u=0 au milieu du mur) ;
  // notre frame a origin=v0 (coin), donc on translate de +uLen/2.
  const doorCu = uLen / 2 + door.cx;
  const doorCv = door.cy;
  const hole = new THREE.Path();
  if (door.type === 'round') {
    hole.absellipse(doorCu, doorCv, door.w / 2, door.h / 2, 0, Math.PI * 2, true);
  } else if (door.type === 'square') {
    hole.moveTo(doorCu - door.w / 2, doorCv - door.h / 2);
    hole.lineTo(doorCu - door.w / 2, doorCv + door.h / 2);
    hole.lineTo(doorCu + door.w / 2, doorCv + door.h / 2);
    hole.lineTo(doorCu + door.w / 2, doorCv - door.h / 2);
    hole.closePath();
  } else if (door.type === 'pentagon') {
    const peakH = door.w * 0.35;
    const boxH = door.h - peakH;
    const slope = (door.followTaper && door.taperX !== undefined && door.wallH)
      ? door.taperX / door.wallH
      : 0;
    const cx = doorCu, cy = doorCv, w = door.w, h = door.h;
    const yBot = cy - h / 2;
    const yShoulder = cy - h / 2 + boxH;
    const xL_bot      = cx - w / 2 + slope * (yBot      - cy);
    const xL_shoulder = cx - w / 2 + slope * (yShoulder - cy);
    const xR_bot      = cx + w / 2 - slope * (yBot      - cy);
    const xR_shoulder = cx + w / 2 - slope * (yShoulder - cy);
    hole.moveTo(xL_bot,      yBot);
    hole.lineTo(xR_bot,      yBot);
    hole.lineTo(xR_shoulder, yShoulder);
    hole.lineTo(cx,          cy + h / 2);
    hole.lineTo(xL_shoulder, yShoulder);
    hole.closePath();
  }
  shape.holes.push(hole);

  if (perch) {
    const perchCu = uLen / 2 + perch.cx;
    const perchCv = perch.cy;
    const ph = new THREE.Path();
    ph.absellipse(perchCu, perchCv, perch.diam / 2, perch.diam / 2, 0, Math.PI * 2, true);
    shape.holes.push(ph);
  }

  // Extrude le long de +Z (convention THREE), puis transformer pour aligner
  // (u, v, +Z) → (uAxis, vAxis, nVec) avec origine en V0.
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
  const matrix = new THREE.Matrix4().makeBasis(uAxis, vAxis, nVec).setPosition(V0);
  geo.applyMatrix4(matrix);
  return geo;
}

// ---------------------------------------------------------------------------
// buildRoofPanelWithHoles
// ---------------------------------------------------------------------------

/**
 * Construit la géométrie d'un panneau de toit avec 4 trous de suspension
 * via THREE.Shape + Path (trous) + ExtrudeGeometry. Pattern identique à
 * `mkSidePanelWithDoor` — garantit watertight par construction.
 *
 * Shape : rectangle top-view du panneau dans son plan local, incluant la
 * couverture ridge (+T pour left/right). Le chanfrein miter n'est PAS
 * représenté (tradeoff documenté : pour hang=true + ridge=miter, le chanfrein
 * est perdu, les panneaux se touchent à x=0 sans bev overhang).
 *
 * Holes : 2 cercles (front + back) par panneau, Paths dans la Shape.
 *
 * Extrude : depth=T perpendiculaire au plan du panneau.
 *
 * @param isL true pour roofL, false pour roofR
 * @param sL longueur de pente (mm)
 * @param rL longueur selon D (mm)
 * @param T épaisseur (mm)
 * @param hangPosY distance depuis chaque bord de gable (mm)
 * @param hangOffsetX distance depuis ridge (x=0) le long de la pente (mm)
 * @param hangDiam diamètre trou (mm)
 * @param ridge type de jonction ('left'|'right'|'miter')
 */
function buildRoofPanelWithHoles(
  isL: boolean,
  sL: number,
  rL: number,
  T: number,
  hangPosY: number,
  hangOffsetX: number,
  hangDiam: number,
  ridge: RidgeType,
): THREE.BufferGeometry {
  // xStart / xEnd : extrémités du panneau le long de la pente (axe X local).
  // Couverture ridge via +T pour left/right. Miter : simple limite à x=0 (chanfrein perdu).
  let xStart: number, xEnd: number;
  if (isL) {
    xStart = -sL;
    if (ridge === 'left') xEnd = T;       // couverture ridge
    else xEnd = 0;                         // miter ou right : fin à x=0
  } else {
    xEnd = sL;
    if (ridge === 'right') xStart = -T;   // couverture ridge
    else xStart = 0;                       // miter ou left : début à x=0
  }

  // Shape top-view : rectangle dans le plan (X, Z) local du panneau.
  // Convention : après rotateX(-π/2), shape.Y → -Z_world.
  // shape.y négatif (-rL/2) → world.Z positif (+rL/2, front).
  // shape.y positif (+rL/2) → world.Z négatif (-rL/2, back).
  const shape = new THREE.Shape();
  shape.moveTo(xStart, -rL / 2);
  shape.lineTo(xEnd, -rL / 2);
  shape.lineTo(xEnd, +rL / 2);
  shape.lineTo(xStart, +rL / 2);
  shape.closePath();

  // 2 trous par panneau. hangOffsetX mesuré DEPUIS LE RIDGE (x=0).
  //   - roofL (isL=true) : ridge à x=0, eave à x=-sL → trou à x = -hangOffsetX (négatif).
  //   - roofR (isL=false) : ridge à x=0, eave à x=+sL → trou à x = +hangOffsetX.
  const holeX = isL ? -hangOffsetX : +hangOffsetX;
  const holeR = hangDiam / 2;
  const zFront = rL / 2 - hangPosY;
  const zBack = -rL / 2 + hangPosY;

  for (const z of [zFront, zBack]) {
    const path = new THREE.Path();
    path.absellipse(holeX, z, holeR, holeR, 0, Math.PI * 2, true);
    shape.holes.push(path);
  }

  // ExtrudeGeometry : Shape placée dans le plan XY, extrusion le long de +Z de la Shape.
  // Avec depth=T, on obtient un solide d'épaisseur T.
  // rotateX(-π/2) : shape.XY → world.XZ et +Z_shape → +Y_world (épaisseur 0→T en Y).
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// ---------------------------------------------------------------------------
// buildMiterChamferStrip
// ---------------------------------------------------------------------------

/**
 * Construit le prisme triangulaire du chanfrein miter à placer au bord
 * du ridge. Cross-section = petit triangle à angle droit (legs T et bev),
 * extrudé le long de Z pour rL. Watertight par construction.
 *
 * Ne contient pas de trous — les trous sont dans le corps principal.
 */
function buildMiterChamferStrip(
  isL: boolean,
  bev: number,
  T: number,
  rL: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  if (isL) {
    // roofL : triangle (0, 0) → (0, T) → (bev, T) → close
    shape.moveTo(0, 0);
    shape.lineTo(0, T);
    shape.lineTo(bev, T);
    shape.closePath();
  } else {
    // roofR : triangle (0, 0) → (-bev, T) → (0, T) → close (miroir)
    shape.moveTo(0, 0);
    shape.lineTo(-bev, T);
    shape.lineTo(0, T);
    shape.closePath();
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: rL, bevelEnabled: false });
  geo.translate(0, 0, -rL / 2);
  return geo;
}

// ---------------------------------------------------------------------------
// concatGeometries
// ---------------------------------------------------------------------------

/**
 * Fusionne les positions de N BufferGeometry non-indexées en une seule.
 * Pas de partage de vertices, pas de CSG — simple concaténation de triangles.
 * Le résultat n'est pas un 2-manifold unique au sens strict (les pièces peuvent
 * se chevaucher à une face partagée), mais l'export STL du projet est déjà
 * une concaténation, donc cohérent avec l'architecture existante.
 */
function concatGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const geo of geos) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.computeVertexNormals();
    const pos = g.getAttribute('position');
    const nrm = g.getAttribute('normal');
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    }
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return result;
}

// ---------------------------------------------------------------------------
// buildPanelDefs
// ---------------------------------------------------------------------------

/**
 * Construit la liste des définitions de panneaux à partir de l'état.
 * Port fidèle de buildPanelDefs() dans src/geometry/panels.js.
 * Divergences (déjà documentées dans le header du fichier) :
 *   - Conversion mécanique tuples → PanelDef (objets).
 *   - Branching explicite vector/heightmap au lieu d'un appel unifié buildDecoGeo.
 *   - Check emptiness post-deco (position.count === 0) pour ne pas pousser un def vide.
 */
export function buildPanelDefs(state: NichoirState): BuildResult {
  const { params, clip, decos } = state;
  const { W, H, D, slope, overhang, T, explode, floor, ridge, taperX } = params;

  // Palette lookup — convert the current palette's string hexes to numbers
  const pal = PALETTES[params.palette];
  const COL_ACTIVE = {
    front:     hexToNumber(pal.facade),
    back:      hexToNumber(pal.facade),
    left:      hexToNumber(pal.side),
    right:     hexToNumber(pal.side),
    bottom:    hexToNumber(pal.bottom),
    roofL:     hexToNumber(pal.roof),
    roofR:     hexToNumber(pal.roof),
    doorPanel: hexToNumber(pal.door),
  };

  const ang = slope * D2R;
  const eDist = (explode / 100) * Math.max(W, H, D) * 0.65;
  const isPose = floor === 'pose';

  const wallH = isPose ? H - T : H;
  const baseY = isPose ? T : 0;
  const rH = (W / 2) * Math.tan(ang);
  const peakY = baseY + wallH + rH;

  const Wtop = W;
  const Wbot = W + 2 * taperX;
  const hasTaper = taperX !== 0;
  const alpha = hasTaper ? Math.atan(taperX / wallH) : 0;
  const wallHreal = Math.sqrt(wallH * wallH + taperX * taperX);

  const floorW = isPose ? Wbot : Wbot - 2 * T;
  const floorD = isPose ? D : D - 2 * T;
  const sideD = D - 2 * T;

  const sL = (W / 2 + overhang) / Math.cos(ang);
  const rL = D + 2 * overhang;

  // Plan de la face inférieure du toit : Y = peakY + x·tan(ang)
  const tang = Math.tan(ang);
  const roofPlaneL: RoofPlaneFn = (x, _z) => peakY + x * tang;
  const roofPlaneR: RoofPlaneFn = (x, _z) => peakY - x * tang;

  // Plans de clipping actifs
  const activeClips: Array<'x' | 'y' | 'z'> = [];
  const clipPlanesOut: Partial<Record<'x' | 'y' | 'z', { constant: number }>> = {};
  if (clip.x.on) {
    clipPlanesOut.x = { constant: -Wbot / 2 - overhang + clip.x.pos * (Wbot + overhang * 2) };
    activeClips.push('x');
  }
  if (clip.y.on) {
    clipPlanesOut.y = { constant: clip.y.pos * (peakY + 20) };
    activeClips.push('y');
  }
  if (clip.z.on) {
    clipPlanesOut.z = { constant: -D / 2 - overhang + clip.z.pos * (D + overhang * 2) };
    activeClips.push('z');
  }

  const defs: PanelDef[] = [];

  // Porte : routing selon doorFace. Les coords locales (cx, cy) sont dans le
  // FRAME CENTRÉ du mur concerné — front utilise la largeur tapered du mur
  // avant à doorPY, les côtés utilisent sideD (constant).
  const doorY = params.doorPY / 100 * wallH;

  // Front frame
  const doorWlocalFront = Wbot - 2 * taperX * (params.doorPY / 100);
  const doorCxFront = -doorWlocalFront / 2 + params.doorPX / 100 * doorWlocalFront;

  // Side frame (u-axis = Z-axis in world = sideD)
  const doorCxSide = -sideD / 2 + params.doorPX / 100 * sideD;

  const perchY = doorY - params.doorH / 2 - params.perchOff;
  const perchYfrac = Math.max(0, Math.min(1, perchY / wallH));
  const perchWlocalFront = Wbot - 2 * taperX * perchYfrac;
  const perchCxFront = -perchWlocalFront / 2 + params.doorPX / 100 * perchWlocalFront;
  const perchCxSide = -sideD / 2 + params.doorPX / 100 * sideD;

  const hasDoor = params.door !== 'none';
  const isDoorFront = hasDoor && params.doorFace === 'front';
  const isDoorLeft  = hasDoor && params.doorFace === 'left';
  const isDoorRight = hasDoor && params.doorFace === 'right';

  const doorType = hasDoor ? (params.door as Exclude<typeof params.door, 'none'>) : null;

  // DoorInfo pour le front (convention historique : followTaper/taperX actifs)
  const doorInfoFront: DoorInfo | null = (isDoorFront && doorType) ? {
    type: doorType,
    w: params.doorW, h: params.doorH,
    cx: doorCxFront, cy: doorY,
    followTaper: params.doorFollowTaper, taperX, wallH,
  } : null;

  // DoorInfo pour les côtés : followTaper=false (le taper X n'est pas
  // significatif sur l'axe u du mur latéral = Z monde).
  const doorInfoSide: DoorInfo | null = ((isDoorLeft || isDoorRight) && doorType) ? {
    type: doorType,
    w: params.doorW, h: params.doorH,
    cx: doorCxSide, cy: doorY,
    followTaper: false, taperX: 0, wallH,
  } : null;

  const perchActive = params.perch && hasDoor;
  const perchHoleFront: PerchHoleInfo | null = (perchActive && isDoorFront)
    ? { cx: perchCxFront, cy: perchY, diam: params.perchDiam } : null;
  const perchHoleSide: PerchHoleInfo | null = (perchActive && (isDoorLeft || isDoorRight))
    ? { cx: perchCxSide, cy: perchY, diam: params.perchDiam } : null;

  // Façades avant + arrière. Le front porte la porte uniquement si doorFace='front'.
  defs.push({
    key: 'front',
    geometry: mkPent(Wtop, Wbot, wallH, rH, T, doorInfoFront, perchHoleFront),
    basePos: [0, baseY, D / 2 - T],
    baseRot: [0, 0, 0],
    color: COL_ACTIVE.front,
    explodeDir: [0, 0, 1],
  });
  defs.push({
    key: 'back',
    geometry: mkPent(Wtop, Wbot, wallH, rH, T, null, null),
    basePos: [0, baseY, -D / 2],
    baseRot: [0, 0, 0],
    color: COL_ACTIVE.back,
    explodeDir: [0, 0, -1],
  });

  // Murs latéraux
  let leftAnchorPos: Vec3 = [0, 0, 0];
  let leftAnchorRot: Vec3 = [0, 0, 0];
  let rightAnchorPos: Vec3 = [0, 0, 0];
  let rightAnchorRot: Vec3 = [0, 0, 0];

  if (!hasTaper) {
    // Mur gauche : sommets intérieurs en espace monde, face haut taillée selon roofPlaneL
    const Lv0: Vec3 = [-(W / 2 - T), baseY, +(D / 2 - T)];
    const Lv1: Vec3 = [-(W / 2 - T), baseY, -(D / 2 - T)];
    const Lv2: Vec3 = [-(W / 2 - T), baseY + wallH, -(D / 2 - T)];
    const Lv3: Vec3 = [-(W / 2 - T), baseY + wallH, +(D / 2 - T)];
    const leftNormal: Vec3 = [-1, 0, 0];
    // Pour mkSidePanelWithDoor : réorder v0→v1 pour que u-axis pointe vers +Z
    // monde (doorPX=100 = porte vers l'avant de la maison, convention user-visible).
    const leftGeo = (isDoorLeft && doorInfoSide)
      ? mkSidePanelWithDoor(Lv1, Lv0, Lv3, Lv2, leftNormal, T, roofPlaneL, doorInfoSide, perchHoleSide)
      : mkHexPanel(Lv0, Lv1, Lv2, Lv3, leftNormal, T, roofPlaneL);
    defs.push({ key: 'left', geometry: leftGeo, basePos: [0, 0, 0], baseRot: [0, 0, 0], color: COL_ACTIVE.left, explodeDir: leftNormal });
    leftAnchorPos  = [-W / 2 + T / 2, baseY + wallH / 2, 0];
    leftAnchorRot  = [0, 0, 0];

    // Mur droit (symétrique)
    const Rv0: Vec3 = [+(W / 2 - T), baseY, -(D / 2 - T)];
    const Rv1: Vec3 = [+(W / 2 - T), baseY, +(D / 2 - T)];
    const Rv2: Vec3 = [+(W / 2 - T), baseY + wallH, +(D / 2 - T)];
    const Rv3: Vec3 = [+(W / 2 - T), baseY + wallH, -(D / 2 - T)];
    const rightNormal: Vec3 = [+1, 0, 0];
    const rightGeo = (isDoorRight && doorInfoSide)
      ? mkSidePanelWithDoor(Rv0, Rv1, Rv2, Rv3, rightNormal, T, roofPlaneR, doorInfoSide, perchHoleSide)
      : mkHexPanel(Rv0, Rv1, Rv2, Rv3, rightNormal, T, roofPlaneR);
    defs.push({ key: 'right', geometry: rightGeo, basePos: [0, 0, 0], baseRot: [0, 0, 0], color: COL_ACTIVE.right, explodeDir: rightNormal });
    rightAnchorPos = [+W / 2 - T / 2, baseY + wallH / 2, 0];
    rightAnchorRot = [0, 0, 0];
  } else {
    const Lv0: Vec3 = [-(Wbot / 2 - T), baseY,        +(D / 2 - T)];
    const Lv1: Vec3 = [-(Wbot / 2 - T), baseY,        -(D / 2 - T)];
    const Lv2: Vec3 = [-(Wtop / 2 - T), baseY + wallH, -(D / 2 - T)];
    const Lv3: Vec3 = [-(Wtop / 2 - T), baseY + wallH, +(D / 2 - T)];
    const Ln: Vec3 = [-Math.cos(alpha), Math.sin(alpha), 0];
    const leftGeo = (isDoorLeft && doorInfoSide)
      ? mkSidePanelWithDoor(Lv1, Lv0, Lv3, Lv2, Ln, T, roofPlaneL, doorInfoSide, perchHoleSide)
      : mkHexPanel(Lv0, Lv1, Lv2, Lv3, Ln, T, roofPlaneL);
    defs.push({ key: 'left', geometry: leftGeo, basePos: [0, 0, 0], baseRot: [0, 0, 0], color: COL_ACTIVE.left, explodeDir: [-Math.cos(alpha), Math.sin(alpha), 0] });

    const innerCenterL: Vec3 = [(Lv0[0] + Lv2[0]) / 2, (Lv0[1] + Lv2[1]) / 2, 0];
    leftAnchorPos = [innerCenterL[0] + T / 2 * Ln[0], innerCenterL[1] + T / 2 * Ln[1], 0];
    leftAnchorRot = [0, 0, -alpha];

    const Rv0: Vec3 = [ (Wbot / 2 - T), baseY,        -(D / 2 - T)];
    const Rv1: Vec3 = [ (Wbot / 2 - T), baseY,        +(D / 2 - T)];
    const Rv2: Vec3 = [ (Wtop / 2 - T), baseY + wallH, +(D / 2 - T)];
    const Rv3: Vec3 = [ (Wtop / 2 - T), baseY + wallH, -(D / 2 - T)];
    const Rn: Vec3 = [ Math.cos(alpha), Math.sin(alpha), 0];
    const rightGeo = (isDoorRight && doorInfoSide)
      ? mkSidePanelWithDoor(Rv0, Rv1, Rv2, Rv3, Rn, T, roofPlaneR, doorInfoSide, perchHoleSide)
      : mkHexPanel(Rv0, Rv1, Rv2, Rv3, Rn, T, roofPlaneR);
    defs.push({ key: 'right', geometry: rightGeo, basePos: [0, 0, 0], baseRot: [0, 0, 0], color: COL_ACTIVE.right, explodeDir: [Math.cos(alpha), Math.sin(alpha), 0] });

    const innerCenterR: Vec3 = [(Rv0[0] + Rv2[0]) / 2, (Rv0[1] + Rv2[1]) / 2, 0];
    rightAnchorPos = [innerCenterR[0] + T / 2 * Rn[0], innerCenterR[1] + T / 2 * Rn[1], 0];
    rightAnchorRot = [0, 0, alpha];
  }

  // Plancher
  defs.push({
    key: 'bottom',
    geometry: new THREE.BoxGeometry(floorW, T, floorD),
    basePos: [0, T / 2, 0],
    baseRot: [0, 0, 0],
    color: COL_ACTIVE.bottom,
    explodeDir: [0, -1, 0],
  });

  // Toit
  const bev = T * Math.tan(ang);

  // Construction des panneaux de toit.
  let rlG: THREE.BufferGeometry;
  let rrG: THREE.BufferGeometry;

  if (params.hang) {
    // Pattern Shape+holes+Extrude (watertight) pour le corps principal.
    rlG = buildRoofPanelWithHoles(true,  sL, rL, T, params.hangPosY, params.hangOffsetX, params.hangDiam, ridge);
    rrG = buildRoofPanelWithHoles(false, sL, rL, T, params.hangPosY, params.hangOffsetX, params.hangDiam, ridge);
    // Quand ridge=miter + hang, le corps principal est rectangulaire (chanfrein perdu).
    // On ajoute la bandelette chanfrein triangulaire séparément puis on concatène.
    if (ridge === 'miter') {
      const chamferL = buildMiterChamferStrip(true,  bev, T, rL);
      const chamferR = buildMiterChamferStrip(false, bev, T, rL);
      rlG = concatGeometries([rlG, chamferL]);
      rrG = concatGeometries([rrG, chamferR]);
    }
  } else if (ridge === 'miter') {
    // Miter parallélogramme avec chanfrein bev — code original préservé
    const shL = new THREE.Shape();
    shL.moveTo(0, 0); shL.lineTo(-sL, 0); shL.lineTo(-sL, T); shL.lineTo(bev, T); shL.closePath();
    rlG = new THREE.ExtrudeGeometry(shL, { depth: rL, bevelEnabled: false });
    rlG.translate(0, 0, -rL / 2);

    const shR = new THREE.Shape();
    shR.moveTo(0, 0); shR.lineTo(sL, 0); shR.lineTo(sL, T); shR.lineTo(-bev, T); shR.closePath();
    rrG = new THREE.ExtrudeGeometry(shR, { depth: rL, bevelEnabled: false });
    rrG.translate(0, 0, -rL / 2);
  } else {
    // Left ou Right — BoxGeometry avec +T coverage, code original préservé
    const sL_L = ridge === 'left' ? sL + T : sL;
    const sL_R = ridge === 'right' ? sL + T : sL;

    rlG = new THREE.BoxGeometry(sL_L, T, rL);
    if (ridge === 'left') rlG.translate((-sL + T) / 2, T / 2, 0);
    else                  rlG.translate(-sL / 2, T / 2, 0);

    rrG = new THREE.BoxGeometry(sL_R, T, rL);
    if (ridge === 'right') rrG.translate((sL - T) / 2, T / 2, 0);
    else                   rrG.translate(sL / 2, T / 2, 0);
  }

  defs.push({
    key: 'roofL', geometry: rlG,
    basePos: [0, peakY, 0], baseRot: [0, 0, ang],
    color: COL_ACTIVE.roofL, explodeDir: [-Math.sin(ang) * 0.7, Math.cos(ang) * 0.7, 0],
  });
  defs.push({
    key: 'roofR', geometry: rrG,
    basePos: [0, peakY, 0], baseRot: [0, 0, -ang],
    color: COL_ACTIVE.roofR, explodeDir: [Math.sin(ang) * 0.7, Math.cos(ang) * 0.7, 0],
  });

  // Panneau de porte (pièce physique séparée). La géométrie est construite en
  // coords locales (u, v) centrées sur dcx (selon la face porteuse), puis
  // basePos + baseRot placent la pièce sur le bon mur en monde.
  // Conventions de signe (dérivées de l'orientation du u-axis dans
  // mkSidePanelWithDoor et du roll autour de Y pour placer le mur en monde) :
  //   - front : dcx = +doorCxFront (u-axis = +X world direct)
  //   - left  : dcx = +doorCxSide  (u-axis = +Z world ; rotation Y = -π/2 préserve le signe)
  //   - right : dcx = -doorCxSide  (u-axis = +Z world inside mkSidePanelWithDoor,
  //                                 mais rotation Y = +π/2 mappe +X local → -Z world,
  //                                 d'où la négation pour que la pièce tombe au même
  //                                 endroit que le trou sur le mur droit)
  if (params.door !== 'none' && params.doorPanel) {
    const v = params.doorVar / 100;
    const dw = params.doorW * v, dh = params.doorH * v;
    let dcx: number;
    if (isDoorFront) dcx = doorCxFront;
    else if (isDoorLeft) dcx = doorCxSide;
    else dcx = -doorCxSide; // right
    const dcy = baseY + params.doorPY / 100 * wallH;
    let dpGeo: THREE.BufferGeometry | undefined;

    if (params.door === 'round') {
      const ds = new THREE.Shape();
      ds.absellipse(0, 0, dw / 2, dh / 2, 0, Math.PI * 2, false);
      dpGeo = new THREE.ExtrudeGeometry(ds, { depth: T, bevelEnabled: false });
      dpGeo.translate(dcx, dcy, 0);
    } else if (params.door === 'square') {
      dpGeo = new THREE.BoxGeometry(dw, dh, T);
      dpGeo.translate(dcx, dcy, T / 2);
    } else if (params.door === 'pentagon') {
      const pk = dw * 0.35, bx = dh - pk;
      const slope2 = (params.doorFollowTaper && wallH) ? taperX / wallH : 0;
      const yBot = -dh / 2;
      const yShoulder = -dh / 2 + bx;
      const xL_bot      = -dw / 2 + slope2 * yBot;
      const xL_shoulder = -dw / 2 + slope2 * yShoulder;
      const xR_bot      =  dw / 2 - slope2 * yBot;
      const xR_shoulder =  dw / 2 - slope2 * yShoulder;
      const ds = new THREE.Shape();
      ds.moveTo(xL_bot,      yBot);
      ds.lineTo(xR_bot,      yBot);
      ds.lineTo(xR_shoulder, yShoulder);
      ds.lineTo(0,           dh / 2);
      ds.lineTo(xL_shoulder, yShoulder);
      ds.closePath();
      dpGeo = new THREE.ExtrudeGeometry(ds, { depth: T, bevelEnabled: false });
      dpGeo.translate(dcx, dcy, 0);
    }

    if (dpGeo) {
      let dpBasePos: Vec3;
      let dpBaseRot: Vec3;
      let dpExplodeDir: Vec3;
      if (isDoorFront) {
        dpBasePos = [0, 0, D / 2 - T];
        dpBaseRot = [0, 0, 0];
        dpExplodeDir = [0, 0, 2.5];
      } else if (isDoorLeft) {
        dpBasePos = [-(W / 2 - T), 0, 0];
        dpBaseRot = [0, -Math.PI / 2, 0];
        dpExplodeDir = [-2.5, 0, 0];
      } else { // right
        dpBasePos = [+(W / 2 - T), 0, 0];
        dpBaseRot = [0, +Math.PI / 2, 0];
        dpExplodeDir = [+2.5, 0, 0];
      }
      defs.push({
        key: 'doorPanel',
        geometry: dpGeo,
        basePos: dpBasePos,
        baseRot: dpBaseRot,
        color: COL_ACTIVE.doorPanel,
        explodeDir: dpExplodeDir,
      });
    }
  }

  // Perchoir (cylindre). Sort perpendiculairement au mur porteur.
  if (params.perch && params.door !== 'none') {
    const pGeo = new THREE.CylinderGeometry(params.perchDiam / 2, params.perchDiam / 2, params.perchLen, 16);
    if (isDoorFront) {
      pGeo.rotateX(Math.PI / 2);
      pGeo.translate(perchCxFront, baseY + perchY, params.perchLen / 2);
      defs.push({
        key: 'perch', geometry: pGeo,
        basePos: [0, 0, D / 2], baseRot: [0, 0, 0],
        color: 0x8b6e4e, explodeDir: [0, 0, 2.0],
      });
    } else if (isDoorLeft) {
      // Cylindre orienté par défaut sur Y → rotation Z de +π/2 amène le sommet (+Y)
      // vers -X ; on place le centre à (-perchLen/2) relatif au plan extérieur
      // du mur gauche, z = perchCxSide (convention doorPX=100 → avant).
      pGeo.rotateZ(Math.PI / 2);
      pGeo.translate(-params.perchLen / 2, baseY + perchY, perchCxSide);
      defs.push({
        key: 'perch', geometry: pGeo,
        basePos: [-W / 2, 0, 0], baseRot: [0, 0, 0],
        color: 0x8b6e4e, explodeDir: [-2.0, 0, 0],
      });
    } else { // right
      pGeo.rotateZ(-Math.PI / 2);
      pGeo.translate(params.perchLen / 2, baseY + perchY, perchCxSide);
      defs.push({
        key: 'perch', geometry: pGeo,
        basePos: [W / 2, 0, 0], baseRot: [0, 0, 0],
        color: 0x8b6e4e, explodeDir: [2.0, 0, 0],
      });
    }
  }

  // Décorations
  const _sL_L = (ridge === 'miter') ? sL : (ridge === 'left' ? sL + T : sL);
  const _sL_R = (ridge === 'miter') ? sL : (ridge === 'right' ? sL + T : sL);
  const decoCtx: DecoCtx = {
    W, Wtop, Wbot, wallH, wallHreal, rH, sideD, T, sL, sL_L: _sL_L, sL_R: _sL_R, rL, bev, ridge, taperX, alpha,
  };

  const decoAnchors: Record<string, { pos: Vec3; rot: Vec3; eDir: Vec3 }> = {};
  DECO_KEYS.forEach(pk => {
    const parent = defs.find(e => e.key === pk);
    if (!parent) return;
    if (hasTaper && pk === 'left')       decoAnchors[pk] = { pos: leftAnchorPos,  rot: leftAnchorRot,  eDir: parent.explodeDir };
    else if (hasTaper && pk === 'right') decoAnchors[pk] = { pos: rightAnchorPos, rot: rightAnchorRot, eDir: parent.explodeDir };
    else                                  decoAnchors[pk] = { pos: parent.basePos, rot: parent.baseRot, eDir: parent.explodeDir };
  });

  DECO_KEYS.forEach(pk => {
    const d = decos[pk];
    if (!d.enabled || !d.source) return;
    const anchor = decoAnchors[pk];
    if (!anchor) return;

    // Branchement sur d.mode (à la place de buildDecoGeo(d) du src).
    // Les fonctions du contrat retournent BufferGeometry (non-nullable) mais
    // peuvent retourner une BufferGeometry VIDE si les inputs sont dégénérés
    // (bbox plat, shapes vides). On check l'emptiness explicitement pour ne pas
    // pousser un def deco vide dans `defs` (src retournait null → skip ; on reproduit
    // ce skip en vérifiant position.count).
    let dGeo: THREE.BufferGeometry | null = null;
    if (d.mode === 'vector' && d.parsedShapes && d.parsedShapes.length && d.bbox) {
      dGeo = buildDecoGeoVector(d.parsedShapes, d.bbox, d.w, d.h, d.depth, d.bevel);
    } else if (d.mode === 'heightmap' && d.heightmapData) {
      try {
        dGeo = buildDecoGeoHeightmap(d.heightmapData, d.heightmapResolution, d.w, d.h, d.depth, d.invert);
      } catch (_e) {
        dGeo = null;
      }
    }
    if (!dGeo) return;
    const dGeoPos = dGeo.getAttribute('position');
    if (!dGeoPos || dGeoPos.count === 0) return;

    const placeCtx: DecoCtx = Object.assign({}, decoCtx);
    if (hasTaper && (pk === 'left' || pk === 'right')) {
      placeCtx.wallH = wallHreal;
    }
    placeDecoOnPanel(dGeo, pk, d, placeCtx);
    const extraClips = d.clipToPanel ? buildPanelClipPlanes(pk, placeCtx, anchor.pos, anchor.rot) : null;
    defs.push({
      key: `deco_${pk}` as PanelDefKey,
      geometry: dGeo,
      basePos: anchor.pos,
      baseRot: anchor.rot,
      color: 0xe8a955,
      explodeDir: anchor.eDir,
      extraClips,
    });
  });

  return {
    defs,
    explodeDistance: eDist,
    activeClips,
    clipPlanesOut,
    derived: { wallH, rH, sL, rL, bev, Wtop, Wbot, wallHreal, floorW, floorD, sideD, hasTaper, ang, peakY },
  };
}
