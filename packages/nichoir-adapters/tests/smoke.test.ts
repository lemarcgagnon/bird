import { describe, it, expect } from 'vitest';
import { ADAPTERS_VERSION } from '../src/index.js';
import { FakeCreditGate } from '../src/fakes/FakeCreditGate.js';
import { InMemoryProjectStore } from '../src/fakes/InMemoryProjectStore.js';
import { FakeAuthContext } from '../src/fakes/FakeAuthContext.js';
import type { NichoirState } from '@nichoir/core';

describe('nichoir-adapters', () => {
  it('loads', () => expect(ADAPTERS_VERSION).toBe('0.1.0'));

  it('FakeCreditGate.canExport retourne true', async () => {
    const gate = new FakeCreditGate();
    expect(await gate.canExport('stl-house')).toBe(true);
  });

  it('InMemoryProjectStore save + load roundtrip', async () => {
    const store = new InMemoryProjectStore();
    const state = { params: { W: 200 } } as unknown as NichoirState;
    const { id } = await store.save(state, { name: 'test' });
    const loaded = await store.load(id);
    expect(loaded).toBe(state);
  });

  it('FakeAuthContext.isAuthenticated === true', () => {
    expect(FakeAuthContext.isAuthenticated).toBe(true);
  });
});
