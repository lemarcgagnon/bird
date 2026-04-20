// src/components/primitives/Tabs.tsx
//
// Tablist "dumb/controlled" — reçoit active + onChange en props, ne touche pas au store.
// Conforme ARIA 1.2 : role=tablist/tab, aria-selected, aria-controls, navigation clavier
// (← → Home End). Le parent gère l'état actif et le rendu du panel.
//
// Per codex : Sidebar owns layout + active-tab rendering, Tabs stays dumb.

'use client';

import { useRef, type KeyboardEvent } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  /** Clé interne (ex: 'dim', 'vue'). */
  value: string;
  /** Label déjà traduit par le parent. */
  label: string;
  /** id du panel contrôlé pour aria-controls. */
  panelId: string;
}

export interface TabsProps {
  items: readonly TabItem[];
  active: string;
  onChange: (value: string) => void;
  /** aria-label du tablist, résolu i18n par le parent. */
  ariaLabel: string;
}

export function Tabs({ items, active, onChange, ariaLabel }: TabsProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number): void => {
    const last = items.length - 1;
    let next = idx;
    if (e.key === 'ArrowRight') next = idx === last ? 0 : idx + 1;
    else if (e.key === 'ArrowLeft') next = idx === 0 ? last : idx - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else return;
    e.preventDefault();
    const nextItem = items[next];
    if (!nextItem) return;
    onChange(nextItem.value);
    // Déplacer le focus sur le nouveau bouton actif
    const btn = listRef.current?.querySelectorAll<HTMLButtonElement>('button[role="tab"]')[next];
    btn?.focus();
  };

  return (
    <div role="tablist" aria-label={ariaLabel} className={styles.list} ref={listRef}>
      {items.map((item, idx) => {
        const selected = item.value === active;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={selected}
            aria-controls={item.panelId}
            id={`tab-btn-${item.value}`}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={(): void => onChange(item.value)}
            onKeyDown={(e): void => handleKey(e, idx)}
            type="button"
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
