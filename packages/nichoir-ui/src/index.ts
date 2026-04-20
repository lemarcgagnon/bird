export const UI_VERSION = '0.1.0';

// Viewport abstraction (interface + implémentation impérative)
export type { ViewportAdapter } from './viewports/ViewportAdapter.js';
export { ImperativeThreeViewport } from './viewports/ImperativeThreeViewport.js';

// Rendering helpers (Three.js impératif, UI-only)
export { materializeDefs, clearGroup } from './rendering/materializeDefs.js';

// React shell (P2.1)
export { NichoirApp } from './NichoirApp.js';
export type { NichoirAppProps } from './NichoirApp.js';
export { Viewport } from './components/Viewport.js';
export type { ViewportProps } from './components/Viewport.js';

// Sidebar (P2.2a)
export { Sidebar } from './components/Sidebar.js';

// Primitives HIG (P2.2a + P2.2b)
export { Tabs } from './components/primitives/Tabs.js';
export type { TabItem, TabsProps } from './components/primitives/Tabs.js';
export { ToggleBar } from './components/primitives/ToggleBar.js';
export type { ToggleBarOption, ToggleBarProps } from './components/primitives/ToggleBar.js';
export { Checkbox } from './components/primitives/Checkbox.js';
export type { CheckboxProps } from './components/primitives/Checkbox.js';
export { LangSwitcher } from './components/primitives/LangSwitcher.js';
export { ThemeToggle } from './components/primitives/ThemeToggle.js';
export { Slider } from './components/primitives/Slider.js';
export type { SliderProps } from './components/primitives/Slider.js';

// Tab contents (P2.2b+)
export { DimTab } from './components/tabs/DimTab.js';

// Store (Zustand)
export { useNichoirStore } from './store.js';
export type { NichoirStore } from './store.js';

// i18n
export { useT } from './i18n/useT.js';
export { MESSAGES } from './i18n/messages.js';
export type { Lang as I18nLang } from './i18n/messages.js';
