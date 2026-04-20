// Vérifie les branches non exercées par A/B/C :
// - floor='pose'
// - ridge='right'
// - taperX > 0
// - doorPanel=true
// On compare la sortie du port TS contre src/* (même source que fixtures).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../');
const CORE_NODE_MODULES = path.resolve(__dirname, '../node_modules');

// Load THREE for src/ imports
const THREE = await import(path.join(CORE_NODE_MODULES, 'three/build/three.cjs'));
globalThis.THREE = THREE;

const srcState = await import(path.join(ROOT, 'src/state.js'));
const srcCalc = await import(path.join(ROOT, 'src/calculations.js'));
const srcPlan = await import(path.join(ROOT, 'src/cut-plan.js'));

const tsState = await import('../dist/state.js');
const tsCalc = await import('../dist/calculations.js');
const tsPlan = await import('../dist/cut-plan.js');

function deepClose(a, b, tol = 1e-6, p = '') {
  if (typeof b === 'number') {
    if (b === 0) {
      if (Math.abs(a) > 1e-10) return `${p}: expected 0, got ${a}`;
      return null;
    }
    const rel = Math.abs(a - b) / Math.abs(b);
    if (rel > tol) return `${p}: rel ${rel}, got ${a}, expected ${b}`;
    return null;
  }
  if (typeof b !== 'object' || b === null) {
    if (a !== b) return `${p}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`;
    return null;
  }
  if (Array.isArray(b)) {
    if (a.length !== b.length) return `${p}: array length ${a.length} vs ${b.length}`;
    for (let i = 0; i < b.length; i++) {
      const err = deepClose(a[i], b[i], tol, `${p}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  for (const k of Object.keys(b)) {
    const err = deepClose(a[k], b[k], tol, p ? `${p}.${k}` : k);
    if (err) return err;
  }
  // Also check extra keys in a
  for (const k of Object.keys(a)) {
    if (!(k in b)) return `${p}.${k}: extra key in actual`;
  }
  return null;
}

const base = srcState.createInitialState().params;
const branches = [
  { name: 'floor=pose', params: { ...base, floor: 'pose' } },
  { name: 'ridge=right', params: { ...base, ridge: 'right' } },
  { name: 'taperX=+20 (flared)', params: { ...base, taperX: 20 } },
  { name: 'doorPanel=true + door=round', params: { ...base, door: 'round', doorPanel: true, doorW: 40, doorH: 40 } },
  { name: 'doorPanel=true + door=square', params: { ...base, door: 'square', doorPanel: true, doorW: 35, doorH: 55 } },
];

let fails = 0;
for (const b of branches) {
  const srcCalcOut = srcCalc.computeCalculations(b.params);
  const tsCalcOut = tsCalc.computeCalculations(b.params);
  const srcListOut = srcCalc.computeCutList(b.params, srcCalcOut.derived);
  const tsListOut = tsCalc.computeCutList(b.params, tsCalcOut.derived);
  const srcLayOut = srcPlan.computeCutLayout(b.params);
  const tsLayOut = tsPlan.computeCutLayout(b.params);

  const errs = [
    deepClose(tsCalcOut, srcCalcOut, 1e-6, 'calc'),
    deepClose(tsListOut, srcListOut, 1e-6, 'list'),
    deepClose(tsLayOut, srcLayOut, 1e-6, 'layout'),
  ].filter(Boolean);

  if (errs.length === 0) {
    console.log(`✓ ${b.name}`);
  } else {
    console.log(`✗ ${b.name}`);
    errs.forEach(e => console.log(`    - ${e}`));
    fails++;
  }
}

process.exit(fails === 0 ? 0 : 1);
