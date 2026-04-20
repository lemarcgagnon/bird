// src/components/primitives/Checkbox.tsx
//
// Primitive `<label><input type=checkbox>` + state visuel via `data-checked`.
// L'accessibilité est garantie par le HTML natif (label association).

'use client';

import { useId } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, label, disabled }: CheckboxProps): React.JSX.Element {
  const id = useId();
  return (
    <label htmlFor={id} className={styles.label} data-checked={checked}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e): void => onChange(e.target.checked)}
        disabled={disabled}
        className={styles.input}
      />
      <span>{label}</span>
    </label>
  );
}
