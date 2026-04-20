import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInitialState, DECO_KEYS } from '../src/index.js';

const fixturesDir = path.resolve(__dirname, 'fixtures');
const presets = ['A', 'B', 'C'].map(p =>
  JSON.parse(readFileSync(path.join(fixturesDir, `preset${p}.snapshot.json`), 'utf8'))
);

// La fixture a été capturée avant que plusieurs champs optionnels ne soient
// ajoutés au contrat TS :
//   - DecoSlotCore : parsedShapes, heightmapData, heightmapResolution (port TS)
//   - Params : doorFace (P3 feature, défaut 'front' = équivalent historique)
// createInitialState() retourne un NichoirState conforme au contrat types.ts
// (superset strict du fixture). Le test compare donc via expectSubset (chaque
// champ de la fixture doit être présent et égal, les champs additionnels du
// state ne sont pas contraints). MD5 des fixtures préservés.
function expectSubset(actual: unknown, expected: unknown, path_ = ''): void {
  if (expected === null || expected === undefined) {
    expect(actual).toEqual(expected);
    return;
  }
  if (typeof expected !== 'object' || Array.isArray(expected)) {
    expect(actual).toEqual(expected);
    return;
  }
  const exp = expected as Record<string, unknown>;
  const act = actual as Record<string, unknown>;
  for (const key of Object.keys(exp)) {
    const keyPath = path_ ? `${path_}.${key}` : key;
    if (
      typeof exp[key] === 'object' &&
      exp[key] !== null &&
      !Array.isArray(exp[key])
    ) {
      expectSubset(act[key], exp[key], keyPath);
    } else {
      expect(act[key], `mismatch at ${keyPath}`).toEqual(exp[key]);
    }
  }
}

describe('createInitialState', () => {
  it('matches fixture A (default) — subset comparison (state is superset of fixture)', () => {
    const state = createInitialState();
    // Compare tout sauf decos en subset (Params a des champs optionnels post-fixture)
    const { decos: fixtureDecos, ...fixtureRest } = presets[0].state;
    const { decos: stateDecos, ...stateRest } = state;
    expectSubset(stateRest, fixtureRest);
    // Pour decos : vérifier que chaque clé de la fixture est présente et correcte
    for (const k of Object.keys(fixtureDecos)) {
      const decoKey = k as keyof typeof stateDecos;
      expectSubset(stateDecos[decoKey], fixtureDecos[k], `decos.${k}`);
    }
  });

  it('Params.doorFace default is "front" (post-fixture field, feature P3)', () => {
    expect(createInitialState().params.doorFace).toBe('front');
  });

  it('DECO_KEYS matches fixture expectations', () => {
    expect(DECO_KEYS).toEqual(['front', 'back', 'left', 'right', 'roofL', 'roofR']);
  });

  // Ferme le gap subset : les 3 champs ajoutés par DecoSlotCore (absents de la fixture)
  // doivent avoir les valeurs par défaut documentées dans CONTRACTS.md.
  it('DecoSlotCore TS-only fields have correct defaults (parsedShapes/heightmapData/heightmapResolution)', () => {
    const state = createInitialState();
    for (const k of DECO_KEYS) {
      const slot = state.decos[k];
      expect(slot.parsedShapes, `decos.${k}.parsedShapes`).toBeNull();
      expect(slot.heightmapData, `decos.${k}.heightmapData`).toBeNull();
      expect(slot.heightmapResolution, `decos.${k}.heightmapResolution`).toBe(64);
      // Cohérence resolution ↔ heightmapResolution à l'état initial
      expect(slot.heightmapResolution).toBe(slot.resolution);
    }
  });
});
