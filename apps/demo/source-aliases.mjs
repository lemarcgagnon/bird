import path from 'node:path';

function getNichoirSourceEntries(appDir) {
  return {
    '@nichoir/ui/app': path.join(appDir, '../../packages/nichoir-ui/src/app.ts'),
    '@nichoir/ui/theme-boot': path.join(appDir, '../../packages/nichoir-ui/src/theme-boot.ts'),
    '@nichoir/ui/theme.css': path.join(appDir, '../../packages/nichoir-ui/src/styles/theme.css'),
    '@nichoir/core': path.join(appDir, '../../packages/nichoir-core/src/index.ts'),
    '@nichoir/adapters': path.join(appDir, '../../packages/nichoir-adapters/src/index.ts'),
  };
}

export function getNichoirWebpackAliases(appDir) {
  const entries = getNichoirSourceEntries(appDir);

  return Object.fromEntries(
    Object.entries(entries).map(([specifier, target]) => [`${specifier}$`, target]),
  );
}

export function getNichoirTurbopackAliases(appDir) {
  return getNichoirSourceEntries(appDir);
}

export function applyNichoirSourceAliases(config, appDir) {
  config.resolve ??= {};
  config.resolve.alias = {
    ...(config.resolve.alias ?? {}),
    ...getNichoirWebpackAliases(appDir),
  };
  config.resolve.extensionAlias = {
    ...(config.resolve.extensionAlias ?? {}),
    '.js': ['.ts', '.tsx', '.js'],
    '.mjs': ['.mts', '.mjs'],
    '.cjs': ['.cts', '.cjs'],
  };
  return config;
}
