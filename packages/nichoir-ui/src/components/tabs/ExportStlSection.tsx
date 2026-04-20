// src/components/tabs/ExportStlSection.tsx
//
// Section STL de ExportTab. 3 boutons : maison complète, porte seule, ZIP.
// Port fidèle v15 (index.html:379-387) avec divergences documentées en
// header de ExportTab.tsx.
//
// Pattern de chaque bouton :
//   1. `buildPanelDefs(state)` appelé au click (découplage du Viewport,
//      garde-fou codex P2.6 : signature réelle du core, pas params+decos+t).
//   2. `generate*STL(buildResult)` retourne Uint8Array | null.
//   3. Si null → afficher un message d'erreur inline (role="alert").
//   4. Sinon → `downloadService.trigger(bytes, filename, 'application/octet-stream')`.
//   5. Toute erreur runtime (buildPanelDefs throw, generatePanelsZIP reject,
//      download.trigger reject) est capturée par try/catch et remontée en
//      inline role="alert" via `t('export.error.generic', { message })`.
//      Contrat aligné sur ExportPlanSection (codex P2.6 correction finding #1).

'use client';

import { useState } from 'react';
import {
  buildPanelDefs,
  generateHouseSTL,
  generateDoorSTL,
  generatePanelsZIP,
} from '@nichoir/core';
import { useNichoirStore } from '../../store.js';
import { useT } from '../../i18n/useT.js';
import { useDownloadService } from '../../adapters/DownloadServiceContext.js';
import { ExportButton } from '../primitives/ExportButton.js';
import styles from './ExportTab.module.css';

export function ExportStlSection(): React.JSX.Element {
  const door = useNichoirStore((s) => s.params.door);
  const doorPanel = useNichoirStore((s) => s.params.doorPanel);
  const t = useT();
  const download = useDownloadService();
  const [error, setError] = useState<string | null>(null);

  const doorDisabled = door === 'none' || !doorPanel;

  const handleHouse = async (): Promise<void> => {
    setError(null);
    try {
      const state = useNichoirStore.getState();
      const buildResult = buildPanelDefs(state);
      const bytes = generateHouseSTL(buildResult);
      if (bytes === null) {
        setError(t('export.error.nothing'));
        return;
      }
      await download.trigger(bytes, 'nichoir_maison.stl', 'application/octet-stream');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('export.error.generic', { message: msg }));
    }
  };

  const handleDoor = async (): Promise<void> => {
    setError(null);
    try {
      const state = useNichoirStore.getState();
      const buildResult = buildPanelDefs(state);
      const bytes = generateDoorSTL(buildResult);
      if (bytes === null) {
        setError(t('export.error.noDoor'));
        return;
      }
      await download.trigger(bytes, 'nichoir_porte.stl', 'application/octet-stream');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('export.error.generic', { message: msg }));
    }
  };

  const handleZip = async (): Promise<void> => {
    setError(null);
    try {
      const state = useNichoirStore.getState();
      const buildResult = buildPanelDefs(state);
      const bytes = await generatePanelsZIP(buildResult, state.params, t);
      if (bytes.byteLength === 0) {
        setError(t('export.error.nothing'));
        return;
      }
      await download.trigger(bytes, 'nichoir_panneaux.zip', 'application/zip');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('export.error.generic', { message: msg }));
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('export.stl')}</div>
      <ExportButton
        label={t('export.stl.house')}
        labelBusy={t('export.busy.house')}
        onClick={handleHouse}
      />
      <ExportButton
        label={t('export.stl.door')}
        labelBusy={t('export.busy.door')}
        onClick={handleDoor}
        disabled={doorDisabled}
      />
      <ExportButton
        label={t('export.stl.zip')}
        labelBusy={t('export.busy.zip')}
        onClick={handleZip}
      />
      <ul className={styles.hintList}>
        <li>{t('export.stl.hint.house')}</li>
        <li>{t('export.stl.hint.zip')}</li>
        <li>{t('export.stl.hint.dims')}</li>
      </ul>
      {error !== null && (
        <p role="alert" className={styles.error}>{error}</p>
      )}
    </div>
  );
}
