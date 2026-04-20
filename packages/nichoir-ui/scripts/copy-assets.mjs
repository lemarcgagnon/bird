// scripts/copy-assets.mjs
// Copie les fichiers *.css et *.module.css de src/ vers dist/ après le `tsc`
// build. tsc ignore ces fichiers ; Next.js + Vitest + tout bundler ES les lit
// depuis dist/ où se trouve le JS compilé.
//
// Pas de dépendance externe : pure Node (fs + path).

import { readdirSync, statSync, mkdirSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(module\.css|css)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk('src');
for (const src of files) {
  const dest = src.replace(/^src\//, 'dist/');
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
}
console.log(`✓ copied ${files.length} CSS asset(s) to dist/`);
