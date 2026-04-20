// apps/demo/app/tools/nichoir/page.tsx
//
// Route Next.js `/tools/nichoir` — Server Component qui rend le module Nichoir
// côté client. Pas de `'use client'` ici : la frontière client est dans
// `<NichoirApp>` (qui lui a la directive).
//
// C'est le découpage recommandé Next 15 App Router (cf. codex) :
//   - page.tsx = server component minimal (permet le streaming SSR, les metadata, etc.)
//   - NichoirApp = first client boundary (useRef, useEffect, Three.js)

import { NichoirApp } from '@nichoir/ui/app';

export const metadata = {
  title: 'Nichoir — Calculateur maison d\'oiseau',
  description: 'Configurateur 3D de nichoir avec export STL.',
};

export default function NichoirPage(): React.JSX.Element {
  return <NichoirApp />;
}
