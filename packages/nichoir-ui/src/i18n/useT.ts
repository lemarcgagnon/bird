// src/i18n/useT.ts
//
// Hook React retournant la fonction `t(key, params?)` qui traduit via la langue
// courante du store. Fallback : la clé elle-même si non-trouvée.
// Placeholders `{name}` remplacés par `params[name]` si fournis.
//
// Contrat aligné avec `Translator` de `@nichoir/core` (signature :
// `(key, params?) => string`, jamais `undefined`).

'use client';

import { useNichoirStore } from '../store.js';
import { MESSAGES } from './messages.js';
import type { Translator } from '@nichoir/core';

export function useT(): Translator {
  const lang = useNichoirStore((s) => s.lang);
  return (key: string, params?: Record<string, string | number>): string => {
    const raw = MESSAGES[lang]?.[key] ?? key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, n: string) =>
      params[n] !== undefined ? String(params[n]) : `{${n}}`,
    );
  };
}
