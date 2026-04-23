import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildDecoGeoVector,
  buildDecoGeoHeightmap,
  placeDecoOnPanel,
  buildPanelClipPlanes,
} from '../src/index.js';
import type { ParsedShape, DecoCtx } from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function triangleCount(geo: THREE.BufferGeometry): number {
  const idx = geo.getIndex();
  if (idx) return idx.count / 3;
  const pos = geo.getAttribute('position');
  if (!pos) return 0;
  return pos.count / 3;
}

function computeBbox(geo: THREE.BufferGeometry): { min: [number, number, number]; max: [number, number, number] } {
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  return {
    min: [b.min.x, b.min.y, b.min.z],
    max: [b.max.x, b.max.y, b.max.z],
  };
}

// Contexte minimal valide pour placeDecoOnPanel / buildPanelClipPlanes
const MINIMAL_CTX: DecoCtx = {
  W: 160, Wtop: 160, Wbot: 160,
  wallH: 220, wallHreal: 220,
  rH: 56, sideD: 136, T: 12,
  sL: 134, sL_L: 146, sL_R: 134,
  rL: 220, bev: 8.4,
  ridge: 'left', taperX: 0, alpha: 0,
};

// ---------------------------------------------------------------------------
// buildDecoGeoVector
// ---------------------------------------------------------------------------

describe('buildDecoGeoVector', () => {
  it('retourne une BufferGeometry non-vide pour un triangle', () => {
    const triangle: ParsedShape = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    const bbox = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const geo = buildDecoGeoVector([triangle], bbox, 20, 20, 2, 0);

    expect(geo).toBeInstanceOf(THREE.BufferGeometry);
    expect(triangleCount(geo)).toBeGreaterThan(0);
  });

  it('bbox cohérente (min < max sur chaque axe)', () => {
    const triangle: ParsedShape = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    const bbox = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const geo = buildDecoGeoVector([triangle], bbox, 20, 20, 2, 0);

    const b = computeBbox(geo);
    expect(b.min[0]).toBeLessThan(b.max[0]);
    expect(b.min[1]).toBeLessThan(b.max[1]);
    expect(b.min[2]).toBeLessThanOrEqual(b.max[2]);
  });

  it('retourne une BufferGeometry vide si bbox dégénérée', () => {
    const triangle: ParsedShape = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    const bbox = { minX: 0, minY: 0, maxX: 0, maxY: 0 }; // bw=0 bh=0
    const geo = buildDecoGeoVector([triangle], bbox, 20, 20, 2, 0);
    // La géométrie est vide (BufferGeometry par défaut) car on retourne tôt
    expect(geo).toBeInstanceOf(THREE.BufferGeometry);
    expect(triangleCount(geo)).toBe(0);
  });

  it('retourne une BufferGeometry vide pour shapes=[]', () => {
    const bbox = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const geo = buildDecoGeoVector([], bbox, 20, 20, 2, 0);
    expect(geo).toBeInstanceOf(THREE.BufferGeometry);
    expect(triangleCount(geo)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildDecoGeoHeightmap
// ---------------------------------------------------------------------------

describe('buildDecoGeoHeightmap', () => {
  it('retourne une BufferGeometry non-vide pour un bitmap 16×16 (minimum valide)', () => {
    const res = 16;
    const data = new Uint8ClampedArray(res * res * 4);
    // Gradient simple
    for (let i = 0; i < res * res; i++) {
      data[i * 4]     = (i * 30) % 256;
      data[i * 4 + 1] = (i * 30) % 256;
      data[i * 4 + 2] = (i * 30) % 256;
      data[i * 4 + 3] = 255;
    }

    const geo = buildDecoGeoHeightmap(data, res, 10, 10, 2, false);
    expect(geo).toBeInstanceOf(THREE.BufferGeometry);
    expect(triangleCount(geo)).toBeGreaterThan(0);
  });

  it('throws TypeError si heightmapResolution < 16 (hors plage [16,128])', () => {
    // Contrat v0.1.0 (amendement P1.2.α) : heightmapResolution doit être
    // un entier dans [16, 128]. En dehors, lectures hors-bornes silencieuses
    // possibles sur heightmapData → fail-fast.
    const data = new Uint8ClampedArray(8 * 8 * 4).fill(128);
    expect(() => buildDecoGeoHeightmap(data, 8, 10, 10, 2, false)).toThrow(TypeError);
  });

  it('throws TypeError si heightmapResolution > 128', () => {
    const res = 256;
    const data = new Uint8ClampedArray(res * res * 4).fill(128);
    expect(() => buildDecoGeoHeightmap(data, res, 10, 10, 2, false)).toThrow(TypeError);
  });

  it('triangle count pour res=16 (minimum valide) = 512', () => {
    // PlaneGeometry(w, h, 16, 16) = 16×16×2 = 512 tris
    const res = 16;
    const data = new Uint8ClampedArray(res * res * 4).fill(128);
    const geo = buildDecoGeoHeightmap(data, res, 10, 10, 2, false);
    expect(triangleCount(geo)).toBe(512);
  });

  it('invert=true flip la direction du relief (deboss : pixels sombres creusent)', () => {
    const res = 16;
    const data = new Uint8ClampedArray(res * res * 4).fill(0); // tout noir
    data.forEach((_, i) => { if (i % 4 === 3) data[i] = 255; }); // alpha=255

    const geoNormal = buildDecoGeoHeightmap(data, res, 10, 10, 2, false);
    const geoInverted = buildDecoGeoHeightmap(data, res, 10, 10, 2, true);

    const bboxNormal = computeBbox(geoNormal);
    const bboxInverted = computeBbox(geoInverted);

    // Sans invert (emboss) : tout noir → h01=1 → Z=+depth=+2 (relief sort)
    expect(bboxNormal.max[2]).toBeCloseTo(2, 5);
    expect(bboxNormal.min[2]).toBeCloseTo(2, 5);
    // Avec invert (deboss) : tout noir → h01=1 → Z=-depth=-2 (relief creuse)
    expect(bboxInverted.max[2]).toBeCloseTo(-2, 5);
    expect(bboxInverted.min[2]).toBeCloseTo(-2, 5);
  });

  it('throws TypeError si heightmapResolution <= 0 (covered par la borne [16, 128])', () => {
    const data = new Uint8ClampedArray(0);
    expect(() => buildDecoGeoHeightmap(data, 0, 10, 10, 2, false)).toThrow(TypeError);
    expect(() => buildDecoGeoHeightmap(data, -1, 10, 10, 2, false)).toThrow(TypeError);
  });

  it('throws TypeError si heightmapResolution non-entier (ex: 16.5)', () => {
    // Number.isInteger(16.5) === false
    const data = new Uint8ClampedArray(16 * 16 * 4); // taille arbitraire, peu importe ici
    expect(() => buildDecoGeoHeightmap(data, 16.5, 10, 10, 2, false)).toThrow(TypeError);
  });

  it('throws TypeError si heightmapData.length !== res²×4 (res valide, longueur fausse)', () => {
    // res=16 passe le guard [16,128], mais length=10 est incohérent avec 16²×4=1024.
    // Teste bien le check de longueur spécifique (pas le guard de range).
    const data = new Uint8ClampedArray(10);
    expect(() => buildDecoGeoHeightmap(data, 16, 10, 10, 2, false)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// placeDecoOnPanel
// ---------------------------------------------------------------------------

describe('placeDecoOnPanel', () => {
  function makeQuadGeo(): THREE.BufferGeometry {
    // Quad centré en (0,0,0) dans le plan XY — 2 triangles
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array([
      -5, -5, 0,   5, -5, 0,   5,  5, 0,
      -5, -5, 0,   5,  5, 0,  -5,  5, 0,
    ]);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return geo;
  }

  it('translate le panneau front (les positions changent)', () => {
    const geo = makeQuadGeo();
    const posBefore = Array.from(geo.getAttribute('position').array as Float32Array);

    placeDecoOnPanel(geo, 'front', { rotation: 0, posX: 50, posY: 50 }, MINIMAL_CTX);

    const posAfter = Array.from(geo.getAttribute('position').array as Float32Array);
    // Les positions doivent avoir changé (translate appliqué)
    expect(posAfter).not.toEqual(posBefore);
  });

  it('translate le panneau back (les positions changent)', () => {
    const geo = makeQuadGeo();
    const posBefore = Array.from(geo.getAttribute('position').array as Float32Array);

    placeDecoOnPanel(geo, 'back', { rotation: 0, posX: 50, posY: 50 }, MINIMAL_CTX);

    const posAfter = Array.from(geo.getAttribute('position').array as Float32Array);
    expect(posAfter).not.toEqual(posBefore);
  });

  it('translate le panneau left (les positions changent)', () => {
    const geo = makeQuadGeo();
    const posBefore = Array.from(geo.getAttribute('position').array as Float32Array);

    placeDecoOnPanel(geo, 'left', { rotation: 0, posX: 50, posY: 50 }, MINIMAL_CTX);

    const posAfter = Array.from(geo.getAttribute('position').array as Float32Array);
    expect(posAfter).not.toEqual(posBefore);
  });

  it('rotation non-nulle applique une rotation avant translate', () => {
    const geo1 = makeQuadGeo();
    const geo2 = makeQuadGeo();

    placeDecoOnPanel(geo1, 'front', { rotation: 0, posX: 50, posY: 50 }, MINIMAL_CTX);
    placeDecoOnPanel(geo2, 'front', { rotation: 45, posX: 50, posY: 50 }, MINIMAL_CTX);

    const pos1 = Array.from(geo1.getAttribute('position').array as Float32Array);
    const pos2 = Array.from(geo2.getAttribute('position').array as Float32Array);
    expect(pos1).not.toEqual(pos2);
  });
});

// ---------------------------------------------------------------------------
// buildPanelClipPlanes
// ---------------------------------------------------------------------------

describe('buildPanelClipPlanes', () => {
  it('retourne 5 plans pour panelKey=front', () => {
    const planes = buildPanelClipPlanes('front', MINIMAL_CTX, [0, 0, 68], [0, 0, 0]);
    expect(Array.isArray(planes)).toBe(true);
    expect(planes.length).toBe(5);
    planes.forEach(p => expect(p).toBeInstanceOf(THREE.Plane));
  });

  it('retourne 5 plans pour panelKey=back', () => {
    const planes = buildPanelClipPlanes('back', MINIMAL_CTX, [0, 0, -80], [0, 0, 0]);
    expect(planes.length).toBe(5);
  });

  it('retourne 4 plans pour panelKey=left', () => {
    const planes = buildPanelClipPlanes('left', MINIMAL_CTX, [0, 0, 0], [0, 0, 0]);
    expect(planes.length).toBe(4);
    planes.forEach(p => expect(p).toBeInstanceOf(THREE.Plane));
  });

  it('retourne 4 plans pour panelKey=right', () => {
    const planes = buildPanelClipPlanes('right', MINIMAL_CTX, [0, 0, 0], [0, 0, 0]);
    expect(planes.length).toBe(4);
  });

  it('retourne 4 plans pour panelKey=roofL', () => {
    const planes = buildPanelClipPlanes('roofL', MINIMAL_CTX, [0, 276, 0], [0, 0, 0.61]);
    expect(planes.length).toBe(4);
    planes.forEach(p => expect(p).toBeInstanceOf(THREE.Plane));
  });

  it('retourne 4 plans pour panelKey=roofR', () => {
    const planes = buildPanelClipPlanes('roofR', MINIMAL_CTX, [0, 276, 0], [0, 0, -0.61]);
    expect(planes.length).toBe(4);
  });

  it('retourne un tableau vide pour panelKey inconnu', () => {
    const planes = buildPanelClipPlanes('unknown', MINIMAL_CTX, [0, 0, 0], [0, 0, 0]);
    expect(planes).toEqual([]);
  });
});
