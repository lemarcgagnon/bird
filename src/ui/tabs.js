// src/ui/tabs.js
// Gestion de la barre d'onglets + du switcher de langue.

import { t, setLang, getLang, applyI18nToDOM } from '../i18n.js';

export function setupTabs(store) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => {
      const tab = b.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(x => {
        x.classList.remove('active');
        x.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      b.setAttribute('aria-selected', 'true');
      document.getElementById('tab-' + tab).classList.add('active');
      store.setState({ activeTab: tab });
    });
  });
}

export function setupLangSwitcher(store, onChange) {
  const container = document.getElementById('lang-switcher');
  if (!container) return;
  container.querySelectorAll('button[data-lang]').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === getLang());
    b.addEventListener('click', () => {
      const lang = b.dataset.lang;
      if (lang === getLang()) return;
      setLang(lang);
      container.querySelectorAll('button[data-lang]').forEach(x => x.classList.toggle('active', x.dataset.lang === lang));
      applyI18nToDOM();
      store.setState({ lang });
      onChange?.();
    });
  });
}
