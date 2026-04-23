// Capture des fixtures de référence pour P1.0 + P1.2.β.
// Usage : node capture-reference.mjs [letter]
// Sans argument, capture les 5 presets (A, B, C, D, E).
//
// A/B/C : capture depuis `src/*` modular refactor (parité visuelle v15 établie).
// D/E   : **capture mixte TS+src** (voir `source` field des fixtures pour le détail) :
//         - `createInitialState` + `buildPanelDefs` (+ STL house/door/zip dérivés)
//           → TS port (`dist/`). Raison : src.buildDecoGeo heightmap branch utilise
//           `document.createElement('canvas')` → non-exécutable en Node.
//         - `computeCalculations` + `computeCutList` + `computeCutLayout`
//           (+ `planSvg` dérivé) → src/*. Raison : parité src↔TS prouvée à 1e-6
//           en P1.1, donc numériquement équivalent ; on conserve l'import src
//           par inertie (cf. usePort n'est consulté que pour state+panelDefs).
//         D/E sont des snapshots de régression du port, pas des références
//         indépendantes vs v15.
//
// Sortie : preset{A,B,C,D,E}.snapshot.json dans le même dossier.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../../');
const CORE_NODE_MODULES = path.resolve(__dirname, '../../node_modules');

// ─── 1. Attacher THREE et JSZip à globalThis ─────────────────────────────────
const THREE = await import(path.join(CORE_NODE_MODULES, 'three/build/three.cjs'));
const JSZipModule = await import(path.join(CORE_NODE_MODULES, 'jszip/dist/jszip.min.js'));
globalThis.THREE = THREE;
globalThis.JSZip = JSZipModule.default;

// ─── 2. Importer les modules src/ (référence pour A/B/C) ────────────────────
const { createInitialState, DECO_KEYS } = await import(path.join(ROOT, 'src/state.js'));
const { computeCalculations, computeCutList } = await import(path.join(ROOT, 'src/calculations.js'));
const { computeCutLayout } = await import(path.join(ROOT, 'src/cut-plan.js'));
const { buildPanelDefs } = await import(path.join(ROOT, 'src/geometry/panels.js'));

// ─── 2b. TS port (pour D/E — D requiert DOM pour heightmap branch,
// pas disponible en Node ; E pourrait utiliser src mais on uniformise sur TS
// pour garder une seule source de vérité par fixture) ─────────────────────
const TS_DIST = path.resolve(__dirname, '../../dist');
const { createInitialState: tsCreateInitialState } = await import(path.join(TS_DIST, 'state.js'));
const { buildPanelDefs: tsBuildPanelDefs } = await import(path.join(TS_DIST, 'geometry/panels.js'));
const { computeCutLayout: tsComputeCutLayout } = await import(path.join(TS_DIST, 'cut-plan.js'));
const { _applyPrintTransform: applyPrintTransform } = await import(path.join(TS_DIST, 'exporters/stl.js'));

// ─── 3. Définitions des presets ──────────────────────────────────────────────
const PRESETS = [
  {
    letter: 'A',
    name: 'default',
    description: 'État initial exact — aucun override.',
    overrides: {},
  },
  {
    letter: 'B',
    name: 'pentagon-door-tapered',
    description: 'Façade évasée avec porte pentagone, perchoir, toit ridge left.',
    overrides: {
      W: 180, H: 260, D: 160,
      taperX: -20,
      door: 'pentagon', doorW: 45, doorH: 60, doorFollowTaper: true,
      perch: true, perchDiam: 8, perchLen: 30, perchOff: 15,
    },
  },
  {
    letter: 'C',
    name: 'steep-miter',
    description: 'Pente forte, toit en onglet (miter), surplomb 50mm, épaisseur 18mm.',
    overrides: {
      slope: 60, ridge: 'miter', overhang: 50, T: 18,
    },
  },
  {
    letter: 'D',
    name: 'pose-heightmap-deco',
    description: 'floor=pose, ridge=right, déco heightmap 64×64 procédurale sur front. Capturé depuis TS port (src requiert DOM pour la branche heightmap).',
    usePort: true,
    overrides: { floor: 'pose', ridge: 'right' },
    setupDecos: (state) => {
      // Heightmap procédurale : gradient radial 64×64, déterministe
      const res = 64;
      const buf = new Uint8ClampedArray(res * res * 4);
      for (let y = 0; y < res; y++) {
        for (let x = 0; x < res; x++) {
          const cx = res / 2, cy = res / 2;
          const dx = x - cx, dy = y - cy;
          const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (res / 2));
          const v = Math.round((1 - dist) * 255);
          const i = (y * res + x) * 4;
          buf[i] = v; buf[i + 1] = v; buf[i + 2] = v; buf[i + 3] = 255;
        }
      }
      Object.assign(state.decos.front, {
        enabled: true,
        source: 'synthetic://heightmap-radial-64',
        sourceType: 'image',
        mode: 'heightmap',
        heightmapData: buf,
        heightmapResolution: res,
        resolution: res,
        w: 80, h: 80, posX: 50, posY: 50,
        rotation: 0, depth: 3, bevel: 0, invert: false,
      });
    },
  },
  {
    letter: 'E',
    name: 'all-decos-vector',
    description: 'ridge=left, doorPanel=true, décos vectorielles (triangle) sur les 4 panneaux latéraux. Capturé depuis TS port.',
    usePort: true,
    overrides: {
      ridge: 'left',
      door: 'round', doorW: 40, doorH: 40, doorPanel: true,
    },
    setupDecos: (state) => {
      // Triangle équilatéral simple, coordonnées dans un repère local 20×20.
      const triangle = [
        { x: 2, y: 2 }, { x: 18, y: 2 }, { x: 10, y: 18 },
      ];
      const bbox = { minX: 2, minY: 2, maxX: 18, maxY: 18 };
      for (const k of ['front', 'back', 'left', 'right']) {
        Object.assign(state.decos[k], {
          enabled: true,
          source: 'synthetic://triangle',
          sourceType: 'svg',
          mode: 'vector',
          parsedShapes: [triangle],
          bbox,
          w: 40, h: 40, posX: 50, posY: 50,
          rotation: 0, depth: 1.5, bevel: 0, invert: false,
          clipToPanel: false,
        });
      }
    },
  },
];

// ─── 4. Helpers STL (logique extraite de src/exporters/stl.js, sans DOM) ─────

/**
 * Extrait les triangles d'une BufferGeometry en appliquant pos+rot de base.
 * Equivalent de meshTriangles() mais travaille sur la geometry directement
 * (pas de mesh Three.js — on reconstructe la matrice depuis pos/rot).
 */
function geometryTriangles(geo, basePos, baseRot) {
  const tmp = new THREE.Object3D();
  tmp.position.set(basePos[0], basePos[1], basePos[2]);
  tmp.rotation.set(baseRot[0], baseRot[1], baseRot[2]);
  tmp.updateMatrixWorld(true);
  const mx = tmp.matrixWorld;

  const posAttr = geo.getAttribute('position');
  const idx = geo.getIndex();
  const nf = idx ? idx.count / 3 : posAttr.count / 3;
  const tris = [];

  for (let i = 0; i < nf; i++) {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
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
    const ba = new THREE.Vector3().subVectors(b, a);
    const ca = new THREE.Vector3().subVectors(c, a);
    const n = new THREE.Vector3().crossVectors(ba, ca).normalize();
    tris.push({ n, a, b, c });
  }
  return tris;
}

/**
 * Encode une liste de triangles en STL binaire.
 * Equivalent de trisToSTL() sans dépendance DOM.
 */
function trisToSTL(tris, label) {
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
  return buf;
}

const HOUSE_KEYS = ['front', 'back', 'left', 'right', 'bottom', 'roofL', 'roofR', 'perch'];
const DECO_STL_KEYS = ['deco_front', 'deco_back', 'deco_left', 'deco_right', 'deco_roofL', 'deco_roofR'];
// exportHouseSTL de src/exporters/stl.js:138 collecte HOUSE_KEYS ∪ DECO_STL_KEYS.
const HOUSE_AND_DECO_KEYS = [...HOUSE_KEYS, ...DECO_STL_KEYS];
const DOOR_KEYS = ['doorPanel'];

/**
 * Collecte les triangles de panneaux désignés par clé depuis les defs.
 * Accepte les defs normalisées en objet {key, geometry, basePos, baseRot, ...}.
 */
function collectDefsTriangles(defs, keys) {
  const tris = [];
  for (const def of defs) {
    if (keys.includes(def.key)) {
      tris.push(...geometryTriangles(def.geometry, def.basePos, def.baseRot));
    }
  }
  return tris;
}

// ─── 5. Helper bbox sur BufferGeometry ───────────────────────────────────────

function computeGeoBbox(geo) {
  const posAttr = geo.getAttribute('position');
  if (!posAttr || posAttr.count === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

function geoTriangleCount(geo) {
  const idx = geo.getIndex();
  const pos = geo.getAttribute('position');
  return idx ? idx.count / 3 : pos.count / 3;
}

// ─── 6. Helper SVG (logique extraite de src/exporters/plan.js, sans DOM) ─────

// Import t() depuis i18n pour les noms de pièces dans le SVG
const { t } = await import(path.join(ROOT, 'src/i18n.js'));

// NOTE post-P1 : buildSVGString aggregate les N panneaux pour continuer à
// produire UNE chaîne SVG à fin de métriques (polygonCount, rectCount,
// textCount). Le format agrégé n'est PAS le format d'export final —
// l'export runtime produit un ZIP multi-SVG. On conserve l'agrégation ici
// uniquement pour que le champ `planSvg` de la fixture reste comparable.
function buildSVGString(layout) {
  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg">\n`;
  for (const panel of layout.panels) {
    svg += buildPanelSVG(panel);
  }
  svg += '</svg>\n';
  return svg;
}

function buildPanelSVG(panel) {
  const { pieces, shW, shH } = panel;
  let svg = `<g>`;
  svg += `<rect x="0" y="0" width="${shW}" height="${shH}" fill="none" stroke="#000" stroke-width="1"/>\n`;

  for (let g = 200; g < shW; g += 200) {
    svg += `<line x1="${g}" y1="0" x2="${g}" y2="${shH}" stroke="#ddd" stroke-width="0.3"/>\n`;
  }
  for (let g = 200; g < shH; g += 200) {
    svg += `<line x1="0" y1="${g}" x2="${shW}" y2="${g}" stroke="#ddd" stroke-width="0.3"/>\n`;
  }

  pieces.forEach(p => {
    if (p.px === undefined) return;
    const x = p.px, y = p.py, w = p.w, h = p.h;
    const stroke = '#000';
    const fill = p.color + '40';

    if (p.shape === 'pent' && !p.rot) {
      const wHs = p.wallH;
      const Wb = p.Wbot || p.w;
      const Wt = p.Wtop || p.w;
      const inset = (Wb - Wt) / 2;
      const pts = [
        [x,              y + h],
        [x + Wb,         y + h],
        [x + Wb - inset, y + h - wHs],
        [x + Wb / 2,     y],
        [x + inset,      y + h - wHs],
      ];
      svg += `<polygon points="${pts.map(pt => pt.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>\n`;
    } else {
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>\n`;
    }

    const origW = p.rot ? p.h : p.w;
    const origH = p.rot ? p.w : p.h;
    const cx = x + w / 2, cy = y + h / 2;
    const fs = Math.min(20, Math.max(8, w * 0.08));
    const name = t(p.nameKey) + (p.suffix || '');
    svg += `<text x="${cx}" y="${cy - fs * 0.5}" font-family="sans-serif" font-size="${fs}" text-anchor="middle" fill="#000">${name}</text>\n`;
    svg += `<text x="${cx}" y="${cy + fs * 0.8}" font-family="sans-serif" font-size="${fs * 0.8}" text-anchor="middle" fill="#555">${Math.round(origW)}×${Math.round(origH)} mm</text>\n`;
    if (p.rot) {
      svg += `<text x="${cx}" y="${cy + fs * 2}" font-family="sans-serif" font-size="${fs * 0.7}" text-anchor="middle" fill="#888">${t('plan.rotated')}</text>\n`;
    }
  });

  svg += `</g>`;
  return svg;
}

function countSVGElements(svgStr) {
  const polygonCount = (svgStr.match(/<polygon /g) || []).length;
  const rectCount = (svgStr.match(/<rect /g) || []).length;
  const textCount = (svgStr.match(/<text /g) || []).length;
  return { polygonCount, rectCount, textCount };
}

// ─── 7. Sérialisation sûre de l'état ─────────────────────────────────────────

/**
 * Sérialise NichoirState en enlevant les champs non-JSON-serializable.
 *
 * Cas A/B/C (forme src JS) :
 *   - decos[k].shapes (THREE.Shape[]) → exclu (non-sérialisable)
 *   - decos[k].rasterCanvas (HTMLCanvasElement) → exclu (non-sérialisable)
 *
 * Cas D/E (forme TS DecoSlotCore) :
 *   - decos[k].parsedShapes (Pt2[][]) → gardé, JSON-compatible
 *   - decos[k].heightmapData (Uint8ClampedArray) → converti en Array (sinon JSON.stringify retourne {})
 *   - decos[k].heightmapResolution (number) → gardé
 */
function serializeState(state) {
  const DECO_KEYS_LIST = ['front', 'back', 'left', 'right', 'roofL', 'roofR'];

  const safeDecos = {};
  for (const k of DECO_KEYS_LIST) {
    const d = state.decos[k];
    const base = {
      enabled: d.enabled,
      source: d.source,
      sourceType: d.sourceType,
      bbox: d.bbox,
      mode: d.mode,
      w: d.w, h: d.h, posX: d.posX, posY: d.posY, rotation: d.rotation,
      depth: d.depth, bevel: d.bevel, invert: d.invert, resolution: d.resolution,
      clipToPanel: d.clipToPanel,
      lastParseWarning: d.lastParseWarning,
    };

    // Champs TS DecoSlotCore (présents en D/E, absents en A/B/C)
    if (d.parsedShapes !== undefined) base.parsedShapes = d.parsedShapes;
    if (d.heightmapData !== undefined && d.heightmapData !== null) {
      // Uint8ClampedArray → Array pour JSON.stringify
      base.heightmapData = Array.from(d.heightmapData);
    } else if ('heightmapData' in d) {
      base.heightmapData = null;
    }
    if (d.heightmapResolution !== undefined) base.heightmapResolution = d.heightmapResolution;

    safeDecos[k] = base;
  }

  return {
    params: { ...state.params },
    clip: {
      x: { ...state.clip.x },
      y: { ...state.clip.y },
      z: { ...state.clip.z },
    },
    camera: { ...state.camera },
    decos: safeDecos,
    activeDecoKey: state.activeDecoKey,
    lang: state.lang,
    activeTab: state.activeTab,
  };
}

// ─── 8. Capture d'un preset ───────────────────────────────────────────────────

/**
 * Normalise une def buildPanelDefs sous forme d'objet {key, geometry, basePos, ...}
 * que la def soit un tuple (sortie src JS) ou un objet (sortie TS port).
 */
function normalizeDef(def) {
  if (Array.isArray(def)) {
    return {
      key: def[0], geometry: def[1], basePos: def[2], baseRot: def[3],
      color: def[4], explodeDir: def[5], extraClips: def[6] ?? null,
    };
  }
  return def; // déjà un objet (TS port)
}

async function capturePreset(preset) {
  console.log(`\n[Preset ${preset.letter}] ${preset.name}`);

  // ── Sélection du backend (src ou TS port) ──
  const useTsPort = !!preset.usePort;
  const createState = useTsPort ? tsCreateInitialState : createInitialState;
  const doBuildPanelDefs = useTsPort ? tsBuildPanelDefs : buildPanelDefs;

  // Construire l'état
  const state = createState();
  Object.assign(state.params, preset.overrides);
  if (preset.setupDecos) preset.setupDecos(state);

  const params = state.params;

  // ── Calculations (sans DOM, src fonctionne partout) ──
  console.log(`  → computeCalculations...`);
  const calcResult = computeCalculations(params);
  const { volumes, surfaces, derived } = calcResult;

  // ── Cut list ──
  console.log(`  → computeCutList...`);
  const cutListResult = computeCutList(params, derived);

  // ── Cut layout ──
  // NOTE post-P1 : on capture depuis TS port pour tous les presets (A..E).
  // Raison : le contrat multi-bin est défini côté TS ; src/cut-plan.js reste
  // en single-bin (legacy, parité v15 préservée).
  console.log(`  → computeCutLayout (TS port multi-bin)...`);
  const cutLayout = tsComputeCutLayout(params);

  // ── Panel defs (géométries 3D) — branching src / TS selon preset ──
  console.log(`  → buildPanelDefs (${useTsPort ? 'TS port' : 'src/*'})...`);
  const buildResult = doBuildPanelDefs(state);
  const { defs: rawDefs } = buildResult;

  // Normaliser tuples (src) ou objets (TS) vers objets uniformes
  const defs = rawDefs.map(normalizeDef);

  // ── panelDefsNormalized ──
  console.log(`  → normalizing panel defs (${defs.length} defs)...`);
  const panelDefsNormalized = defs.map(def => {
    const { key, geometry, basePos, baseRot, color, extraClips } = def;
    const bbox = computeGeoBbox(geometry);
    const triangleCount = geoTriangleCount(geometry);
    return {
      key,
      triangleCount,
      bbox,
      basePos: [basePos[0], basePos[1], basePos[2]],
      baseRot: [baseRot[0], baseRot[1], baseRot[2]],
      color,
      hasExtraClips: extraClips != null && extraClips.length > 0,
    };
  });

  // ── STL house ──
  console.log(`  → generating STL house...`);
  let stlHouse = null;
  {
    let tris = collectDefsTriangles(defs, HOUSE_AND_DECO_KEYS);
    tris = applyPrintTransform(tris); // Y-up → Z-up + min Z=0 (parité avec stl.ts)
    if (tris.length > 0) {
      const buf = trisToSTL(tris, 'maison_complete');
      // Calculer la bbox agrégée depuis les triangles transformés
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (const tri of tris) {
        for (const v of [tri.a, tri.b, tri.c]) {
          if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
          if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
          if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
        }
      }
      stlHouse = {
        byteLength: buf.byteLength,
        triangleCount: tris.length,
        aggregateBbox: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
      };
    }
  }

  // ── STL door ──
  console.log(`  → generating STL door...`);
  let stlDoor = null;
  {
    let tris = collectDefsTriangles(defs, DOOR_KEYS);
    tris = applyPrintTransform(tris); // Y-up → Z-up + min Z=0 (parité avec stl.ts)
    if (tris.length > 0) {
      const buf = trisToSTL(tris, 'porte');
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (const tri of tris) {
        for (const v of [tri.a, tri.b, tri.c]) {
          if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
          if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
          if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
        }
      }
      stlDoor = {
        byteLength: buf.byteLength,
        triangleCount: tris.length,
        aggregateBbox: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
      };
    }
  }

  // ── Panels ZIP ──
  console.log(`  → generating panels ZIP...`);
  let panelsZip = null;
  {
    const zip = new globalThis.JSZip();
    // exportPanelsZIP de src/exporters/stl.js:156-169 : pour chaque panel key de
    // HOUSE_KEYS, collecte la geom du panneau + la déco associée (deco_<key> si k ∈ DECO_KEYS)
    // puis zippe le tout sous un même fichier STL. On reproduit cette politique.
    const DECO_KEYS_SET = new Set(['front', 'back', 'left', 'right', 'roofL', 'roofR']);
    const allKeys = [...HOUSE_KEYS];
    if (params.door !== 'none' && params.doorPanel) allKeys.push('doorPanel');

    const entries = [];
    for (const key of allKeys) {
      const collectKeys = [key];
      if (DECO_KEYS_SET.has(key)) collectKeys.push('deco_' + key);
      let tris = collectDefsTriangles(defs, collectKeys);
      tris = applyPrintTransform(tris); // Y-up → Z-up + min Z=0 (parité avec zip.ts)
      if (tris.length > 0) {
        const stlBuf = trisToSTL(tris, key);
        const fname = key + '.stl';
        zip.file(fname, stlBuf);
        entries.push({
          filename: fname,
          stlByteLength: stlBuf.byteLength,
          stlTriangleCount: tris.length,
        });
      }
    }

    if (entries.length > 0) {
      const zipBuf = await zip.generateAsync({ type: 'arraybuffer' });
      panelsZip = {
        byteLength: zipBuf.byteLength,
        entries,
      };
    }
  }

  // ── Plan SVG ──
  console.log(`  → generating plan SVG...`);
  const svgStr = buildSVGString(cutLayout);
  const svgBytes = Buffer.from(svgStr, 'utf8').byteLength;
  const { polygonCount, rectCount, textCount } = countSVGElements(svgStr);
  const planSvg = { byteLength: svgBytes, polygonCount, rectCount, textCount };

  // ── Assembler la fixture ──
  const fixture = {
    preset: preset.letter,
    name: preset.name,
    description: preset.description,
    // capturedAt retiré : rend les MD5 non-idempotents sans apporter de valeur comparative.
    // La date de capture est documentée dans README.md une fois par génération approuvée.
    source: useTsPort
      ? 'Capture mixte (TS port pour state+buildPanelDefs+STL+computeCutLayout ; src/* pour computeCalculations+computeCutList). Raison : src.buildDecoGeo heightmap branch DOM-bound ⇒ state+geometry doivent passer par TS ; computeCutLayout bascule sur TS port multi-bin (branche multi-bin, 2026-04-23). Snapshot de régression du port TS, pas référence indépendante vs v15.'
      : 'src/* modular refactor (visual parity with nichoir_v15.html established) + computeCutLayout depuis TS port multi-bin (branche multi-bin, 2026-04-23)',
    state: serializeState(state),
    reference: {
      calculations: {
        volumes,
        surfaces,
        derived,
      },
      cutList: cutListResult,
      cutLayout: {
        panels: cutLayout.panels,
        overflow: cutLayout.overflow,
        totalUsedArea: cutLayout.totalUsedArea,
        meanOccupation: cutLayout.meanOccupation,
      },
      panelDefsNormalized,
      stlHouse,
      stlDoor,
      panelsZip,
      planSvg,
    },
  };

  // ── Écrire le fichier ──
  const outPath = path.join(__dirname, `preset${preset.letter}.snapshot.json`);
  writeFileSync(outPath, JSON.stringify(fixture, null, 2), 'utf8');
  const fileSizeBytes = Buffer.from(JSON.stringify(fixture, null, 2), 'utf8').byteLength;

  console.log(`  ✓ preset${preset.letter}.snapshot.json écrit (${(fileSizeBytes / 1024).toFixed(1)} KB)`);
  console.log(`    volumes.ext = ${volumes.ext.toFixed(4)} mm³`);
  console.log(`    stlHouse.triangleCount = ${stlHouse ? stlHouse.triangleCount : 'null'}`);
  console.log(`    planSvg.polygonCount = ${polygonCount}`);

  return { letter: preset.letter, outPath, fileSizeBytes, volumes, stlHouse, planSvg };
}

// ─── 9. Main ──────────────────────────────────────────────────────────────────

const arg = process.argv[2];
const presetsToRun = arg
  ? PRESETS.filter(p => p.letter === arg.toUpperCase())
  : PRESETS;

if (presetsToRun.length === 0) {
  console.error(`Preset inconnu : ${arg}. Valeurs valides : A, B, C, D, E`);
  process.exit(1);
}

console.log(`Capture des fixtures de référence Nichoir (P1.0 + P1.2.β)`);
console.log(`ROOT = ${ROOT}`);
console.log(`Presets : ${presetsToRun.map(p => p.letter).join(', ')}`);

const results = [];
for (const preset of presetsToRun) {
  const r = await capturePreset(preset);
  results.push(r);
}

console.log('\n──────────────────────────────────────────────');
console.log('RÉSUMÉ');
for (const r of results) {
  console.log(`  Preset ${r.letter}: ${(r.fileSizeBytes / 1024).toFixed(1)} KB`);
  console.log(`    volumes.ext     = ${r.volumes.ext.toFixed(4)} mm³`);
  console.log(`    stlHouse.tris   = ${r.stlHouse ? r.stlHouse.triangleCount : 'null'}`);
  console.log(`    planSvg.polygons = ${r.planSvg.polygonCount}`);
}
console.log('──────────────────────────────────────────────');
console.log('Capture terminée.');
