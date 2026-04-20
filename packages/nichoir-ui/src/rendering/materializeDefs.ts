// src/rendering/materializeDefs.ts
//
// Port fidèle de materializeDefs() de src/geometry/panels.js (v15).
// Divergences :
//   1. Accepte des PanelDef objets (forme TS contrat) au lieu de tuples.
//   2. Mêmes matériaux, même politique de création (MeshPhongMaterial en solid/xray,
//      MeshBasicMaterial en wireframe, visible:false en edges, LineSegments pour les
//      edges overlays).
//   3. Reste UI — ne peut pas descendre en @nichoir/core (matériaux = rendering).

import * as THREE from 'three';
import type { BuildResult, PanelDef, DisplayMode } from '@nichoir/core';

export function materializeDefs(
  group: THREE.Group,
  buildResult: BuildResult,
  mode: DisplayMode,
  activeClipPlanes: THREE.Plane[],
): void {
  const { defs, explodeDistance } = buildResult;

  defs.forEach((def: PanelDef) => {
    const { key, geometry: geo, basePos: pos, baseRot: rot, color, explodeDir: eDir, extraClips } = def;
    const clipList = extraClips ? activeClipPlanes.concat(extraClips) : activeClipPlanes;

    let mat: THREE.Material;
    if (mode === 'xray') {
      mat = new THREE.MeshPhongMaterial({
        color, side: THREE.DoubleSide, transparent: true, opacity: 0.22,
        depthWrite: false, clippingPlanes: clipList,
      });
    } else if (mode === 'wireframe') {
      mat = new THREE.MeshBasicMaterial({
        color, wireframe: true, side: THREE.DoubleSide, clippingPlanes: clipList,
      });
    } else if (mode === 'edges') {
      mat = new THREE.MeshBasicMaterial({ visible: false });
    } else {
      // solid
      mat = new THREE.MeshPhongMaterial({
        color, side: THREE.DoubleSide, shininess: 18, specular: 0x1a1a1a, clippingPlanes: clipList,
      });
    }

    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0] + eDir[0] * explodeDistance, pos[1] + eDir[1] * explodeDistance, pos[2] + eDir[2] * explodeDistance);
    m.rotation.set(rot[0], rot[1], rot[2]);
    m.userData = {
      panelKey: key,
      basePos: [pos[0], pos[1], pos[2]],
      baseRot: [rot[0], rot[1], rot[2]],
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

/**
 * Libère toutes les ressources GPU d'un groupe : dispose geometries et materials
 * de chaque Mesh/LineSegments enfant, puis retire l'enfant du groupe.
 * À appeler avant un rebuild complet.
 */
export function clearGroup(group: THREE.Group): void {
  while (group.children.length) {
    const c = group.children[0];
    if (!c) break;
    group.remove(c);
    const disposable = c as unknown as { geometry?: { dispose?: () => void }; material?: { dispose?: () => void } };
    disposable.geometry?.dispose?.();
    disposable.material?.dispose?.();
  }
}
