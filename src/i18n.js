// src/i18n.js
// Accès aux traductions + application au DOM.
//
// Convention DOM :
//   <span data-i18n="tab.dim"></span>        → textContent
//   <span data-i18n-html="plan.legend"></span> → innerHTML (autorise <br>, <b>)
//   <input data-i18n-title="…"> / data-i18n-placeholder="…"

import { translations } from './translations.js';

let currentLang = 'fr';

export function setLang(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
}

export function getLang() {
  return currentLang;
}

// t('key') ou t('key', { a: 1, b: 2 }) avec interpolation {a} {b}
export function t(key, params) {
  const dict = translations[currentLang] || translations.fr;
  let str = dict[key];
  if (str === undefined) {
    // Fallback FR puis clé brute — rend les traductions manquantes visibles sans casser l'UI
    str = translations.fr[key] !== undefined ? translations.fr[key] : key;
  }
  if (params) {
    for (const k in params) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
    }
  }
  return str;
}

// Met à jour tous les noeuds DOM marqués avec data-i18n*.
// À rappeler quand on change de langue.
export function applyI18nToDOM(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  // Titre du document
  const titleKey = document.documentElement.dataset.i18nTitle;
  if (titleKey) document.title = t(titleKey);
  // Attribut lang
  document.documentElement.lang = currentLang;
}
