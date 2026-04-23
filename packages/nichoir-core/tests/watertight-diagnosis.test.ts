// tests/watertight-diagnosis.test.ts
//
// Test diagnostic qui applique verifyWatertight à la géométrie produite par
// buildPanelDefs pour différentes configurations, afin d'identifier les cas
// qui produisent des meshes non-manifold.
//
// But : découvrir empiriquement les problèmes géométriques sans toucher au
// code qui fonctionne. Chaque échec = cible pour un fix ciblé.
//
// Ces tests sont EXPLORATOIRES — ils ne sont pas strictement "tout doit
// passer". L'idée est d'avoir une ligne de mesure pour savoir où on en est
// avant/après chaque intervention.

import { describe, it, expect } from 'vitest';
import { createInitialState, buildPanelDefs } from '../src/index.js';
import type { NichoirState, PanelDef } from '../src/index.js';
import { verifyWatertight } from './helpers/verify-watertight.js';

function findDef(defs: PanelDef[], key: string): PanelDef {
  const d = defs.find(x => x.key === key);
  if (!d) throw new Error(`PanelDef not found: ${key}`);
  return d;
}

function stateWith(partial: Partial<NichoirState['params']>): NichoirState {
  const s = createInitialState();
  s.params = { ...s.params, ...partial };
  return s;
}

describe('watertight diagnosis — ridge=left/right, hang=false (baseline, doit être manifold)', () => {
  it('roofL (ridge=left, hang=false)', () => {
    const state = stateWith({ ridge: 'left', hang: false });
    const { defs } = buildPanelDefs(state);
    const geo = findDef(defs, 'roofL').geometry;
    const report = verifyWatertight(geo);
    // Baseline : BoxGeometry → watertight par construction
    expect(report.triangleCount).toBeGreaterThan(0);
    expect(report.boundaryEdges).toBe(0);
    expect(report.nonManifoldEdges).toBe(0);
    expect(report.duplicateTriangles).toBe(0);
  });

  it('roofR (ridge=right, hang=false)', () => {
    const state = stateWith({ ridge: 'right', hang: false });
    const { defs } = buildPanelDefs(state);
    const geo = findDef(defs, 'roofR').geometry;
    const report = verifyWatertight(geo);
    expect(report.triangleCount).toBeGreaterThan(0);
    expect(report.boundaryEdges).toBe(0);
    expect(report.nonManifoldEdges).toBe(0);
    expect(report.duplicateTriangles).toBe(0);
  });
});

describe('watertight diagnosis — ridge=miter, hang=false (baseline, doit être manifold)', () => {
  it('roofL (ridge=miter, hang=false)', () => {
    const state = stateWith({ ridge: 'miter', hang: false });
    const { defs } = buildPanelDefs(state);
    const geo = findDef(defs, 'roofL').geometry;
    const report = verifyWatertight(geo);
    expect(report.triangleCount).toBeGreaterThan(0);
    expect(report.boundaryEdges).toBe(0);
    expect(report.nonManifoldEdges).toBe(0);
    expect(report.duplicateTriangles).toBe(0);
  });
});

describe('watertight diagnosis — ridge=left/right, hang=true (Shape+Path+Extrude)', () => {
  it('roofL (ridge=left, hang=true)', () => {
    const state = stateWith({ ridge: 'left', hang: true });
    const { defs } = buildPanelDefs(state);
    const geo = findDef(defs, 'roofL').geometry;
    const report = verifyWatertight(geo);
    // eslint-disable-next-line no-console
    console.log(`roofL ridge=left hang=true:`, report);
    expect(report.triangleCount).toBeGreaterThan(0);
    // On S'ATTEND à ce que ce cas soit manifold : buildRoofPanelWithHoles
    // produit un seul ExtrudeGeometry avec des trous Path → watertight by construction.
    expect(report.boundaryEdges).toBe(0);
    expect(report.nonManifoldEdges).toBe(0);
  });
});

describe('watertight — ridge=miter, hang=true (concatGeometries + weld opposing faces)', () => {
  // Avant le fix : les 2 pièces (corps principal + chamfer) partageaient une
  // face interne → 5 edges avec 4 triangles chacun. Le fix dans concatGeometries
  // détecte et supprime les triangles opposés (paire annulée), produisant un
  // mesh 2-manifold fermé.

  it('roofL (ridge=miter, hang=true) watertight', () => {
    const state = stateWith({ ridge: 'miter', hang: true });
    const { defs } = buildPanelDefs(state);
    const geo = findDef(defs, 'roofL').geometry;
    const report = verifyWatertight(geo);
    expect(report.triangleCount).toBeGreaterThan(0);
    expect(report.boundaryEdges, 'boundary edges = 0 (mesh fermé)').toBe(0);
    expect(report.nonManifoldEdges, 'non-manifold edges = 0 (pas de face interne)').toBe(0);
    expect(report.duplicateTriangles, 'no duplicate triangles').toBe(0);
  });

  it('roofR (ridge=miter, hang=true) watertight', () => {
    const state = stateWith({ ridge: 'miter', hang: true });
    const { defs } = buildPanelDefs(state);
    const geo = findDef(defs, 'roofR').geometry;
    const report = verifyWatertight(geo);
    expect(report.triangleCount).toBeGreaterThan(0);
    expect(report.boundaryEdges).toBe(0);
    expect(report.nonManifoldEdges).toBe(0);
    expect(report.duplicateTriangles).toBe(0);
  });
});

describe('watertight — déco avec invert flip (buildDecoGeoVector/Heightmap + flipGeoZ)', () => {
  // Le flipGeoZ appliqué quand invert=true : scale(1,1,-1) + reverse winding.
  // Cette opération préserve la topologie → le mesh reste watertight si
  // l'input l'était. Vérifie empiriquement.
  it('deco vector + invert=true est watertight', async () => {
    const { buildDecoGeoVector } = await import('../src/geometry/deco.js');
    const triangle = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 },
    ];
    const bbox = { minX: 0, minY: 0, maxX: 10, maxY: 8 };
    const geo = buildDecoGeoVector([triangle], bbox, 20, 20, 2, 0, true /* invert */);
    const report = verifyWatertight(geo);
    expect(report.triangleCount).toBeGreaterThan(0);
    expect(report.boundaryEdges).toBe(0);
    expect(report.nonManifoldEdges).toBe(0);
  });

  it('deco heightmap + invert=true est watertight', async () => {
    const { buildDecoGeoHeightmap } = await import('../src/geometry/deco.js');
    const res = 16;
    const data = new Uint8ClampedArray(res * res * 4);
    // Pattern simple : gradient
    for (let i = 0; i < res * res; i++) {
      const v = (i % res) * 16;
      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    const geo = buildDecoGeoHeightmap(data, res, 20, 20, 2, true /* invert */);
    const report = verifyWatertight(geo);
    expect(report.triangleCount).toBeGreaterThan(0);
    // PlaneGeometry is NOT watertight (pas de faces latérales) — c'est une
    // surface ouverte par conception. Vérifie juste qu'on n'a pas introduit
    // de duplicate ou de non-manifold edge > 2.
    expect(report.nonManifoldEdges, 'pas d\'edge partagé par > 2 triangles').toBe(0);
    expect(report.duplicateTriangles).toBe(0);
    // Boundary edges attendus (4 bords du plan) — non-watertight par nature.
  });
});

describe('watertight — toutes combinaisons ridge × hang (non-regression)', () => {
  const cases: Array<{ ridge: 'left' | 'right' | 'miter'; hang: boolean; keys: ('roofL' | 'roofR')[] }> = [
    { ridge: 'left',  hang: false, keys: ['roofL', 'roofR'] },
    { ridge: 'right', hang: false, keys: ['roofL', 'roofR'] },
    { ridge: 'miter', hang: false, keys: ['roofL', 'roofR'] },
    { ridge: 'left',  hang: true,  keys: ['roofL', 'roofR'] },
    { ridge: 'right', hang: true,  keys: ['roofL', 'roofR'] },
    { ridge: 'miter', hang: true,  keys: ['roofL', 'roofR'] },
  ];
  for (const c of cases) {
    for (const key of c.keys) {
      it(`${key} ridge=${c.ridge} hang=${c.hang} watertight`, () => {
        const state = stateWith({ ridge: c.ridge, hang: c.hang });
        const { defs } = buildPanelDefs(state);
        const geo = findDef(defs, key).geometry;
        const report = verifyWatertight(geo);
        expect(report.triangleCount).toBeGreaterThan(0);
        expect(report.boundaryEdges).toBe(0);
        expect(report.nonManifoldEdges).toBe(0);
      });
    }
  }
});
