import { readFileSync } from 'node:fs';
import init, {
  default_params_json,
  export_house_stl,
  export_house_obj,
  export_door_stl,
  export_panels_zip,
  mesh_report_json,
} from '../wasm/pkg/wasm.js';

await init({ module_or_path: readFileSync(new URL('../wasm/pkg/wasm_bg.wasm', import.meta.url)) });

const base = JSON.parse(default_params_json());
const presets = [
  ['default', {}],
  ['round-perch-door-panel', { door: 'round', perch: true, doorPanel: true }],
  ['square-door-panel', { door: 'square', doorPanel: true }],
  ['pentagon-door-panel', { door: 'pentagon', doorPanel: true, doorFollowTaper: true }],
  ['positive-taper-miter', { taperX: 35, ridge: 'miter', door: 'round', perch: true, doorPanel: true }],
  ['negative-taper-pose', { taperX: -25, floor: 'pose', door: 'pentagon', doorPanel: true, doorFollowTaper: true }],
];

let failures = 0;

function assertCase(ok, label, message) {
  if (!ok) {
    failures += 1;
    console.error(`FAIL ${label}: ${message}`);
  }
}

function assertBinaryStl(bytes, label, name) {
  assertCase(bytes.byteLength >= 84, label, `${name} STL too small`);
  if (bytes.byteLength < 84) return;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triCount = view.getUint32(80, true);
  const expected = 84 + triCount * 50;
  assertCase(bytes.byteLength === expected, label, `${name} STL byte size mismatch: got ${bytes.byteLength}, expected ${expected}`);
}

function edgeTopology(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triCount = view.getUint32(80, true);
  const edges = new Map();
  const q = (value) => Math.round(value * 1000);
  const pointKey = (x, y, z) => `${q(x)},${q(y)},${q(z)}`;
  let offset = 84;
  for (let i = 0; i < triCount; i += 1) {
    offset += 12;
    const pts = [];
    for (let j = 0; j < 3; j += 1) {
      const x = view.getFloat32(offset, true);
      const y = view.getFloat32(offset + 4, true);
      const z = view.getFloat32(offset + 8, true);
      offset += 12;
      pts.push(pointKey(x, y, z));
    }
    offset += 2;
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const key = pts[a] < pts[b] ? `${pts[a]}|${pts[b]}` : `${pts[b]}|${pts[a]}`;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  let open = 0;
  let over = 0;
  for (const count of edges.values()) {
    if (count === 1) open += 1;
    if (count > 2) over += 1;
  }
  return { open, over };
}

function assertWatertightStl(bytes, label, name, options = {}) {
  const topo = edgeTopology(bytes);
  assertCase(topo.open === 0, label, `${name} has ${topo.open} open edges`);
  if (!options.allowAssemblyContacts) {
    assertCase(topo.over === 0, label, `${name} has ${topo.over} over-shared/non-manifold edges`);
  } else if (topo.over !== 0) {
    console.warn(`WARN ${label}: ${name} has ${topo.over} over-shared edges from panel assembly contacts`);
  }
}

function parseStoredZip(bytes) {
  const entries = [];
  let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset + 30 <= bytes.byteLength) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compressedSize;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLen));
    assertCase(method === 0, 'zip', `${name} is compressed; smoke parser expects stored entries`);
    assertCase(compressedSize === uncompressedSize, 'zip', `${name} compressed/uncompressed mismatch`);
    entries.push({ name, data: bytes.subarray(dataStart, dataEnd) });
    offset = dataEnd;
  }
  return entries;
}

for (const [label, patch] of presets) {
  const params = { ...base, ...patch };
  const input = JSON.stringify(params);
  const house = export_house_stl(input);
  const obj = export_house_obj(input);
  const zip = export_panels_zip(input);
  const door = export_door_stl(input);
  const reportRaw = JSON.parse(mesh_report_json(input));
  const report = reportRaw.payload;

  assertCase(house.byteLength > 84, label, 'house STL empty');
  assertBinaryStl(house, label, 'house');
  assertWatertightStl(house, label, 'house', { allowAssemblyContacts: true });
  assertCase(obj.length > 0, label, 'OBJ empty');
  assertCase(zip.byteLength > 0, label, 'ZIP empty');
  const zipEntries = parseStoredZip(zip);
  const zipNames = zipEntries.map((e) => e.name).sort();
  const expectedNames = [
    'facade_avant.stl',
    'facade_arriere.stl',
    'cote_gauche.stl',
    'cote_droit.stl',
    'plancher.stl',
    'toit_gauche.stl',
    'toit_droit.stl',
  ];
  if (params.door !== 'none' && params.doorPanel) expectedNames.push('porte.stl');
  if (params.door !== 'none' && params.perch) expectedNames.push('perchoir.stl');
  expectedNames.sort();
  assertCase(JSON.stringify(zipNames) === JSON.stringify(expectedNames), label, `ZIP entries mismatch: got ${zipNames.join(', ')}`);
  for (const entry of zipEntries) {
    assertBinaryStl(entry.data, label, `zip/${entry.name}`);
    assertWatertightStl(entry.data, label, `zip/${entry.name}`);
  }
  assertCase(report.house.triangles > 0, label, 'report has no house triangles');
  assertCase(report.house.non_finite_values === 0, label, 'non-finite values in house mesh');
  assertCase(report.house.degenerate_triangles === 0, label, 'degenerate triangles in house mesh');
  for (const part of report.parts) {
    assertCase(part.triangles > 0, label, `${part.name} has no triangles`);
    assertCase(part.non_finite_values === 0, label, `${part.name} has non-finite values`);
    assertCase(part.degenerate_triangles === 0, label, `${part.name} has degenerate triangles`);
  }
  if (params.door !== 'none' && params.doorPanel) {
    assertCase(door.byteLength > 84, label, 'door STL empty despite doorPanel=true');
    assertBinaryStl(door, label, 'door');
    assertWatertightStl(door, label, 'door');
  }

  console.log([
    label,
    `house=${house.byteLength}B`,
    `obj=${obj.length}ch`,
    `zip=${zip.byteLength}B`,
    `tri=${report.house.triangles}`,
    `deg=${report.house.degenerate_triangles}`,
    `parts=${report.parts.length}`,
  ].join(' | '));
}

if (failures) {
  console.error(`${failures} mesh smoke failure(s)`);
  process.exit(1);
}

console.log('mesh smoke OK');
