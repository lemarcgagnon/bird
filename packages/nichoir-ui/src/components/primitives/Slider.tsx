// src/components/primitives/Slider.tsx
//
// Primitive Slider (range + num input synchronisés).
// Pattern "draft locale + commit explicite" (imposé par codex, P2.2b guardrail) :
//   - L'input numérique maintient un state local `draft: string`.
//   - Le draft absorbe les saisies intermédiaires ('', '-', '12.') sans commit.
//   - Le commit (vers onChange) se fait UNIQUEMENT sur blur ou Enter.
//   - Le range input commit immédiatement (UX attendue du drag).
//   - Le clamp [min,max] n'est appliqué qu'au commit, jamais pendant la saisie.
//   - `allowOverflow` : la valeur commitée peut dépasser max, le range se fige
//     au max visuellement mais le num input affiche la vraie valeur.

'use client';

import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import styles from './Slider.module.css';

export interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /** Suffixe d'unité affiché après la valeur (ex: ' mm', '°', '%'). */
  unit?: string;
  /** Nombre de décimales affichées. Défaut = 0. */
  dec?: number;
  /** Si true, la valeur commitée peut dépasser max (slider se fige au max visuellement). */
  allowOverflow?: boolean;
  /** aria-label override. Par défaut : `label`. */
  ariaLabel?: string;
}

function formatValue(v: number, dec: number): string {
  return Number.isFinite(v) ? v.toFixed(dec) : '';
}

function commitDraft(
  draft: string,
  current: number,
  min: number,
  max: number,
  allowOverflow: boolean,
): number {
  const parsed = parseFloat(draft);
  if (!Number.isFinite(parsed)) return current; // garde la valeur courante sur saisie invalide
  const upperBound = allowOverflow ? Number.POSITIVE_INFINITY : max;
  return Math.max(min, Math.min(upperBound, parsed));
}

export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit = '',
  dec = 0,
  allowOverflow = false,
  ariaLabel,
}: SliderProps): React.JSX.Element {
  // Draft = string locale affichée dans l'input numérique.
  // Initialisée depuis `value`, puis ré-synchronisée quand `value` change depuis l'extérieur.
  const [draft, setDraft] = useState<string>(() => formatValue(value, dec));

  // Sync externe → draft (quand store mute la valeur sans que l'utilisateur tape).
  // Attention : on ne veut PAS écraser le draft pendant que l'user tape.
  // Heuristique : on sync uniquement si la valeur parsée du draft diffère de la nouvelle valeur.
  useEffect(() => {
    const parsed = parseFloat(draft);
    if (!Number.isFinite(parsed) || Math.abs(parsed - value) > 1e-9) {
      setDraft(formatValue(value, dec));
    }
    // deps = [value, dec] intentionnellement : on ne veut pas sync à chaque
    // keystroke (draft est listed mais on lit la valeur courante pour comparer).
    // Pas de rule react-hooks/exhaustive-deps dans notre config eslint.
  }, [value, dec]);

  const handleRangeInput = (e: ChangeEvent<HTMLInputElement>): void => {
    const v = parseFloat(e.target.value);
    if (!Number.isFinite(v)) return;
    onChange(v);
    setDraft(formatValue(v, dec));
  };

  const handleNumChange = (e: ChangeEvent<HTMLInputElement>): void => {
    // Pas de commit ici — on absorbe la saisie dans draft.
    setDraft(e.target.value);
  };

  const handleNumCommit = (): void => {
    const next = commitDraft(draft, value, min, max, allowOverflow);
    onChange(next);
    setDraft(formatValue(next, dec));
  };

  const handleNumKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNumCommit();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      // Annule la saisie courante — revient à la valeur committée
      setDraft(formatValue(value, dec));
      (e.target as HTMLInputElement).blur();
    }
  };

  // Valeur visuelle du range : clampée à [min, max] même si `value` dépasse max via allowOverflow.
  const rangeValue = Math.max(min, Math.min(max, value));
  const computedAriaLabel = ariaLabel ?? label;

  return (
    <div className={styles.group}>
      <div className={styles.row}>
        <span className={styles.label}>{label}</span>
        <span className={styles.valueWrap}>
          <input
            type="number"
            className={styles.numInput}
            value={draft}
            onChange={handleNumChange}
            onBlur={handleNumCommit}
            onKeyDown={handleNumKey}
            min={min}
            max={max}
            step={step}
            aria-label={`${computedAriaLabel} (valeur numérique)`}
          />
          {unit && <span className={styles.unit}>{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        className={styles.range}
        value={rangeValue}
        onChange={handleRangeInput}
        min={min}
        max={max}
        step={step}
        aria-label={computedAriaLabel}
      />
    </div>
  );
}
