import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/nichoir-core/vitest.config.ts',
  'packages/nichoir-ui/vitest.config.ts',
  'packages/nichoir-adapters/vitest.config.ts',
]);
