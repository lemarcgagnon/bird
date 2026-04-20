// src/geometry/panels.js
// Construction des géométries de panneaux. Pure — ne touche pas au store ni au DOM.

import { DECO_KEYS } from '../state.js';
import { buildDecoGeo, placeDecoOnPanel, buildPanelClipPlanes } from './deco.js';

const D2R = Math.PI / 180;

const COL = {
  front: 0xd4a574, back: 0xd4a574,
  left: 0xc49464, right: 0xc49464,
  bottom: 0xb48454,
  roofL: 0x9e7044, roofR: 0x9e7044,
  doorPanel: 0xe8c088,
};

// Pentagone trapézoïdal (façade) avec trou de porte optionnel et trou de perchoir.
export function mkPent(Wtop, Wbot, wH, rH, T, door, perch) {
  const s = new THREE.Shape();
  s.moveTo(-Wbot/2, 0);
  s.lineTo( Wbot/2, 0);
  s.lineTo( Wtop/2, wH);
  s.lineTo(0, wH + rH);
  s.lineTo(-Wtop/2, wH);
  s.closePath();

  if (door && door.type !== 'none') {
    const { type, w, h, cx, cy } = door;
    const hole = new THREE.Path();

    if (type === 'round') {
      hole.absellipse(cx, cy, w/2, h/2, 0, Math.PI*2, true);
    } else if (type === 'square') {
      hole.moveTo(cx - w/2, cy - h/2);
      hole.lineTo(cx - w/2, cy + h/2);
      hole.lineTo(cx + w/2, cy + h/2);
      hole.lineTo(cx + w/2, cy - h/2);
      hole.closePath();
    } else if (type === 'pentagon') {
      const peakH = w * 0.35;
      const boxH = h - peakH;
      const slope = (door.followTaper && door.taperX !== undefined && door.wallH)
        ? door.taperX / door.wallH
        : 0;
      const yBot = cy - h/2;
      const yShoulder = cy - h/2 + boxH;
      const xL_bot      = cx - w/2 + slope * (yBot      - cy);
      const xL_shoulder = cx - w/2 + slope * (yShoulder - cy);
      const xR_bot      = cx + w/2 - slope * (yBot      - cy);
      const xR_shoulder = cx + w/2 - slope * (yShoulder - cy);
      hole.moveTo(xL_bot,      yBot);
      hole.lineTo(xR_bot,      yBot);
      hole.lineTo(xR_shoulder, yShoulder);
      hole.lineTo(cx,          cy + h/2);
      hole.lineTo(xL_shoulder, yShoulder);
      hole.closePath();
    }
    s.holes.push(hole);
  }

  if (perch) {
    const ph = new THREE.Path();
    ph.absellipse(perch.cx, perch.cy, perch.diam/2, perch.diam/2, 0, Math.PI*2, true);
    s.holes.push(ph);
  }

  return new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false });
}

// Hexaèdre planaire pour murs latéraux avec évasement optionnel et coupe de toit.
// v0..v3 : face intérieure, dans l'ordre bas-avant / bas-arrière / haut-arrière / haut-avant.
// roofPlane(x, z) → y : quand fourni, les 4 sommets supérieurs (inner + outer) suivent
// exactement le plan du toit — la face du haut est coplanaire avec la face inférieure du toit.
export function mkHexPanel(v0, v1, v2, v3, outwardNormal, T, roofPlane = null) {
  const n = outwardNormal;

  // Sommets intérieurs du haut : Y corrigé par le plan du toit si fourni
  const tv2 = roofPlane ? [v2[0], roofPlane(v2[0], v2[2]), v2[2]] : v2;
  const tv3 = roofPlane ? [v3[0], roofPlane(v3[0], v3[2]), v3[2]] : v3;

  const off = (v) => [v[0] + n[0]*T, v[1] + n[1]*T, v[2] + n[2]*T];
  const o0 = off(v0), o1 = off(v1);

  // Sommets extérieurs du haut : X/Z décalés par la normale, Y projeté sur le plan du toit
  let o2, o3;
  if (roofPlane) {
    const r2 = off(tv2); o2 = [r2[0], roofPlane(r2[0], r2[2]), r2[2]];
    const r3 = off(tv3); o3 = [r3[0], roofPlane(r3[0], r3[2]), r3[2]];
  } else {
    o2 = off(tv2); o3 = off(tv3);
  }

  const geo = new THREE.BufferGeometry();
  const pos = [];
  const tri = (a,b,c) => pos.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);

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

// Construit la liste des définitions de panneaux à partir de l'état.
// Retourne { defs, hasTaper, decoCtx } pour que le renderer crée les meshes.
// `defs` : tableau de [key, geometry, basePos, baseRot, color, explodeDir, extraClips?]
export function buildPanelDefs(state) {
  const { params, clip, decos } = state;
  const { W, H, D, slope, overhang, T, explode, floor, ridge, taperX } = params;

  const ang = slope * D2R;
  const eDist = (explode / 100) * Math.max(W, H, D) * 0.65;
  const isPose = floor === 'pose';

  const wallH = isPose ? H - T : H;
  const baseY = isPose ? T : 0;
  const rH = (W/2) * Math.tan(ang);
  const peakY = baseY + wallH + rH;

  const Wtop = W;
  const Wbot = W + 2 * taperX;
  const hasTaper = taperX !== 0;
  const alpha = hasTaper ? Math.atan(taperX / wallH) : 0;
  const wallHreal = Math.sqrt(wallH*wallH + taperX*taperX);

  const floorW = isPose ? Wbot : Wbot - 2*T;
  const floorD = isPose ? D : D - 2*T;
  const sideD = D - 2*T;

  const sL = (W/2 + overhang) / Math.cos(ang);
  const rL = D + 2*overhang;

  // Plan de la face inférieure du toit : Y = peakY + x·tan(ang)
  // À la rive gauche (x=−W/2) : peakY − W/2·tan = baseY+wallH ✓
  // À l'arête intérieure (x=−(W/2−T)) : baseY+wallH + T·tan ✓
  const tang = Math.tan(ang);
  const roofPlaneL = (x, _z) => peakY + x * tang;
  const roofPlaneR = (x, _z) => peakY - x * tang;

  // Plans de clipping actifs
  const activeClips = [];
  const clipPlanesOut = {};
  if (clip.x.on) {
    clipPlanesOut.x = { constant: -Wbot/2 - overhang + clip.x.pos*(Wbot + overhang*2) };
    activeClips.push('x');
  }
  if (clip.y.on) {
    clipPlanesOut.y = { constant: clip.y.pos * (peakY + 20) };
    activeClips.push('y');
  }
  if (clip.z.on) {
    clipPlanesOut.z = { constant: -D/2 - overhang + clip.z.pos*(D + overhang*2) };
    activeClips.push('z');
  }

  const defs = [];

  // Porte : centre X et Y dépendent de la largeur locale (tenant compte de l'évasement)
  const doorY = params.doorPY/100 * wallH;
  const doorWlocal = Wbot - 2 * taperX * (params.doorPY/100);
  const doorCx = -doorWlocal/2 + params.doorPX/100 * doorWlocal;

  const doorInfo = params.door !== 'none' ? {
    type: params.door, w: params.doorW, h: params.doorH,
    cx: doorCx, cy: doorY,
    followTaper: params.doorFollowTaper, taperX, wallH,
  } : null;

  // Perchoir
  const perchY = doorY - params.doorH/2 - params.perchOff;
  const perchYfrac = Math.max(0, Math.min(1, perchY / wallH));
  const perchWlocal = Wbot - 2 * taperX * perchYfrac;
  const perchCx = -perchWlocal/2 + params.doorPX/100 * perchWlocal;

  const perchHoleInfo = (params.perch && params.door !== 'none') ? {
    cx: perchCx, cy: perchY, diam: params.perchDiam,
  } : null;

  // Façade avant (avec porte et perchoir) + arrière (pleine)
  defs.push(['front', mkPent(Wtop, Wbot, wallH, rH, T, doorInfo, perchHoleInfo), [0, baseY, D/2 - T], [0,0,0], COL.front, [0,0,1]]);
  defs.push(['back',  mkPent(Wtop, Wbot, wallH, rH, T, null, null),              [0, baseY, -D/2],     [0,0,0], COL.back,  [0,0,-1]]);

  // Murs latéraux : box si pas d'évasement, hexaèdre sinon
  let leftAnchorPos, leftAnchorRot, rightAnchorPos, rightAnchorRot;

  if (!hasTaper) {
    // Mur gauche : sommets intérieurs en espace monde, face haut taillée selon roofPlaneL
    const Lv0=[-(W/2-T),baseY,+(D/2-T)], Lv1=[-(W/2-T),baseY,-(D/2-T)];
    const Lv2=[-(W/2-T),baseY+wallH,-(D/2-T)], Lv3=[-(W/2-T),baseY+wallH,+(D/2-T)];
    const leftGeo = mkHexPanel(Lv0, Lv1, Lv2, Lv3, [-1,0,0], T, roofPlaneL);
    defs.push(['left', leftGeo, [0,0,0], [0,0,0], COL.left, [-1,0,0]]);
    leftAnchorPos  = [-W/2+T/2, baseY+wallH/2, 0]; leftAnchorRot  = [0,0,0];

    // Mur droit (symétrique)
    const Rv0=[+(W/2-T),baseY,-(D/2-T)], Rv1=[+(W/2-T),baseY,+(D/2-T)];
    const Rv2=[+(W/2-T),baseY+wallH,+(D/2-T)], Rv3=[+(W/2-T),baseY+wallH,-(D/2-T)];
    const rightGeo = mkHexPanel(Rv0, Rv1, Rv2, Rv3, [+1,0,0], T, roofPlaneR);
    defs.push(['right', rightGeo, [0,0,0], [0,0,0], COL.right, [+1,0,0]]);
    rightAnchorPos = [+W/2-T/2, baseY+wallH/2, 0]; rightAnchorRot = [0,0,0];
  } else {
    const Lv0 = [-(Wbot/2 - T), baseY,        +(D/2 - T)];
    const Lv1 = [-(Wbot/2 - T), baseY,        -(D/2 - T)];
    const Lv2 = [-(Wtop/2 - T), baseY+wallH,  -(D/2 - T)];
    const Lv3 = [-(Wtop/2 - T), baseY+wallH,  +(D/2 - T)];
    const Ln = [-Math.cos(alpha), Math.sin(alpha), 0];
    const leftGeo = mkHexPanel(Lv0, Lv1, Lv2, Lv3, Ln, T, roofPlaneL);
    defs.push(['left', leftGeo, [0,0,0], [0,0,0], COL.left, [-Math.cos(alpha), Math.sin(alpha), 0]]);

    const innerCenterL = [(Lv0[0]+Lv2[0])/2, (Lv0[1]+Lv2[1])/2, 0];
    leftAnchorPos = [innerCenterL[0] + T/2*Ln[0], innerCenterL[1] + T/2*Ln[1], 0];
    leftAnchorRot = [0, 0, -alpha];

    const Rv0 = [ (Wbot/2 - T), baseY,        -(D/2 - T)];
    const Rv1 = [ (Wbot/2 - T), baseY,        +(D/2 - T)];
    const Rv2 = [ (Wtop/2 - T), baseY+wallH,  +(D/2 - T)];
    const Rv3 = [ (Wtop/2 - T), baseY+wallH,  -(D/2 - T)];
    const Rn = [ Math.cos(alpha), Math.sin(alpha), 0];
    const rightGeo = mkHexPanel(Rv0, Rv1, Rv2, Rv3, Rn, T, roofPlaneR);
    defs.push(['right', rightGeo, [0,0,0], [0,0,0], COL.right, [Math.cos(alpha), Math.sin(alpha), 0]]);

    const innerCenterR = [(Rv0[0]+Rv2[0])/2, (Rv0[1]+Rv2[1])/2, 0];
    rightAnchorPos = [innerCenterR[0] + T/2*Rn[0], innerCenterR[1] + T/2*Rn[1], 0];
    rightAnchorRot = [0, 0, alpha];
  }

  // Plancher
  defs.push(['bottom', new THREE.BoxGeometry(floorW, T, floorD), [0, T/2, 0], [0,0,0], COL.bottom, [0,-1,0]]);

  // Toit
  const bev = T * Math.tan(ang);

  if (ridge === 'miter') {
    const shL = new THREE.Shape();
    shL.moveTo(0, 0); shL.lineTo(-sL, 0); shL.lineTo(-sL, T); shL.lineTo(bev, T); shL.closePath();
    const rlG = new THREE.ExtrudeGeometry(shL, {depth: rL, bevelEnabled: false});
    rlG.translate(0, 0, -rL/2);
    defs.push(['roofL', rlG, [0, peakY, 0], [0,0,ang], COL.roofL, [-Math.sin(ang)*0.7, Math.cos(ang)*0.7, 0]]);

    const shR = new THREE.Shape();
    shR.moveTo(0, 0); shR.lineTo(sL, 0); shR.lineTo(sL, T); shR.lineTo(-bev, T); shR.closePath();
    const rrG = new THREE.ExtrudeGeometry(shR, {depth: rL, bevelEnabled: false});
    rrG.translate(0, 0, -rL/2);
    defs.push(['roofR', rrG, [0, peakY, 0], [0,0,-ang], COL.roofR, [Math.sin(ang)*0.7, Math.cos(ang)*0.7, 0]]);
  } else {
    const sL_L = ridge === 'left' ? sL + T : sL;
    const sL_R = ridge === 'right' ? sL + T : sL;

    const rlG = new THREE.BoxGeometry(sL_L, T, rL);
    if (ridge === 'left') rlG.translate((-sL+T)/2, T/2, 0);
    else                  rlG.translate(-sL/2, T/2, 0);
    defs.push(['roofL', rlG, [0, peakY, 0], [0,0,ang], COL.roofL, [-Math.sin(ang)*0.7, Math.cos(ang)*0.7, 0]]);

    const rrG = new THREE.BoxGeometry(sL_R, T, rL);
    if (ridge === 'right') rrG.translate((sL-T)/2, T/2, 0);
    else                   rrG.translate(sL/2, T/2, 0);
    defs.push(['roofR', rrG, [0, peakY, 0], [0,0,-ang], COL.roofR, [Math.sin(ang)*0.7, Math.cos(ang)*0.7, 0]]);
  }

  // Panneau de porte (pièce physique séparée)
  if (params.door !== 'none' && params.doorPanel) {
    const v = params.doorVar / 100;
    const dw = params.doorW * v, dh = params.doorH * v;
    const dcx = doorCx;
    const dcy = baseY + params.doorPY/100 * wallH;
    let dpGeo;

    if (params.door === 'round') {
      const ds = new THREE.Shape();
      ds.absellipse(0, 0, dw/2, dh/2, 0, Math.PI*2, false);
      dpGeo = new THREE.ExtrudeGeometry(ds, {depth: T, bevelEnabled: false});
      dpGeo.translate(dcx, dcy, 0);
    } else if (params.door === 'square') {
      dpGeo = new THREE.BoxGeometry(dw, dh, T);
      dpGeo.translate(dcx, dcy, T/2);
    } else if (params.door === 'pentagon') {
      const pk = dw * 0.35, bx = dh - pk;
      const slope2 = (params.doorFollowTaper && wallH) ? taperX / wallH : 0;
      const yBot = -dh/2;
      const yShoulder = -dh/2 + bx;
      const xL_bot      = -dw/2 + slope2 * yBot;
      const xL_shoulder = -dw/2 + slope2 * yShoulder;
      const xR_bot      =  dw/2 - slope2 * yBot;
      const xR_shoulder =  dw/2 - slope2 * yShoulder;
      const ds = new THREE.Shape();
      ds.moveTo(xL_bot,      yBot);
      ds.lineTo(xR_bot,      yBot);
      ds.lineTo(xR_shoulder, yShoulder);
      ds.lineTo(0,           dh/2);
      ds.lineTo(xL_shoulder, yShoulder);
      ds.closePath();
      dpGeo = new THREE.ExtrudeGeometry(ds, {depth: T, bevelEnabled: false});
      dpGeo.translate(dcx, dcy, 0);
    }

    if (dpGeo) {
      defs.push(['doorPanel', dpGeo, [0, 0, D/2 - T], [0,0,0], COL.doorPanel, [0, 0, 2.5]]);
    }
  }

  // Perchoir (cylindre)
  if (params.perch && params.door !== 'none') {
    const pGeo = new THREE.CylinderGeometry(params.perchDiam/2, params.perchDiam/2, params.perchLen, 16);
    pGeo.rotateX(Math.PI/2);
    pGeo.translate(perchCx, baseY + perchY, params.perchLen/2);
    defs.push(['perch', pGeo, [0, 0, D/2], [0,0,0], 0x8b6e4e, [0, 0, 2.0]]);
  }

  // Décorations
  const _sL_L = (ridge==='miter') ? sL : (ridge==='left' ? sL+T : sL);
  const _sL_R = (ridge==='miter') ? sL : (ridge==='right' ? sL+T : sL);
  const decoCtx = { W, Wtop, Wbot, wallH, wallHreal, rH, sideD, T, sL, sL_L:_sL_L, sL_R:_sL_R, rL, bev, ridge, taperX, alpha };

  const decoAnchors = {};
  DECO_KEYS.forEach(pk => {
    const parent = defs.find(e => e[0] === pk);
    if (!parent) return;
    if (hasTaper && pk === 'left')       decoAnchors[pk] = { pos: leftAnchorPos,  rot: leftAnchorRot,  eDir: parent[5] };
    else if (hasTaper && pk === 'right') decoAnchors[pk] = { pos: rightAnchorPos, rot: rightAnchorRot, eDir: parent[5] };
    else                                  decoAnchors[pk] = { pos: parent[2],     rot: parent[3],      eDir: parent[5] };
  });

  DECO_KEYS.forEach(pk => {
    const d = decos[pk];
    if (!d.enabled || !d.source) return;
    const anchor = decoAnchors[pk];
    if (!anchor) return;
    const dGeo = buildDecoGeo(d);
    if (!dGeo) return;
    const placeCtx = Object.assign({}, decoCtx);
    if (hasTaper && (pk === 'left' || pk === 'right')) {
      placeCtx.wallH = wallHreal;
    }
    placeDecoOnPanel(dGeo, pk, d, placeCtx);
    const extraClips = d.clipToPanel ? buildPanelClipPlanes(pk, placeCtx, anchor.pos, anchor.rot) : null;
    defs.push(['deco_' + pk, dGeo, anchor.pos, anchor.rot, 0xe8a955, anchor.eDir, extraClips]);
  });

  return {
    defs,
    explodeDistance: eDist,
    activeClips, clipPlanesOut,
    // Données géométriques exposées pour les modules calc/cut-plan (évite de recalculer)
    derived: { wallH, rH, sL, rL, bev, Wtop, Wbot, wallHreal, floorW, floorD, sideD, hasTaper, ang, peakY },
  };
}

// Crée les meshes Three.js à partir des défs, avec matériau selon le mode d'affichage,
// et les ajoute au groupe fourni. Renvoie rien — mutation du groupe.
export function materializeDefs(group, buildResult, mode, activeClipPlanes) {
  const { defs, explodeDistance } = buildResult;

  defs.forEach(([key, geo, pos, rot, color, eDir, extraClips]) => {
    const clipList = extraClips ? activeClipPlanes.concat(extraClips) : activeClipPlanes;
    let mat;
    if (mode === 'xray') {
      mat = new THREE.MeshPhongMaterial({
        color, side: THREE.DoubleSide, transparent: true, opacity: 0.22,
        depthWrite: false, clippingPlanes: clipList,
      });
    } else if (mode === 'wireframe') {
      mat = new THREE.MeshBasicMaterial({ color, wireframe: true, side: THREE.DoubleSide, clippingPlanes: clipList });
    } else if (mode === 'edges') {
      mat = new THREE.MeshBasicMaterial({ visible: false });
    } else {
      mat = new THREE.MeshPhongMaterial({ color, side: THREE.DoubleSide, shininess: 18, specular: 0x1a1a1a, clippingPlanes: clipList });
    }

    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0] + eDir[0]*explodeDistance, pos[1] + eDir[1]*explodeDistance, pos[2] + eDir[2]*explodeDistance);
    m.rotation.set(rot[0], rot[1], rot[2]);
    m.userData = {
      panelKey: key,
      basePos: pos.slice ? pos.slice() : pos,
      baseRot: rot.slice ? rot.slice() : rot,
    };
    group.add(m);

    if (mode !== 'wireframe') {
      const eG = new THREE.EdgesGeometry(geo, 15);
      const eM = new THREE.LineBasicMaterial({
        color: mode === 'edges' ? 0xd4a574 : 0x3a2a1a,
        clippingPlanes: clipList,
        transparent: mode === 'xray',
        opacity: mode === 'xray' ? 0.55 : 1,
      });
      const ln = new THREE.LineSegments(eG, eM);
      ln.position.copy(m.position);
      ln.rotation.copy(m.rotation);
      group.add(ln);
    }
  });
}
