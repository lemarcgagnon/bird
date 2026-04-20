import { describe, it, expect } from 'vitest';
import { CORE_VERSION } from '../src/index.js';

describe('nichoir-core', () => {
  it('loads', () => expect(CORE_VERSION).toBe('0.1.0'));
});
