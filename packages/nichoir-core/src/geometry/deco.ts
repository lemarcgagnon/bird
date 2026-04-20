// src/geometry/deco.ts
// Construction 3D de la décoration, placement sur un panneau donné, et plans de clipping associés.
// Port fidèle de src/geometry/deco.js. Divergences assumées :
//   1. parseSVG et rasterizeToCanvas exclus (DOM-bound → nichoir-ui).
//   2. buildDecoGeo scindé en buildDecoGeoVector + buildDecoGeoHeightmap.
//   3. Signatures acceptent ParsedShape[]/Uint8ClampedArray au lieu de THREE.Shape[]/HTMLCanvasElement.
//   4. Retour BufferGeometry vide au lieu de null sur cas dégénérés
//      (caller vérifie position.count si besoin de skip).
//   5. buildDecoGeoHeightmap throw TypeError si heightmapResolution ∉ [16,128]
//      (correction d'une corruption silencieuse latente dans src).

import * as THREE from 'three';
import type { ParsedShape, BBox, DecoCtx } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Inverse l'ordre des sommets des triangles (après un scale négatif) pour
 * que les normales repointent vers l'extérieur.
 */
function flipGeoWinding(geo: THREE.BufferGeometry): void {
  const idx = geo.getIndex();
  if (idx) {
    const arr = idx.array as unknown as number[];
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1] as number; arr[i + 1] = arr[i + 2] as number; arr[i + 2] = tmp;
    }
    idx.needsUpdate = true;
  } else {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as unknown as number[];
    const tmp = [0, 0, 0];
    for (let i = 0; i < arr.length; i += 9) {
      tmp[0] = arr[i + 3] as number; tmp[1] = arr[i + 4] as number; tmp[2] = arr[i + 5] as number;
      arr[i + 3] = arr[i + 6] as number; arr[i + 4] = arr[i + 7] as number; arr[i + 5] = arr[i + 8] as number;
      arr[i + 6] = tmp[0]; arr[i + 7] = tmp[1]; arr[i + 8] = tmp[2];
    }
    pos.needsUpdate = true;
  }
  geo.computeVertexNormals();
}

// ---------------------------------------------------------------------------
// buildDecoGeoVector
// ---------------------------------------------------------------------------

/**
 * Construit la géométrie 3D d'une déco vectorielle dans son repère local.
 * `shapes` : contours pré-discrétisés (ParsedShape[] = Pt2[][]).
 * Port fidèle de la branche `mode === 'vector'` de src buildDecoGeo().
 * Divergence : retourne `new BufferGeometry()` vide (pas null) sur cas dégénérés.
 */
export function buildDecoGeoVector(
  shapes: ParsedShape[],
  bbox: BBox,
  w: number,
  h: number,
  depth: number,
  bevel: number,
): THREE.BufferGeometry {
  const bb = bbox;
  const bw = bb.maxX - bb.minX, bh = bb.maxY - bb.minY;
  if (bw <= 0 || bh <= 0) {
    return new THREE.BufferGeometry();
  }
  const sx = w / bw, sy = h / bh;

  const bevelPct = Math.max(0, Math.min(100, bevel)) / 100;
  const bevelThickness = depth * 0.3 * bevelPct;
  const bevelSize = Math.min(w, h) * 0.02 * bevelPct;

  const remap = (shape: ParsedShape): THREE.Shape | null => {
    const out = new THREE.Shape();
    const pts = shape;
    if (!pts.length) return null;
    const mx = (x: number) => (x - bb.minX) * sx - w / 2;
    const my = (y: number) => h / 2 - (y - bb.minY) * sy;
    out.moveTo(mx(pts[0]!.x), my(pts[0]!.y));
    for (let i = 1; i < pts.length; i++) out.lineTo(mx(pts[i]!.x), my(pts[i]!.y));
    out.closePath();
    return out;
  };

  const remapped = shapes.map(remap).filter((s): s is THREE.Shape => s !== null);
  if (!remapped.length) return new THREE.BufferGeometry();

  const opts: THREE.ExtrudeGeometryOptions = {
    depth,
    bevelEnabled: bevelPct > 0 && bevelThickness > 0.01,
    bevelThickness, bevelSize,
    bevelSegments: 2, curveSegments: 8,
  };
  return new THREE.ExtrudeGeometry(remapped, opts);
}

// ---------------------------------------------------------------------------
// buildDecoGeoHeightmap
// ---------------------------------------------------------------------------

/**
 * Construit la géométrie 3D d'une déco heightmap dans son repère local.
 * `heightmapData` : RGBA flat array de taille `heightmapResolution² × 4`.
 * Port fidèle de la branche heightmap de src buildDecoGeo().
 * Divergences : l'étape "obtenir les pixels via canvas" est remplacée par
 * l'injection directe de `heightmapData` ; le clamp silencieux `[16,128]` de src
 * devient un throw TypeError (fail-fast sur input invalide).
 *
 * Throws TypeError si :
 *   - `heightmapResolution` n'est pas un entier dans `[16, 128]`
 *     (borne = clamp historique de `src/geometry/deco.js:144`, pas le slider UI
 *     qui est `min=32 max=128`)
 *   - `heightmapData.length !== heightmapResolution² × 4`
 */
export function buildDecoGeoHeightmap(
  heightmapData: Uint8ClampedArray,
  heightmapResolution: number,
  w: number,
  h: number,
  depth: number,
  invert: boolean,
): THREE.BufferGeometry {
  if (!Number.isInteger(heightmapResolution) || heightmapResolution < 16 || heightmapResolution > 128) {
    // Le contrat v0.1.0 (amendement P1.2.α) borne [16, 128] parce que c'est le
    // clamp historique de src/geometry/deco.js:144. Le slider UI est plus étroit
    // (32..128 dans index.html:300) — un input <32 n'est atteignable que par
    // API directe ou fixture manuelle. En dehors de [16,128], la géométrie serait
    // soit sous-définie (res<16 : lectures hors-bornes sur heightmapData) soit
    // sur-définie (res>128 : pixels ignorés). Fail-fast plutôt que corruption silencieuse.
    throw new TypeError(
      `heightmapResolution must be an integer in [16, 128], got ${heightmapResolution}`,
    );
  }
  const expectedLength = heightmapResolution * heightmapResolution * 4;
  if (heightmapData.length !== expectedLength) {
    throw new TypeError(
      `heightmapData.length (${heightmapData.length}) !== heightmapResolution² × 4 (${expectedLength})`,
    );
  }

  const res = heightmapResolution;
  const data = heightmapData;

  const plane = new THREE.PlaneGeometry(w, h, res, res);
  const pos = plane.getAttribute('position') as THREE.BufferAttribute;
  const verts = pos.count;
  for (let i = 0; i < verts; i++) {
    const gx = i % (res + 1);
    const gy = Math.floor(i / (res + 1));
    const px = Math.min(res - 1, Math.round(gx * (res - 1) / res));
    const py = Math.min(res - 1, Math.round(gy * (res - 1) / res));
    const ofs = (py * res + px) * 4;
    const lum = ((data[ofs] ?? 0) + (data[ofs + 1] ?? 0) + (data[ofs + 2] ?? 0)) / 3 / 255;
    let h01 = 1 - lum;
    if (invert) h01 = lum;
    pos.setZ(i, h01 * depth);
  }
  pos.needsUpdate = true;
  plane.computeVertexNormals();
  return plane;
}

// ---------------------------------------------------------------------------
// placeDecoOnPanel
// ---------------------------------------------------------------------------

/**
 * Place la géométrie de déco (dans son repère local) sur le panneau `panelKey`.
 * Mute `geo` par translate/rotate.
 * Port 1:1 de placeDecoOnPanel() dans src/geometry/deco.js (seules annotations TS ajoutées).
 */
export function placeDecoOnPanel(
  geo: THREE.BufferGeometry,
  panelKey: string,
  deco: { rotation: number; posX: number; posY: number },
  ctx: DecoCtx,
): void {
  const { W, wallH, rH, sideD, T, rL, ridge: rdg } = ctx;

  if (deco.rotation && Math.abs(deco.rotation) > 0.01) {
    geo.rotateZ(deco.rotation * Math.PI / 180);
  }

  const posX01 = deco.posX / 100;
  const posY01 = deco.posY / 100;

  if (panelKey === 'front') {
    const dx = -W / 2 + posX01 * W;
    const dy = posY01 * (wallH + rH);
    const dz = T;
    geo.translate(dx, dy, dz);
    return;
  }
  if (panelKey === 'back') {
    const dx = W / 2 - posX01 * W;
    const dy = posY01 * (wallH + rH);
    geo.rotateY(Math.PI);
    geo.translate(dx, dy, 0);
    return;
  }
  if (panelKey === 'left') {
    geo.rotateY(-Math.PI / 2);
    const dz = (posX01 - 0.5) * sideD;
    const dy = (posY01 - 0.5) * wallH;
    geo.translate(-T / 2, dy, dz);
    return;
  }
  if (panelKey === 'right') {
    geo.rotateY(Math.PI / 2);
    const dz = (0.5 - posX01) * sideD;
    const dy = (posY01 - 0.5) * wallH;
    geo.translate(T / 2, dy, dz);
    return;
  }
  if (panelKey === 'roofL' || panelKey === 'roofR') {
    const isL = panelKey === 'roofL';
    let xMin: number, xMax: number;
    if (rdg === 'miter') {
      if (isL) { xMin = -ctx.sL; xMax = ctx.bev; }
      else     { xMin = -ctx.bev; xMax = ctx.sL; }
    } else if (rdg === 'left') {
      if (isL) { xMin = -ctx.sL; xMax = T; }
      else     { xMin = 0; xMax = ctx.sL; }
    } else {
      if (isL) { xMin = -ctx.sL; xMax = 0; }
      else     { xMin = -T; xMax = ctx.sL; }
    }
    const upSlopeX = isL ? xMax : xMin;
    const downSlopeX = isL ? xMin : xMax;
    const dx = downSlopeX + posY01 * (upSlopeX - downSlopeX);
    const dz = (posX01 - 0.5) * rL;
    geo.rotateX(-Math.PI / 2);
    if (!isL) {
      geo.scale(-1, 1, 1);
      flipGeoWinding(geo);
    }
    geo.translate(dx, T, dz);
    return;
  }
}

// ---------------------------------------------------------------------------
// buildPanelClipPlanes
// ---------------------------------------------------------------------------

/**
 * Plans de clipping pour confiner visuellement la déco à la forme du panneau.
 * Port 1:1 de buildPanelClipPlanes() dans src/geometry/deco.js (seules annotations TS ajoutées).
 */
export function buildPanelClipPlanes(
  panelKey: string,
  ctx: DecoCtx,
  basePos: readonly [number, number, number],
  baseRot: readonly [number, number, number],
): THREE.Plane[] {
  const { W, wallH, rH, sideD, T, rL, ridge: rdg } = ctx;
  const planes: THREE.Plane[] = [];

  const obj = new THREE.Object3D();
  obj.position.set(basePos[0], basePos[1], basePos[2]);
  obj.rotation.set(baseRot[0], baseRot[1], baseRot[2]);
  obj.updateMatrixWorld(true);
  const mx = obj.matrixWorld;

  const transformPlane = (n: THREE.Vector3, pt: THREE.Vector3): THREE.Plane => {
    const nw = new THREE.Vector3(n.x, n.y, n.z).transformDirection(mx).normalize();
    const pw = new THREE.Vector3(pt.x, pt.y, pt.z).applyMatrix4(mx);
    const constant = -nw.dot(pw);
    return new THREE.Plane(nw, constant);
  };

  if (panelKey === 'front' || panelKey === 'back') {
    planes.push(transformPlane(new THREE.Vector3( 1, 0, 0), new THREE.Vector3(-W / 2, 0, 0)));
    planes.push(transformPlane(new THREE.Vector3(-1, 0, 0), new THREE.Vector3( W / 2, 0, 0)));
    planes.push(transformPlane(new THREE.Vector3( 0, 1, 0), new THREE.Vector3(0, 0, 0)));
    {
      const dx = W / 2, dy = rH;
      const len = Math.hypot(dx, dy);
      planes.push(transformPlane(new THREE.Vector3( dy / len, -dx / len, 0), new THREE.Vector3(-W / 2, wallH, 0)));
      planes.push(transformPlane(new THREE.Vector3(-dy / len, -dx / len, 0), new THREE.Vector3( W / 2, wallH, 0)));
    }
    return planes;
  }
  if (panelKey === 'left' || panelKey === 'right') {
    planes.push(transformPlane(new THREE.Vector3(0,  1, 0), new THREE.Vector3(0, -wallH / 2, 0)));
    planes.push(transformPlane(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0,  wallH / 2, 0)));
    planes.push(transformPlane(new THREE.Vector3(0, 0,  1), new THREE.Vector3(0, 0, -sideD / 2)));
    planes.push(transformPlane(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0,  sideD / 2)));
    return planes;
  }
  if (panelKey === 'roofL' || panelKey === 'roofR') {
    const isL = panelKey === 'roofL';
    let xMin: number, xMax: number;
    if (rdg === 'miter') { xMin = isL ? -ctx.sL : -ctx.bev; xMax = isL ? ctx.bev : ctx.sL; }
    else if (rdg === 'left') { xMin = isL ? -ctx.sL : 0; xMax = isL ? T : ctx.sL; }
    else { xMin = isL ? -ctx.sL : -T; xMax = isL ? 0 : ctx.sL; }
    planes.push(transformPlane(new THREE.Vector3( 1, 0, 0), new THREE.Vector3(xMin, 0, 0)));
    planes.push(transformPlane(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(xMax, 0, 0)));
    planes.push(transformPlane(new THREE.Vector3(0, 0,  1), new THREE.Vector3(0, 0, -rL / 2)));
    planes.push(transformPlane(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0,  rL / 2)));
    return planes;
  }
  return planes;
}
