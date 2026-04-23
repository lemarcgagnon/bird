// src/exporters/stl.ts
//
// Port **fidèle avec divergences documentées** de la logique de génération STL
// binaire depuis src/exporters/stl.js. Les fonctions publiques retournent des
// Uint8Array purs — le trigger du download est de la responsabilité de
// `nichoir-adapters/DownloadService` (P3). "Port fidèle" ≠ "1:1 littéral" :
// les divergences suivantes sont intentionnelles et assumées.
//
// Divergences vs src/exporters/stl.js :
//   1. Travaille sur `BuildResult.defs` (objets PanelDef) au lieu d'un
//      `THREE.Group` de meshes. La logique interne reconstruit la matrice monde
//      depuis `PanelDef.basePos` et `PanelDef.baseRot` — équivalent mathématique
//      à `mesh.matrixWorld` quand le mesh n'a que pos+rot (pas de parent ni scale).
//   2. `meshTriangles(mesh, bPos, bRot)` → `geometryTriangles(geo, basePos, baseRot)` :
//      accès direct à la géométrie au lieu de passer par un Mesh.
//   3. `dlBlob`, `showBusyToast`, `hideBusyToast`, `runExportWithFeedback`,
//      `alert(...)`, `requestAnimationFrame(...)` tous exclus (UI).
//   4. **Ignore `buildResult.explodeDistance`** — les STL sont toujours en
//      configuration montée (invariant documenté dans CONTRACTS.md).

import * as THREE from 'three';
import type { BuildResult, PanelDef } from '../types.js';

// ---------------------------------------------------------------------------
// Constantes (1:1 avec src/exporters/stl.js:8-9)
// ---------------------------------------------------------------------------

const HOUSE_KEYS = ['front', 'back', 'left', 'right', 'bottom', 'roofL', 'roofR', 'perch'] as const;
const DECO_STL_KEYS = ['deco_front', 'deco_back', 'deco_left', 'deco_right', 'deco_roofL', 'deco_roofR'] as const;
const HOUSE_AND_DECO_KEYS: readonly string[] = [...HOUSE_KEYS, ...DECO_STL_KEYS];
const DOOR_KEYS: readonly string[] = ['doorPanel'];

// ---------------------------------------------------------------------------
// Triangle brut (vecteurs Three.js après application de la matrice monde)
// ---------------------------------------------------------------------------

interface Triangle {
  n: THREE.Vector3;
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
}

// ---------------------------------------------------------------------------
// geometryTriangles — extrait les triangles d'une BufferGeometry en appliquant
// la transformation de base (basePos + baseRot). Équivalent de
// src/exporters/stl.js:meshTriangles, mais sans passer par un Mesh.
// ---------------------------------------------------------------------------

function geometryTriangles(geo: THREE.BufferGeometry, basePos: readonly [number, number, number], baseRot: readonly [number, number, number]): Triangle[] {
  const tmp = new THREE.Object3D();
  tmp.position.set(basePos[0], basePos[1], basePos[2]);
  tmp.rotation.set(baseRot[0], baseRot[1], baseRot[2]);
  tmp.updateMatrixWorld(true);
  const mx = tmp.matrixWorld;

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!posAttr) return [];
  const idx = geo.getIndex();
  const nf = idx ? idx.count / 3 : posAttr.count / 3;
  const tris: Triangle[] = [];

  const _ba = new THREE.Vector3();
  const _ca = new THREE.Vector3();

  for (let i = 0; i < nf; i++) {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    if (idx) {
      a.fromBufferAttribute(posAttr, idx.getX(i * 3));
      b.fromBufferAttribute(posAttr, idx.getX(i * 3 + 1));
      c.fromBufferAttribute(posAttr, idx.getX(i * 3 + 2));
    } else {
      a.fromBufferAttribute(posAttr, i * 3);
      b.fromBufferAttribute(posAttr, i * 3 + 1);
      c.fromBufferAttribute(posAttr, i * 3 + 2);
    }
    a.applyMatrix4(mx); b.applyMatrix4(mx); c.applyMatrix4(mx);
    _ba.subVectors(b, a);
    _ca.subVectors(c, a);
    const n = new THREE.Vector3().crossVectors(_ba, _ca).normalize();
    tris.push({ n, a, b, c });
  }
  return tris;
}

// ---------------------------------------------------------------------------
// trisToSTL — encode les triangles en STL binaire (header 80 + count 4 + 50/tri)
// Port 1:1 de src/exporters/stl.js:trisToSTL.
// ---------------------------------------------------------------------------

function trisToSTL(tris: readonly Triangle[], label: string): Uint8Array {
  const buf = new ArrayBuffer(80 + 4 + tris.length * 50);
  const dv = new DataView(buf);
  const hdr = 'Nichoir - ' + (label || 'export');
  for (let i = 0; i < hdr.length && i < 80; i++) dv.setUint8(i, hdr.charCodeAt(i));
  dv.setUint32(80, tris.length, true);
  let o = 84;
  tris.forEach(tri => {
    [tri.n, tri.a, tri.b, tri.c].forEach(v => {
      dv.setFloat32(o, v.x, true); o += 4;
      dv.setFloat32(o, v.y, true); o += 4;
      dv.setFloat32(o, v.z, true); o += 4;
    });
    dv.setUint16(o, 0, true); o += 2;
  });
  return new Uint8Array(buf);
}

// ---------------------------------------------------------------------------
// collectDefsTriangles — parcourt defs, filtre sur keys, concatène les triangles
// ---------------------------------------------------------------------------

function collectDefsTriangles(defs: readonly PanelDef[], keys: readonly string[]): Triangle[] {
  const keySet = new Set(keys);
  const tris: Triangle[] = [];
  for (const def of defs) {
    if (keySet.has(def.key)) {
      tris.push(...geometryTriangles(def.geometry, def.basePos, def.baseRot));
    }
  }
  return tris;
}

// ---------------------------------------------------------------------------
// applyPrintTransform — convertit Y-up (Three.js) → Z-up (slicer 3D printing),
// plancher à Z=0.
//
// Appliqué juste avant l'encoding binaire STL dans generateHouseSTL/generateDoorSTL/
// generatePanelsZIP — garantit que le STL exporté montre la cabane debout,
// prête à imprimer sans rotation manuelle.
//
// Transformation :
//   1. Rotation +π/2 autour de X : (x, y, z) → (x, -z, y)
//      appliquée sur les sommets ET les normales.
//   2. Trouver le min Z global sur tous les sommets rotatés.
//   3. Translater les sommets (PAS les normales) par -minZ pour poser le
//      plancher exactement sur la plaque de construction (Z=0).
//
// Propriété : fonction pure — ne mute pas les Triangle d'entrée.
// ---------------------------------------------------------------------------

function applyPrintTransform(tris: readonly Triangle[]): Triangle[] {
  // Étape 1 : rotation (x, y, z) → (x, -z, y) sur sommets et normales.
  const rotated = tris.map(tri => ({
    n: new THREE.Vector3(tri.n.x, -tri.n.z, tri.n.y),
    a: new THREE.Vector3(tri.a.x, -tri.a.z, tri.a.y),
    b: new THREE.Vector3(tri.b.x, -tri.b.z, tri.b.y),
    c: new THREE.Vector3(tri.c.x, -tri.c.z, tri.c.y),
  }));

  // Étape 2 : trouver le min Z global sur tous les sommets rotatés.
  let minZ = Infinity;
  for (const tri of rotated) {
    if (tri.a.z < minZ) minZ = tri.a.z;
    if (tri.b.z < minZ) minZ = tri.b.z;
    if (tri.c.z < minZ) minZ = tri.c.z;
  }
  if (!isFinite(minZ)) minZ = 0;

  // Étape 3 : translater les sommets par -minZ (les normales restent inchangées).
  return rotated.map(tri => ({
    n: tri.n,                                              // normales : rotation seule
    a: new THREE.Vector3(tri.a.x, tri.a.y, tri.a.z - minZ),
    b: new THREE.Vector3(tri.b.x, tri.b.y, tri.b.z - minZ),
    c: new THREE.Vector3(tri.c.x, tri.c.y, tri.c.z - minZ),
  }));
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Génère le STL binaire de la maison complète (murs + toit + plancher +
 * perchoir + décos, concaténés).
 * Retourne null si aucun panneau maison éligible dans `buildResult.defs`.
 */
export function generateHouseSTL(buildResult: BuildResult): Uint8Array | null {
  const tris = collectDefsTriangles(buildResult.defs, HOUSE_AND_DECO_KEYS);
  if (tris.length === 0) return null;
  return trisToSTL(applyPrintTransform(tris), 'maison_complete');
}

/**
 * Génère le STL binaire de la porte seule (panneau `doorPanel` si présent).
 * Retourne null si aucun `doorPanel` dans `buildResult.defs`
 * (i.e. `params.door === 'none' || !params.doorPanel`).
 */
export function generateDoorSTL(buildResult: BuildResult): Uint8Array | null {
  const tris = collectDefsTriangles(buildResult.defs, DOOR_KEYS);
  if (tris.length === 0) return null;
  return trisToSTL(applyPrintTransform(tris), 'porte');
}

// Exports internes pour réutilisation par zip.ts (collectDefsTriangles, trisToSTL,
// applyPrintTransform). Marqués comme "privés au package core" — NE PAS consommer
// depuis UI/adapters.
export {
  collectDefsTriangles as _collectDefsTriangles,
  trisToSTL as _trisToSTL,
  HOUSE_KEYS as _HOUSE_KEYS,
  applyPrintTransform as _applyPrintTransform,
};
