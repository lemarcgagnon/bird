export const CORE_VERSION = '0.2.0';
export type * from './types.js';
export { PALETTES, hexToNumber } from './palettes.js';
export type { PaletteKey, Palette } from './palettes.js';
export { createInitialState, DECO_KEYS } from './state.js';
export { computeCalculations, computeCutList } from './calculations.js';
export { computeCutLayout } from './cut-plan.js';
export { computeCutLayoutRectpack } from './cut-plan-rectpack.js';
export { mkPent, mkHexPanel, buildPanelDefs } from './geometry/panels.js';
export {
  buildDecoGeoVector,
  buildDecoGeoHeightmap,
  placeDecoOnPanel,
  buildPanelClipPlanes,
} from './geometry/deco.js';

// Exporters
export { generateHouseSTL, generateDoorSTL } from './exporters/stl.js';
export { generatePanelsZIP } from './exporters/zip.js';
export { generatePlanSVG } from './exporters/svg.js';
export { generatePlanZIP } from './exporters/plan-zip.js';
