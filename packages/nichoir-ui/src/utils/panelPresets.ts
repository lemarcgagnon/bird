// src/utils/panelPresets.ts
//
// Presets de taille de panneau (feuille de découpe). Port fidèle v15
// (index.html:343-347). 4 presets + "custom" (valeurs numériques gardées
// littérales car v15 n'avait pas de clés i18n pour ces 4 formats).
//
// `resolvePreset` est l'inverse : étant donné un couple (w, h) du store, on
// retourne l'identifiant du preset correspondant, ou 'custom' si aucun ne
// matche. Utilisé par PlanSizeSection pour synchroniser la valeur du
// <select> avec l'état du store.

export interface PanelPreset {
  /** Identifiant technique (value du <option>). */
  value: string;
  /** Label affiché. Littéral pour les 4 presets fixes. */
  label: string;
  /** Largeur en mm. null pour `value === 'custom'`. */
  w: number | null;
  /** Hauteur en mm. null pour `value === 'custom'`. */
  h: number | null;
  /** Clé i18n d'un suffixe optionnel (ex: "bouleau baltique" pour 1525×1525). */
  labelSuffixKey?: 'plan.panelSize.bb';
}

export const CUSTOM_PRESET_VALUE = 'custom';

/**
 * Liste ordonnée des presets, port fidèle v15 :
 *   - 1220 × 2440 (4'×8', défaut)
 *   - 1220 × 1220 (4'×4')
 *   - 1525 × 1525 (5'×5', bouleau baltique — suffixe i18n)
 *   - 610 × 1220 (2'×4')
 *   - custom (label via i18n, w/h null)
 */
export const PANEL_PRESETS: readonly PanelPreset[] = [
  { value: '1220x2440', label: "4' × 8' — 1220 × 2440 mm", w: 1220, h: 2440 },
  { value: '1220x1220', label: "4' × 4' — 1220 × 1220 mm", w: 1220, h: 1220 },
  { value: '1525x1525', label: "5' × 5' — 1525 × 1525 mm", w: 1525, h: 1525, labelSuffixKey: 'plan.panelSize.bb' },
  { value: '610x1220',  label: "2' × 4' — 610 × 1220 mm",  w: 610,  h: 1220 },
  { value: CUSTOM_PRESET_VALUE, label: '', w: null, h: null }, // label via i18n côté consumer
];

/**
 * Retourne l'identifiant du preset qui matche le couple (w, h), ou
 * `CUSTOM_PRESET_VALUE` si aucun preset fixe ne correspond.
 */
export function resolvePreset(w: number, h: number): string {
  const match = PANEL_PRESETS.find((p) => p.w === w && p.h === h);
  return match ? match.value : CUSTOM_PRESET_VALUE;
}
