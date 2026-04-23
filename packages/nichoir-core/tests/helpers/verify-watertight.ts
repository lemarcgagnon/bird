// tests/helpers/verify-watertight.ts
//
// Vérifie qu'une THREE.BufferGeometry est un 2-manifold fermé (watertight).
// Utilisé en tests pour détecter les géométries non-manifold produites par
// concat naïf de sous-pièces ou par extrusions orthogonales non-propres.
//
// Critères testés :
//   - Chaque edge est partagé par EXACTEMENT 2 triangles (2-manifold fermé).
//     Si un edge est partagé par 1 triangle → boundary edge (mesh ouvert).
//     Si un edge est partagé par 3+ triangles → topologie non-manifold.
//   - Aucun triangle dégénéré (aire < epsilon).
//   - Aucun couple de triangles EXACTEMENT dupliqués (positions identiques,
//     même ordre de sommets).
//
// Usage :
//   const report = verifyWatertight(geometry);
//   expect(report.manifold).toBe(true);
//
// Tolerance : les positions sont quantifiées à `tolerance` décimales
// avant hash pour regrouper les sommets co-localisés.

import type * as THREE from 'three';

export interface WatertightReport {
  /** true si le mesh est un 2-manifold fermé (tous edges ont exactement 2 triangles). */
  manifold: boolean;
  /** Nombre total de triangles. */
  triangleCount: number;
  /** Nombre total de sommets uniques (après quantification). */
  vertexCount: number;
  /** Edges partagés par exactement 2 triangles (attendu pour un mesh fermé). */
  edges2: number;
  /** Edges partagés par 1 triangle (boundary — mesh ouvert à cet endroit). */
  boundaryEdges: number;
  /** Edges partagés par 3 ou plus triangles (non-manifold strict). */
  nonManifoldEdges: number;
  /** Triangles d'aire inférieure à `areaEpsilon` (dégénérés). */
  degenerateTriangles: number;
  /** Paires de triangles exactement identiques (même 3 sommets, même ordre). */
  duplicateTriangles: number;
  /** Pour debug : premiers exemples de problèmes (max 5). */
  samples: string[];
}

interface Vec3 { x: number; y: number; z: number; }

function quantize(v: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

function vertexKey(v: Vec3, decimals: number): string {
  return `${quantize(v.x, decimals)},${quantize(v.y, decimals)},${quantize(v.z, decimals)}`;
}

function edgeKey(a: number, b: number): string {
  // Edge unordered : toujours mettre le plus petit index en premier.
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function triangleKey(a: number, b: number, c: number): string {
  // Triangle ordered (preserve winding pour détecter duplicates exacts).
  return `${a}|${b}|${c}`;
}

function triangleArea(a: Vec3, b: Vec3, c: Vec3): number {
  // Aire = 0.5 * |(b-a) × (c-a)|
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
}

/**
 * Vérifie qu'une géométrie est watertight (2-manifold fermé).
 *
 * @param geo BufferGeometry à tester. Doit avoir un attribut `position`.
 * @param decimals Précision de quantification des positions (default 4 → 0.0001 mm).
 * @param areaEpsilon Aire minimale pour un triangle non-dégénéré (default 1e-6).
 */
export function verifyWatertight(
  geo: THREE.BufferGeometry,
  decimals = 4,
  areaEpsilon = 1e-6,
): WatertightReport {
  const pos = geo.getAttribute('position');
  if (!pos) {
    return {
      manifold: false,
      triangleCount: 0,
      vertexCount: 0,
      edges2: 0,
      boundaryEdges: 0,
      nonManifoldEdges: 0,
      degenerateTriangles: 0,
      duplicateTriangles: 0,
      samples: ['no position attribute'],
    };
  }

  // Étape 1 : quantifier les positions + construire un index vers des sommets uniques.
  const keyToIndex = new Map<string, number>();
  const uniqueVerts: Vec3[] = [];
  // vertexIndex[i] = index canonique du sommet `i` dans uniqueVerts
  const vertexIndex: number[] = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const v: Vec3 = { x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) };
    const k = vertexKey(v, decimals);
    let idx = keyToIndex.get(k);
    if (idx === undefined) {
      idx = uniqueVerts.length;
      keyToIndex.set(k, idx);
      uniqueVerts.push(v);
    }
    vertexIndex[i] = idx;
  }

  // Étape 2 : parcourir les triangles (via index si présent, sinon par 3 sommets).
  const index = geo.getIndex();
  const triCount = index ? index.count / 3 : pos.count / 3;
  const edgeMap = new Map<string, number>();  // edgeKey → count
  const triSet = new Set<string>();
  let degenerateCount = 0;
  let duplicateCount = 0;
  const samples: string[] = [];
  const addSample = (msg: string): void => {
    if (samples.length < 5) samples.push(msg);
  };

  for (let ti = 0; ti < triCount; ti++) {
    let i0: number, i1: number, i2: number;
    if (index) {
      i0 = index.getX(ti * 3);
      i1 = index.getX(ti * 3 + 1);
      i2 = index.getX(ti * 3 + 2);
    } else {
      i0 = ti * 3;
      i1 = ti * 3 + 1;
      i2 = ti * 3 + 2;
    }
    const a = uniqueVerts[vertexIndex[i0]!]!;
    const b = uniqueVerts[vertexIndex[i1]!]!;
    const c = uniqueVerts[vertexIndex[i2]!]!;

    // Aire
    const area = triangleArea(a, b, c);
    if (area < areaEpsilon) {
      degenerateCount += 1;
      addSample(`degenerate triangle ti=${ti} area=${area.toExponential(2)}`);
      continue;
    }

    // Duplicate detect (sur indices canoniques)
    const va = vertexIndex[i0]!;
    const vb = vertexIndex[i1]!;
    const vc = vertexIndex[i2]!;
    const tk = triangleKey(va, vb, vc);
    if (triSet.has(tk)) {
      duplicateCount += 1;
      addSample(`duplicate triangle ti=${ti} key=${tk}`);
    } else {
      triSet.add(tk);
    }

    // Edges (non-orientés)
    const e0 = edgeKey(va, vb);
    const e1 = edgeKey(vb, vc);
    const e2 = edgeKey(vc, va);
    for (const e of [e0, e1, e2]) {
      edgeMap.set(e, (edgeMap.get(e) ?? 0) + 1);
    }
  }

  let edges2 = 0, boundaryEdges = 0, nonManifoldEdges = 0;
  for (const [e, count] of edgeMap) {
    if (count === 2) edges2 += 1;
    else if (count === 1) {
      boundaryEdges += 1;
      addSample(`boundary edge ${e} (1 triangle)`);
    } else if (count >= 3) {
      nonManifoldEdges += 1;
      addSample(`non-manifold edge ${e} (${count} triangles)`);
    }
  }

  const manifold = boundaryEdges === 0 && nonManifoldEdges === 0 && degenerateCount === 0 && duplicateCount === 0;

  return {
    manifold,
    triangleCount: triCount,
    vertexCount: uniqueVerts.length,
    edges2,
    boundaryEdges,
    nonManifoldEdges,
    degenerateTriangles: degenerateCount,
    duplicateTriangles: duplicateCount,
    samples,
  };
}
