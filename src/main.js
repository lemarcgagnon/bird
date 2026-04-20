// src/main.js
// Point d'entrée. Assemble store + scène + UI et lance la boucle de rendu.

import { createStore } from './store.js';
import { createInitialState } from './state.js';
import { t, applyI18nToDOM } from './i18n.js';
import { createScene, clearGroup, updateCameraFromState } from './three-scene.js';
import { buildPanelDefs, materializeDefs } from './geometry/panels.js';
import { computeCalculations, computeCutList } from './calculations.js';
import { computeCutLayout, drawCutPlan } from './cut-plan.js';
import { exportHouseSTL, exportDoorSTL, exportPanelsZIP } from './exporters/stl.js';
import { exportPlanPNG, exportPlanSVG } from './exporters/plan.js';
import { bindSlider, bindToggleBar, bindCheckbox } from './ui/bindings.js';
import { bindCameraInputs } from './ui/camera-input.js';
import { setupTabs, setupLangSwitcher } from './ui/tabs.js';
import { setupDecoPanel } from './ui/deco-panel.js';

// ---- Store ----
const store = createStore(createInitialState());

// ---- Scène Three.js ----
const viewportEl = document.getElementById('viewport');
const { scene, camera, renderer, panelGroup, clipPlanes } = createScene(viewportEl);

// ---- Cache de layout de plan (pour export) ----
let currentCutLayout = null;

// ---- Helpers DOM ----
const $ = (id) => document.getElementById(id);

// ---- Rebuild complet : appelée quand quoi que ce soit change ----
// Limitation : on ne fait pas encore de rebuild sélectif. Une future optimisation
// serait de segmenter (ex: changement de mode d'affichage → pas besoin de recalculer
// la liste de coupe). Pour l'instant, simple beats clever.
function rebuild() {
  const state = store.getState();

  // Géométrie
  clearGroup(panelGroup);
  const buildResult = buildPanelDefs(state);

  // Plans de clipping actifs
  const activeClipPlanes = [];
  if (buildResult.clipPlanesOut.x) {
    clipPlanes.x.constant = buildResult.clipPlanesOut.x.constant;
    activeClipPlanes.push(clipPlanes.x);
  }
  if (buildResult.clipPlanesOut.y) {
    clipPlanes.y.constant = buildResult.clipPlanesOut.y.constant;
    activeClipPlanes.push(clipPlanes.y);
  }
  if (buildResult.clipPlanesOut.z) {
    clipPlanes.z.constant = buildResult.clipPlanesOut.z.constant;
    activeClipPlanes.push(clipPlanes.z);
  }

  materializeDefs(panelGroup, buildResult, state.params.mode, activeClipPlanes);

  // Calculs + rendu
  updateCalcDisplay(state);
  updateOverlay(state);
  updateCutPlan(state);
  updateDimHints(state);
}

// ---- Affichage des calculs (onglet CALCUL) ----
function updateCalcDisplay(state) {
  const { volumes, surfaces, derived } = computeCalculations(state.params);
  const { cuts, nPieces } = computeCutList(state.params, derived);

  const fV = v => v > 1e6 ? (v/1e6).toFixed(2) + ' L' : (v/1e3).toFixed(1) + ' cm³';
  const fA = v => (v/100).toFixed(1) + ' cm²';

  $('v-ext').textContent = fV(volumes.ext);
  $('v-int').textContent = fV(volumes.int);
  $('v-mat').textContent = fV(volumes.mat);
  $('s-total').textContent = fA(surfaces.total);
  $('s-front').textContent = fA(surfaces.facades);
  $('s-side').textContent = fA(surfaces.sides);
  $('s-bottom').textContent = fA(surfaces.bottom);
  $('s-roof').textContent = fA(surfaces.roof);

  const T = state.params.T;
  $('m-thick').textContent = T.toFixed(1) + ' mm (' + (T/25.4).toFixed(2) + '")';
  $('m-pieces').textContent = t('calc.material.piecesCount', { n: nPieces });

  // Rendu de la liste de coupe
  let h = `<div class="cut-header">
    <span class="c1">${t('calc.cuts.header.piece')}</span>
    <span class="c2">${t('calc.cuts.header.qty')}</span>
    <span class="c3">${t('calc.cuts.header.dims')}</span>
  </div>`;
  cuts.forEach(c => {
    let noteStr = '';
    if (c.noteKey) noteStr = t(c.noteKey, c.noteParams || {});
    if (c.doorShape) {
      const shape = t(c.doorShape.key);
      noteStr = shape + (c.doorShape.percent ? ' ' + c.doorShape.percent + '%' : '');
    }
    const noteHtml = noteStr ? ` <span class="note">(${noteStr})</span>` : '';
    h += `<div class="cut-row">
      <span class="c1">${t(c.nameKey)}${noteHtml}</span>
      <span class="c2">×${c.qty}</span>
      <span class="c3">${c.dim}</span>
    </div>`;
  });
  $('cut-table').innerHTML = h;
}

// ---- Hints de l'onglet DIM (crête, épaisseur, toit, porte) ----
function updateDimHints(state) {
  const { params } = state;
  const { derived } = computeCalculations(params);
  const { T, slope, ridge, door } = params;

  $('roof-hint').textContent = t('dim.roofHeight') + ': ' + derived.rH.toFixed(0) + ' mm';
  $('thick-hint').textContent = t('dim.thickness.hint', {
    in: (T/25.4).toFixed(2),
    sixteenth: Math.round(T/25.4*16),
  });

  if (ridge === 'miter') {
    $('ridge-hint').innerHTML = t('dim.ridge.miter.hint', { slope });
  } else {
    const key = ridge === 'left' ? 'dim.ridge.left.hint' : 'dim.ridge.right.hint';
    $('ridge-hint').textContent = t(key, { t: T.toFixed(1) });
  }

  if (door !== 'none') {
    const W = params.W;
    const wallH = params.floor === 'pose' ? params.H - T : params.H;
    const dCx = (-W/2 + params.doorPX/100 * W).toFixed(0);
    const dCy = (params.doorPY/100 * wallH).toFixed(0);
    const shapeKey = 'dim.door.hint.' + door;
    $('door-hint').innerHTML = t('calc.door.infoLine', {
      shape: t(shapeKey),
      w: params.doorW, h: params.doorH,
      cx: dCx, cy: dCy,
    });
    if (params.doorPanel) {
      const v = params.doorVar;
      const dscKey = v < 100 ? 'dim.door.adjust.smaller' : v > 100 ? 'dim.door.adjust.larger' : 'dim.door.adjust.same';
      $('door-panel-hint').textContent = v + '% → ' + t(dscKey);
    }
  } else {
    $('door-hint').textContent = t('dim.door.hint.none');
  }
}

// ---- Overlay du viewport ----
function updateOverlay(state) {
  const { params, clip } = state;
  const parts = [params.mode.toUpperCase()];
  if (params.explode > 0) parts.push('ÉCLATÉ ' + params.explode + '%');
  const ax = ['x','y','z'].filter(a => clip[a].on).map(a => a.toUpperCase()).join('');
  if (ax) parts.push('COUPE ' + ax);
  parts.push(params.floor === 'pose' ? 'POSÉ' : 'ENCLAVÉ');
  parts.push(params.ridge === 'left' ? 'G>D' : params.ridge === 'right' ? 'D>G' : 'ONGLET');
  $('ov-mode').textContent = parts.join(' · ');
}

// ---- Plan de coupe (canvas + stats) ----
function updateCutPlan(state) {
  const cv = $('cut-canvas');
  if (!cv) return;
  currentCutLayout = computeCutLayout(state.params);
  drawCutPlan(cv, currentCutLayout);

  const { shW, shH, totalArea } = currentCutLayout;
  const usage = (totalArea / (shW * shH) * 100);
  $('plan-usage').textContent = usage.toFixed(1) + '%';
  $('plan-area').textContent = (totalArea / 100).toFixed(0) + ' cm²';
  $('plan-panel-area').textContent = (shW * shH / 100).toFixed(0) + ' cm²';
  $('plan-size-txt').textContent = shW + ' × ' + shH + ' mm';
}

// ==== Bindings de l'UI ====

// Accessor simplifié pour muter un paramètre de `params`
const setParam = (key) => (v) => {
  store.setState(s => ({ ...s, params: { ...s.params, [key]: v } }));
  rebuild();
};

// Sliders de dimensions principales — allowOverflow permet de taper une valeur > max
// (sans que le slider ne la reflète). FIX bug #3 appliqué : le clamp est explicite.
bindSlider('sg-W', store.getState().params.W, { unit: ' mm', dec: 0, allowOverflow: true, onChange: setParam('W') });
bindSlider('sg-H', store.getState().params.H, { unit: ' mm', dec: 0, allowOverflow: true, onChange: setParam('H') });
bindSlider('sg-D', store.getState().params.D, { unit: ' mm', dec: 0, allowOverflow: true, onChange: setParam('D') });
bindSlider('sg-taperX', store.getState().params.taperX, { unit: ' mm', dec: 0, onChange: setParam('taperX') });
bindSlider('sg-slope', store.getState().params.slope, { unit: '°', dec: 0, onChange: setParam('slope') });
bindSlider('sg-overhang', store.getState().params.overhang, { unit: ' mm', dec: 0, onChange: setParam('overhang') });
bindSlider('sg-T', store.getState().params.T, { unit: ' mm', dec: 1, onChange: setParam('T') });
bindSlider('sg-explode', store.getState().params.explode, { unit: '%', dec: 0, onChange: setParam('explode') });

// Door sliders
bindSlider('sg-doorW', store.getState().params.doorW, { unit: ' mm', dec: 0, onChange: setParam('doorW') });
bindSlider('sg-doorH', store.getState().params.doorH, { unit: ' mm', dec: 0, onChange: setParam('doorH') });
bindSlider('sg-doorPX', store.getState().params.doorPX, { unit: '%', dec: 0, onChange: setParam('doorPX') });
bindSlider('sg-doorPY', store.getState().params.doorPY, { unit: '%', dec: 0, onChange: setParam('doorPY') });
// FIX bug #5 : doorVar accepte jusqu'à 125 (comme le slider). allowOverflow évite la
// désync où le champ texte était clampé à 100.
bindSlider('sg-doorVar', store.getState().params.doorVar, { unit: '%', dec: 0, onChange: setParam('doorVar') });

bindSlider('sg-perchDiam', store.getState().params.perchDiam, { unit: ' mm', dec: 1, onChange: setParam('perchDiam') });
bindSlider('sg-perchLen', store.getState().params.perchLen, { unit: ' mm', dec: 0, onChange: setParam('perchLen') });
bindSlider('sg-perchOff', store.getState().params.perchOff, { unit: ' mm', dec: 0, onChange: setParam('perchOff') });

bindSlider('sg-panelW', store.getState().params.panelW, { unit: ' mm', dec: 0, onChange: setParam('panelW') });
bindSlider('sg-panelH', store.getState().params.panelH, { unit: ' mm', dec: 0, onChange: setParam('panelH') });

// Toggle bars
bindToggleBar('floor-toggle', '.toggle-btn', store.getState().params.floor, setParam('floor'));
bindToggleBar('ridge-toggle', '.toggle-btn', store.getState().params.ridge, setParam('ridge'));
bindToggleBar('door-toggle', '.toggle-btn', store.getState().params.door, (v) => {
  setParam('door')(v);
  $('door-controls').style.display = v === 'none' ? 'none' : 'block';
  $('door-follow-taper-wrap').style.display = v === 'pentagon' ? 'block' : 'none';
});

// Mode d'affichage (Solide / Fil / X-Ray / Arêtes)
document.querySelectorAll('.mode-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(x => {
      x.classList.remove('active');
      x.setAttribute('aria-checked', 'false');
    });
    b.classList.add('active');
    b.setAttribute('aria-checked', 'true');
    setParam('mode')(b.dataset.mode);
  });
});

// Checkboxes "Panneau de porte" / "Suivre évasement" / "Perchoir"
// Ces labels sont stylés inline (pas de classe CSS .on) dans le HTML — on mute
// la couleur directement pour respecter le design existant.
const setInlineLabelColor = (labelId, on) => {
  const lbl = $(labelId);
  if (lbl) lbl.style.color = on ? '#e8a955' : '#5a5f6a';
};

bindCheckbox('cb-door-panel', store.getState().params.doorPanel, {
  activeClass: null,
  onChange: (v) => {
    // FIX bug #1 : on retire la ligne orpheline `.querySelector('label') ;`
    // qui ne faisait rien dans l'original.
    setInlineLabelColor('door-panel-toggle', v);
    $('door-panel-controls').style.display = v ? 'block' : 'none';
    setParam('doorPanel')(v);
  },
});
// État visuel initial
setInlineLabelColor('door-panel-toggle', store.getState().params.doorPanel);

bindCheckbox('cb-door-follow-taper', store.getState().params.doorFollowTaper, {
  activeClass: null,
  onChange: (v) => {
    const cb = $('cb-door-follow-taper');
    if (cb && cb.parentElement) cb.parentElement.style.color = v ? '#e8a955' : '#5a5f6a';
    setParam('doorFollowTaper')(v);
  },
});

bindCheckbox('cb-perch', store.getState().params.perch, {
  activeClass: null,
  onChange: (v) => {
    setInlineLabelColor('perch-toggle-label', v);
    $('perch-controls').style.display = v ? 'block' : 'none';
    setParam('perch')(v);
  },
});
setInlineLabelColor('perch-toggle-label', store.getState().params.perch);

// Clip section checkboxes + sliders
['x','y','z'].forEach(a => {
  const r = $('clip-' + a);
  const cb = r.querySelector('input[type=checkbox]');
  const sd = r.querySelector('.clip-slider');
  const sl = sd.querySelector('input[type=range]');
  const lb = r.querySelector('label');
  cb.addEventListener('change', () => {
    sd.style.display = cb.checked ? 'block' : 'none';
    lb.classList.toggle('on', cb.checked);
    store.setState(s => ({ ...s, clip: { ...s.clip, [a]: { ...s.clip[a], on: cb.checked } } }));
    rebuild();
  });
  sl.addEventListener('input', () => {
    const pos = parseFloat(sl.value) / 100;
    store.setState(s => ({ ...s, clip: { ...s.clip, [a]: { ...s.clip[a], pos } } }));
    rebuild();
  });
});

// Panel size selector
$('panel-size').addEventListener('change', function() {
  const v = this.value;
  const cp = $('custom-panel');
  if (v === 'custom') {
    cp.style.display = 'block';
  } else {
    cp.style.display = 'none';
    const [w, h] = v.split('x').map(Number);
    store.setState(s => ({ ...s, params: { ...s.params, panelW: w, panelH: h } }));
    rebuild();
  }
});

// Export buttons (tous concentrés sur l'onglet EXPORT pour STL)
$('btn-export-house').addEventListener('click', () => exportHouseSTL(panelGroup));
$('btn-export-door').addEventListener('click', () => exportDoorSTL(panelGroup));
$('btn-export-zip').addEventListener('click', () => exportPanelsZIP(panelGroup, store.getState().params));
$('btn-export-plan-png').addEventListener('click', () => exportPlanPNG($('cut-canvas'), currentCutLayout || computeCutLayout(store.getState().params)));
$('btn-export-plan-svg').addEventListener('click', () => exportPlanSVG(currentCutLayout || computeCutLayout(store.getState().params)));

// ==== Deco panel ====
const decoSetup = setupDecoPanel(store, rebuild);
decoSetup.refresh();

// ==== Thème clair/sombre ====
(function initTheme() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const apply = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nichoir-theme', theme);
    btn.textContent = theme === 'dark' ? '☀' : '🌙';
    btn.setAttribute('aria-label', t(theme === 'dark' ? 'lang.theme.toLight' : 'lang.theme.toDark'));
  };
  // Lire le thème déjà appliqué par le script anti-FOUC dans <head>
  apply(document.documentElement.getAttribute('data-theme') || 'light');
  btn.addEventListener('click', () => {
    apply(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
})();

// ==== Tabs + Lang switcher ====
setupTabs(store);
setupLangSwitcher(store, () => {
  // Re-render tout ce qui dépend de la langue
  rebuild();
  decoSetup.refresh();
});

// ==== Camera inputs ====
bindCameraInputs(viewportEl, store);

// ==== Resize ====
window.addEventListener('resize', () => {
  camera.aspect = viewportEl.clientWidth / viewportEl.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(viewportEl.clientWidth, viewportEl.clientHeight);
});

// ==== Boucle de rendu ====
function animate() {
  const s = store.getState();
  updateCameraFromState(camera, s.camera, s.params.H);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ==== Boot ====
applyI18nToDOM();
rebuild();
animate();
