import path from 'path';
import type { NextConfig } from 'next';
import { applyNichoirSourceAliases, getNichoirTurbopackAliases } from './source-aliases.mjs';

const nextConfig: NextConfig = {
  transpilePackages: ['@nichoir/core', '@nichoir/ui', '@nichoir/adapters'],
  outputFileTracingRoot: path.join(__dirname, '../..'),
  turbopack: {
    resolveAlias: getNichoirTurbopackAliases(__dirname),
  },
  webpack: (config) => applyNichoirSourceAliases(config, __dirname),
};

export default nextConfig;
