import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  getNichoirTurbopackAliases,
  getNichoirWebpackAliases,
  applyNichoirSourceAliases,
} from './source-aliases.mjs';

const demoDir = process.cwd();

test('getNichoirWebpackAliases covers package roots and theme.css subpath', () => {
  const aliases = getNichoirWebpackAliases(demoDir);

  assert.equal(
    aliases['@nichoir/ui/app$'],
    path.join(demoDir, '../../packages/nichoir-ui/src/app.ts'),
  );
  assert.equal(
    aliases['@nichoir/ui/theme-boot$'],
    path.join(demoDir, '../../packages/nichoir-ui/src/theme-boot.ts'),
  );
  assert.equal(
    aliases['@nichoir/ui/theme.css$'],
    path.join(demoDir, '../../packages/nichoir-ui/src/styles/theme.css'),
  );
  assert.equal(
    aliases['@nichoir/core$'],
    path.join(demoDir, '../../packages/nichoir-core/src/index.ts'),
  );
  assert.equal(
    aliases['@nichoir/adapters$'],
    path.join(demoDir, '../../packages/nichoir-adapters/src/index.ts'),
  );
});

test('getNichoirTurbopackAliases uses exact specifiers without webpack suffixes', () => {
  const aliases = getNichoirTurbopackAliases(demoDir);

  assert.equal(
    aliases['@nichoir/ui/app'],
    path.join(demoDir, '../../packages/nichoir-ui/src/app.ts'),
  );
  assert.equal(
    aliases['@nichoir/ui/theme-boot'],
    path.join(demoDir, '../../packages/nichoir-ui/src/theme-boot.ts'),
  );
  assert.equal(
    aliases['@nichoir/ui/theme.css'],
    path.join(demoDir, '../../packages/nichoir-ui/src/styles/theme.css'),
  );
  assert.equal(
    aliases['@nichoir/core'],
    path.join(demoDir, '../../packages/nichoir-core/src/index.ts'),
  );
  assert.equal(
    aliases['@nichoir/adapters'],
    path.join(demoDir, '../../packages/nichoir-adapters/src/index.ts'),
  );
});

test('applyNichoirSourceAliases merges aliases into webpack config', () => {
  const config = {
    resolve: {
      alias: { existing: '/tmp/existing.js' },
      extensionAlias: { '.js': ['.js'] },
    },
  };
  const next = applyNichoirSourceAliases(config, demoDir);

  assert.equal(next.resolve.alias.existing, '/tmp/existing.js');
  assert.equal(
    next.resolve.alias['@nichoir/ui/app$'],
    path.join(demoDir, '../../packages/nichoir-ui/src/app.ts'),
  );
  assert.equal(
    next.resolve.alias['@nichoir/ui/theme-boot$'],
    path.join(demoDir, '../../packages/nichoir-ui/src/theme-boot.ts'),
  );
  assert.equal(
    next.resolve.alias['@nichoir/ui/theme.css$'],
    path.join(demoDir, '../../packages/nichoir-ui/src/styles/theme.css'),
  );
  assert.deepEqual(next.resolve.extensionAlias['.js'], ['.ts', '.tsx', '.js']);
  assert.deepEqual(next.resolve.extensionAlias['.mjs'], ['.mts', '.mjs']);
  assert.deepEqual(next.resolve.extensionAlias['.cjs'], ['.cts', '.cjs']);
});
