// src/geometry/deco.js
// Parsing SVG, rastérisation PNG/JPG, construction 3D de la décoration,
// placement sur un panneau donné, et plans de clipping associés.
// Aucun accès au store ni au DOM (sauf DOMParser / document.createElement
// pour l'échantillonnage SVG, inévitable).

import { t } from '../i18n.js';

// Parse un texte SVG → { shapes, bbox, warning }. Utilise getPointAtLength du DOM
// pour supporter toutes les commandes de path nativement.
export function parseSVG(svgText) {
  let holder = null;
  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const err = doc.querySelector('parsererror');
    if (err) return { shapes: null, bbox: null, warning: t('deco.svg.malformed') };
    const svgEl = doc.documentElement;

    holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-99999px;width:0;height:0;overflow:hidden';
    const clone = svgEl.cloneNode(true);
    holder.appendChild(clone);
    document.body.appendChild(holder);

    const N = 120;
    const shapes = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const collect = (pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    };

    const elements = clone.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line');
    elements.forEach(el => {
      let length = 0;
      try { length = el.getTotalLength(); } catch(e) { return; }
      if (!length || !isFinite(length)) return;

      const tag = el.tagName.toLowerCase();
      const isClosed = (tag !== 'polyline' && tag !== 'line');
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const tt = (i / N) * length;
        let p;
        try { p = el.getPointAtLength(tt); } catch(e) { return; }
        pts.push({ x: p.x, y: p.y });
        collect(p);
      }
      if (pts.length < 3) return;

      const shape = new THREE.Shape();
      shape.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
      if (isClosed) shape.closePath();
      shapes.push(shape);
    });

    if (!shapes.length) return { shapes: null, bbox: null, warning: t('deco.svg.noShapes') };
    return { shapes, bbox: { minX, minY, maxX, maxY }, warning: null };
  } catch(e) {
    return { shapes: null, bbox: null, warning: t('deco.svg.parseError', { message: e.message }) };
  } finally {
    if (holder && holder.parentNode) holder.parentNode.removeChild(holder);
  }
}

// Rasterise source (SVG ou Image) vers un canvas carré de taille `resolution`.
export function rasterizeToCanvas(source, sourceType, resolution) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let blobUrl = null;
    const cleanup = () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };

    img.onload = () => {
      cleanup();
      const cv = document.createElement('canvas');
      cv.width = resolution; cv.height = resolution;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, resolution, resolution);
      const ar = img.width / img.height;
      let dw = resolution, dh = resolution;
      if (ar > 1) dh = resolution / ar;
      else dw = resolution * ar;
      const dx = (resolution - dw) / 2, dy = (resolution - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      resolve(cv);
    };
    img.onerror = () => { cleanup(); reject(new Error("Image load failed")); };

    if (sourceType === 'svg') {
      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      blobUrl = URL.createObjectURL(blob);
      img.src = blobUrl;
    } else {
      img.src = source;
    }
  });
}

// Construit la géométrie 3D d'une déco (vectoriel ou heightmap) dans son repère local.
export function buildDecoGeo(deco) {
  if (!deco || !deco.source) return null;
  const { w, h, depth, mode } = deco;

  if (mode === 'vector' && deco.shapes && deco.shapes.length) {
    const bb = deco.bbox;
    const bw = bb.maxX - bb.minX, bh = bb.maxY - bb.minY;
    if (bw <= 0 || bh <= 0) return null;
    const sx = w / bw, sy = h / bh;

    const bevelPct = Math.max(0, Math.min(100, deco.bevel)) / 100;
    const bevelThickness = depth * 0.3 * bevelPct;
    const bevelSize = Math.min(w, h) * 0.02 * bevelPct;

    const remap = (shape) => {
      const out = new THREE.Shape();
      const pts = shape.getPoints(0);
      if (!pts.length) return null;
      const mx = (x) => (x - bb.minX) * sx - w/2;
      const my = (y) => h/2 - (y - bb.minY) * sy;
      out.moveTo(mx(pts[0].x), my(pts[0].y));
      for (let i = 1; i < pts.length; i++) out.lineTo(mx(pts[i].x), my(pts[i].y));
      out.closePath();
      return out;
    };
    const remapped = deco.shapes.map(remap).filter(s => s);
    if (!remapped.length) return null;

    const opts = {
      depth,
      bevelEnabled: bevelPct > 0 && bevelThickness > 0.01,
      bevelThickness, bevelSize,
      bevelSegments: 2, curveSegments: 8,
    };
    return new THREE.ExtrudeGeometry(remapped, opts);
  }

  // HEIGHTMAP
  if (!deco.rasterCanvas) return null;
  const res = Math.max(16, Math.min(128, deco.resolution | 0));
  const cv = document.createElement('canvas');
  cv.width = res; cv.height = res;
  const ctx = cv.getContext('2d');
  ctx.drawImage(deco.rasterCanvas, 0, 0, res, res);
  const data = ctx.getImageData(0, 0, res, res).data;

  const plane = new THREE.PlaneGeometry(w, h, res, res);
  const pos = plane.getAttribute('position');
  const verts = pos.count;
  for (let i = 0; i < verts; i++) {
    const gx = i % (res + 1);
    const gy = Math.floor(i / (res + 1));
    const px = Math.min(res - 1, Math.round(gx * (res - 1) / res));
    const py = Math.min(res - 1, Math.round(gy * (res - 1) / res));
    const ofs = (py * res + px) * 4;
    let lum = (data[ofs] + data[ofs+1] + data[ofs+2]) / 3 / 255;
    let h01 = 1 - lum;
    if (deco.invert) h01 = lum;
    pos.setZ(i, h01 * depth);
  }
  pos.needsUpdate = true;
  plane.computeVertexNormals();
  return plane;
}

// Inverse l'ordre des sommets des triangles (après un scale négatif) pour
// que les normales repointent vers l'extérieur.
function flipGeoWinding(geo) {
  const idx = geo.getIndex();
  if (idx) {
    const arr = idx.array;
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i+1]; arr[i+1] = arr[i+2]; arr[i+2] = tmp;
    }
    idx.needsUpdate = true;
  } else {
    const pos = geo.getAttribute('position');
    const arr = pos.array;
    const tmp = new Float32Array(3);
    for (let i = 0; i < arr.length; i += 9) {
      tmp[0] = arr[i+3]; tmp[1] = arr[i+4]; tmp[2] = arr[i+5];
      arr[i+3] = arr[i+6]; arr[i+4] = arr[i+7]; arr[i+5] = arr[i+8];
      arr[i+6] = tmp[0]; arr[i+7] = tmp[1]; arr[i+8] = tmp[2];
    }
    pos.needsUpdate = true;
  }
  geo.computeVertexNormals();
}

// Place la géométrie de déco (dans son repère local) sur le panneau `panelKey`.
// Mute `geo` par translate/rotate. ctx contient W, wallH, rH, sideD, T, sL, rL, ridge...
export function placeDecoOnPanel(geo, panelKey, deco, ctx) {
  const { W, wallH, rH, sideD, T, rL, ridge: rdg } = ctx;

  if (deco.rotation && Math.abs(deco.rotation) > 0.01) {
    geo.rotateZ(deco.rotation * Math.PI / 180);
  }

  const posX01 = deco.posX / 100;
  const posY01 = deco.posY / 100;

  if (panelKey === 'front') {
    const dx = -W/2 + posX01 * W;
    const dy = posY01 * (wallH + rH);
    const dz = T;
    geo.translate(dx, dy, dz);
    return;
  }
  if (panelKey === 'back') {
    const dx = W/2 - posX01 * W;
    const dy = posY01 * (wallH + rH);
    geo.rotateY(Math.PI);
    geo.translate(dx, dy, 0);
    return;
  }
  if (panelKey === 'left') {
    geo.rotateY(-Math.PI / 2);
    const dz = (posX01 - 0.5) * sideD;
    const dy = (posY01 - 0.5) * wallH;
    geo.translate(-T/2, dy, dz);
    return;
  }
  if (panelKey === 'right') {
    geo.rotateY(Math.PI / 2);
    const dz = (0.5 - posX01) * sideD;
    const dy = (posY01 - 0.5) * wallH;
    geo.translate(T/2, dy, dz);
    return;
  }
  if (panelKey === 'roofL' || panelKey === 'roofR') {
    const isL = panelKey === 'roofL';
    let xMin, xMax;
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

// Plans de clipping pour confiner visuellement la déco à la forme du panneau.
export function buildPanelClipPlanes(panelKey, ctx, basePos, baseRot) {
  const { W, wallH, rH, sideD, T, rL, ridge: rdg } = ctx;
  const planes = [];

  const obj = new THREE.Object3D();
  obj.position.set(basePos[0], basePos[1], basePos[2]);
  obj.rotation.set(baseRot[0], baseRot[1], baseRot[2]);
  obj.updateMatrixWorld(true);
  const mx = obj.matrixWorld;

  const transformPlane = (n, pt) => {
    const nw = new THREE.Vector3(n.x, n.y, n.z).transformDirection(mx).normalize();
    const pw = new THREE.Vector3(pt.x, pt.y, pt.z).applyMatrix4(mx);
    const constant = -nw.dot(pw);
    return new THREE.Plane(nw, constant);
  };

  if (panelKey === 'front' || panelKey === 'back') {
    planes.push(transformPlane(new THREE.Vector3( 1,0,0), new THREE.Vector3(-W/2,0,0)));
    planes.push(transformPlane(new THREE.Vector3(-1,0,0), new THREE.Vector3( W/2,0,0)));
    planes.push(transformPlane(new THREE.Vector3( 0,1,0), new THREE.Vector3(0,0,0)));
    {
      const dx = W/2, dy = rH;
      const len = Math.hypot(dx, dy);
      planes.push(transformPlane(new THREE.Vector3( dy/len, -dx/len, 0), new THREE.Vector3(-W/2, wallH, 0)));
      planes.push(transformPlane(new THREE.Vector3(-dy/len, -dx/len, 0), new THREE.Vector3( W/2, wallH, 0)));
    }
    return planes;
  }
  if (panelKey === 'left' || panelKey === 'right') {
    planes.push(transformPlane(new THREE.Vector3(0, 1,0), new THREE.Vector3(0,-wallH/2,0)));
    planes.push(transformPlane(new THREE.Vector3(0,-1,0), new THREE.Vector3(0, wallH/2,0)));
    planes.push(transformPlane(new THREE.Vector3(0,0, 1), new THREE.Vector3(0,0,-sideD/2)));
    planes.push(transformPlane(new THREE.Vector3(0,0,-1), new THREE.Vector3(0,0, sideD/2)));
    return planes;
  }
  if (panelKey === 'roofL' || panelKey === 'roofR') {
    const isL = panelKey === 'roofL';
    let xMin, xMax;
    if (rdg === 'miter') { xMin = isL ? -ctx.sL : -ctx.bev; xMax = isL ? ctx.bev : ctx.sL; }
    else if (rdg === 'left') { xMin = isL ? -ctx.sL : 0; xMax = isL ? T : ctx.sL; }
    else { xMin = isL ? -ctx.sL : -T; xMax = isL ? 0 : ctx.sL; }
    planes.push(transformPlane(new THREE.Vector3( 1,0,0), new THREE.Vector3(xMin,0,0)));
    planes.push(transformPlane(new THREE.Vector3(-1,0,0), new THREE.Vector3(xMax,0,0)));
    planes.push(transformPlane(new THREE.Vector3(0,0, 1), new THREE.Vector3(0,0,-rL/2)));
    planes.push(transformPlane(new THREE.Vector3(0,0,-1), new THREE.Vector3(0,0, rL/2)));
    return planes;
  }
  return planes;
}
