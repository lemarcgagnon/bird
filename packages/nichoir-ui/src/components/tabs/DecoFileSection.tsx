// src/components/tabs/DecoFileSection.tsx
//
// Section FICHIER de DecoTab (P2.7b). Port v15 (index.html:237-244,
// src/ui/deco-panel.js:117-174) avec 2 boutons :
//   1. `<input type="file">` "Charger SVG / PNG / JPG" → appelle
//      `parseDecoFile(file, slot.resolution, t)` puis merge le résultat dans
//      le slot actif avec `enabled=true` forcé (contrat codex : toute charge
//      réussie active automatiquement la déco).
//   2. Bouton Supprimer (🗑) → reset hybride codex :
//      `enabled=false`, bloc fichier/parsing → null, réglages
//      `mode/w/h/posX/posY/rotation/depth/bevel/invert/resolution/clipToPanel`
//      conservés (src/ui/deco-panel.js:165-174).
//
// Divergence v15 : les erreurs remontent **inline `role="alert"`** via
// `t('deco.error.load', { message })`, pas via `alert()` (contrat P2.6
// correction finding #1, aligné ExportPlanSection/ExportStlSection).
//
// En cas d'échec de chargement, le slot courant reste **inchangé** (codex).
// L'input `<input type="file">` est remis à `value=''` dans le `finally`
// pour permettre à l'utilisateur de re-sélectionner le même fichier après
// correction d'un échec précédent.

'use client';

import { useRef, useState } from 'react';
import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { parseDecoFile } from '../../utils/parseDecoFile.js';
import type { DecoSlotCore } from '@nichoir/core';
import styles from './DecoTab.module.css';

export function DecoFileSection(): React.JSX.Element {
  const activeDecoKey = useNichoirStore((s) => s.activeDecoKey);
  const source = useNichoirStore((s) => s.decos[activeDecoKey].source);
  const setDecoSlot = useNichoirStore((s) => s.setDecoSlot);
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Lecture directe du store (pas via hook) pour avoir la valeur courante
      // de `resolution` — le slot peut avoir été muté depuis le dernier render.
      const slot = useNichoirStore.getState().decos[activeDecoKey];
      const result = await parseDecoFile(file, slot.resolution);
      setDecoSlot(activeDecoKey, { ...result, enabled: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('deco.error.load', { message: msg }));
    } finally {
      if (fileInputRef.current !== null) fileInputRef.current.value = '';
    }
  };

  const handleDelete = (): void => {
    setError(null);
    const patch: Partial<DecoSlotCore> = {
      enabled: false,
      source: null,
      sourceType: null,
      parsedShapes: null,
      bbox: null,
      heightmapData: null,
      lastParseWarning: null,
    };
    setDecoSlot(activeDecoKey, patch);
  };

  const deleteDisabled = source === null;

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('deco.file')}</div>
      <div className={styles.fileRow}>
        <label className={styles.fileLabel}>
          <span>{t('deco.file.load')}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,image/svg+xml,image/png,image/jpeg"
            className={styles.fileInput}
            onChange={handleUpload}
          />
        </label>
        <button
          type="button"
          className={styles.clearBtn}
          title={t('deco.file.delete')}
          aria-label={t('deco.file.delete')}
          disabled={deleteDisabled}
          onClick={handleDelete}
        >
          🗑
        </button>
      </div>
      {error !== null && (
        <p role="alert" className={styles.error}>{error}</p>
      )}
    </div>
  );
}
