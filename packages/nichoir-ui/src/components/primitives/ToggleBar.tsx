// src/components/primitives/ToggleBar.tsx
//
// Primitive "radiogroup" contrôlée : une seule option active à la fois.
// Conforme ARIA : role=radiogroup, role=radio, aria-checked, aria-disabled.
// Utilisée en P2.2b+ dans les onglets pour floor/ridge/door/deco.mode.

'use client';

import styles from './ToggleBar.module.css';

export interface ToggleBarOption<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface ToggleBarProps<V extends string> {
  options: readonly ToggleBarOption<V>[];
  value: V;
  onChange: (value: V) => void;
  ariaLabel: string;
}

export function ToggleBar<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: ToggleBarProps<V>): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={styles.group}>
      {options.map((opt) => {
        const selected = opt.value === value;
        const disabled = opt.disabled === true;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={selected}
            aria-disabled={disabled}
            className={styles.btn}
            type="button"
            onClick={(): void => {
              if (!disabled) onChange(opt.value);
            }}
            tabIndex={disabled ? -1 : 0}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
