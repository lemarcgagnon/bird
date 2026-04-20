// src/components/Sidebar.tsx
//
// Layout + rendu du panel actif uniquement. Les Tabs sont "dumb" et contrôlées
// par Sidebar via store.activeTab / store.setActiveTab.
//
// P2.2a : tous les panels sont des placeholders. En P2.2b+, chaque onglet se
// charge de son propre contenu (DimTab, VueTab, etc.).

'use client';

import { useNichoirStore } from '../store.js';
import { useT } from '../i18n/useT.js';
import { Tabs, type TabItem } from './primitives/Tabs.js';
import { LangSwitcher } from './primitives/LangSwitcher.js';
import { ThemeToggle } from './primitives/ThemeToggle.js';
import { DimTab } from './tabs/DimTab.js';
import { VueTab } from './tabs/VueTab.js';
import { DecoTab } from './tabs/DecoTab.js';
import { CalcTab } from './tabs/CalcTab.js';
import { PlanTab } from './tabs/PlanTab.js';
import { ExportTab } from './tabs/ExportTab.js';
import type { TabKey } from '@nichoir/core';
import styles from './Sidebar.module.css';

const TAB_ORDER: readonly TabKey[] = ['dim', 'vue', 'deco', 'calc', 'plan', 'export'];

export function Sidebar(): React.JSX.Element {
  const activeTab = useNichoirStore((s) => s.activeTab);
  const setActiveTab = useNichoirStore((s) => s.setActiveTab);
  const t = useT();

  const items: TabItem[] = TAB_ORDER.map((key) => ({
    value: key,
    label: t(`tab.${key}`),
    panelId: `nichoir-tab-panel-${key}`,
  }));

  return (
    <aside className={styles.root} aria-label={t('app.title')}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <p className={styles.subtitle}>{t('app.subtitle')}</p>
      </div>

      <Tabs
        items={items}
        active={activeTab}
        onChange={(v): void => setActiveTab(v as TabKey)}
        ariaLabel={t('app.title')}
      />

      <section
        role="tabpanel"
        id={`nichoir-tab-panel-${activeTab}`}
        aria-labelledby={`tab-btn-${activeTab}`}
        className={styles.panel}
      >
        {/* P2.7a : 6/6 onglets fonctionnels (DÉCOR limité à target + enable,
            sous-phases b/c à venir). Placeholder conservé comme fallback défensif. */}
        {activeTab === 'dim' ? (
          <DimTab />
        ) : activeTab === 'vue' ? (
          <VueTab />
        ) : activeTab === 'deco' ? (
          <DecoTab />
        ) : activeTab === 'calc' ? (
          <CalcTab />
        ) : activeTab === 'plan' ? (
          <PlanTab />
        ) : activeTab === 'export' ? (
          <ExportTab />
        ) : (
          <div className={styles.placeholder}>{t('tab.placeholder.construction')}</div>
        )}
      </section>

      <div className={styles.footer}>
        <div className={styles.langGroup}>
          <span className={styles.langLabel}>{t('lang.label')}</span>
          <LangSwitcher />
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}
