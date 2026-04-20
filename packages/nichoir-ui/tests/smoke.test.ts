import { describe, it, expect } from 'vitest';
import { UI_VERSION } from '../src/index.js';

describe('nichoir-ui', () => {
  it('loads', () => expect(UI_VERSION).toBe('0.1.0'));
});
