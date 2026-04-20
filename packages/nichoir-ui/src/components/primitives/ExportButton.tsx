// src/components/primitives/ExportButton.tsx
//
// Primitive bouton d'export. Gère le cycle async :
//   - label normal → onClick: Promise
//   - pendant exec : disabled + aria-busy=true + labelBusy affiché
//   - après : retour à l'état normal (succès) ou erreur remontée au parent
//
// Pas de gestion d'erreur interne : le parent fournit `onClick: () => Promise<void>`
// qui doit capturer ses propres erreurs et les reporter (typiquement via un
// state local `error: string | null` rendu en <p role="alert">).

'use client';

import { useState, type MouseEvent } from 'react';
import styles from './ExportButton.module.css';

export interface ExportButtonProps {
  label: string;
  labelBusy: string;
  onClick: () => Promise<void>;
  disabled?: boolean;
}

export function ExportButton({
  label,
  labelBusy,
  onClick,
  disabled,
}: ExportButtonProps): React.JSX.Element {
  const [busy, setBusy] = useState(false);

  const handleClick = async (_e: MouseEvent<HTMLButtonElement>): Promise<void> => {
    if (busy || disabled === true) return;
    setBusy(true);
    try {
      await onClick();
    } finally {
      setBusy(false);
    }
  };

  const isDisabled = disabled === true || busy;

  return (
    <button
      type="button"
      className={styles.btn}
      onClick={(): void => { void handleClick({} as MouseEvent<HTMLButtonElement>); }}
      disabled={isDisabled}
      aria-busy={busy}
    >
      {busy ? labelBusy : label}
    </button>
  );
}
