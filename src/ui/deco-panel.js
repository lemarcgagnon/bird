// src/ui/deco-panel.js
// Wiring de l'onglet DÉCOR : dropdown de panneau, upload de fichier,
// sliders de position/dimensions, mode vector/heightmap, checkboxes.
// Tout passe par le store via des actions.

import { t } from '../i18n.js';
import { parseSVG, rasterizeToCanvas } from '../geometry/deco.js';
import { bindSlider } from './bindings.js';

const $ = (id) => document.getElementById(id);

const DECO_LABEL_KEYS = {
  front: 'deco.target.front', back: 'deco.target.back',
  left: 'deco.target.left', right: 'deco.target.right',
  roofL: 'deco.target.roofL', roofR: 'deco.target.roofR',
};

// Helper : mute la déco active en place dans le store.
// Raison : les sources/shapes/rasterCanvas sont de grosses structures
// qu'on ne veut pas shallow-cloner à chaque changement de slider.
// On mute en place + on déclenche une notification via setState identique.
function mutateActiveDeco(store, mutator) {
  const s = store.getState();
  const d = s.decos[s.activeDecoKey];
  mutator(d);
  // Force notification : on reconstruit un nouveau `decos` pour que les subscribers
  // avec sélecteur sur decos voient un changement de référence.
  store.setState({ decos: { ...s.decos } });
}

export function setupDecoPanel(store, rebuild) {
  // decoSliders est rempli plus bas ; déclaré ici pour que refresh() y ait accès
  const decoSliders = {};

  function refresh() {
    refreshDecoUIImpl(store, decoSliders);
  }

  // Dropdown de panneau cible
  const sel = $('deco-target');
  sel.addEventListener('change', (e) => {
    store.setState({ activeDecoKey: e.target.value });
    refresh();
  });

  // Checkbox "Activer"
  $('deco-enable').addEventListener('change', (e) => {
    mutateActiveDeco(store, d => { d.enabled = e.target.checked; });
    $('deco-enable-label').classList.toggle('on', e.target.checked);
    rebuild();
  });

  // Checkbox "Inverser"
  $('deco-invert').addEventListener('change', (e) => {
    mutateActiveDeco(store, d => { d.invert = e.target.checked; });
    $('deco-invert-label').classList.toggle('on', e.target.checked);
    rebuild();
  });

  // Checkbox "Clipper"
  $('deco-clip').addEventListener('change', (e) => {
    mutateActiveDeco(store, d => { d.clipToPanel = e.target.checked; });
    $('deco-clip-label').classList.toggle('on', e.target.checked);
    rebuild();
  });

  // Toggle mode vector/heightmap
  document.querySelectorAll('#deco-mode-toggle .toggle-btn').forEach(b => {
    b.addEventListener('click', () => {
      const d = activeDeco(store);
      const requested = b.dataset.val;
      if (requested === 'vector' && (!d.shapes || !d.shapes.length)) {
        const warn = $('deco-mode-warn');
        let msg = t('deco.warn.vectorNoShapes');
        if (d.sourceType === 'image') msg = t('deco.warn.imageNoVector');
        else if (d.lastParseWarning) msg = t('deco.warn.svgInvalid', { reason: d.lastParseWarning });
        warn.textContent = '⚠ ' + msg;
        warn.style.display = 'block';
        // FIX bug #2 : le setTimeout d'origine avait un corps vide — il ne cachait rien.
        // On cache le warning après 4 secondes.
        setTimeout(() => {
          if (activeDeco(store) === d) warn.style.display = 'none';
        }, 4000);
        return;
      }
      mutateActiveDeco(store, dd => { dd.mode = requested; });
      $('deco-mode-warn').style.display = 'none';
      document.querySelectorAll('#deco-mode-toggle .toggle-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      refresh();
      rebuild();
    });
  });

  // Sliders de la déco active. On utilise des wrappers car la cible (decos[activeDecoKey])
  // change au cours de la session.
  function bindDecoSlider(id, field, unit, dec, isPct) {
    decoSliders[field] = bindSlider(id, activeDeco(store)[field], {
      unit: isPct ? '%' : unit,
      dec,
      onChange: (v) => {
        mutateActiveDeco(store, d => { d[field] = v; });
        rebuild();
      },
    });
  }
  bindDecoSlider('sg-decoW', 'w', ' mm', 0);
  bindDecoSlider('sg-decoH', 'h', ' mm', 0);
  bindDecoSlider('sg-decoPX', 'posX', '', 0, true);
  bindDecoSlider('sg-decoPY', 'posY', '', 0, true);
  bindDecoSlider('sg-decoRot', 'rotation', '°', 0);
  bindDecoSlider('sg-decoDepth', 'depth', ' mm', 1);
  bindDecoSlider('sg-decoBevel', 'bevel', '', 0, true);
  bindDecoSlider('sg-decoRes', 'resolution', '', 0);

  // Upload de fichier
  $('deco-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const isSvg = /\.svg$/i.test(file.name) || file.type === 'image/svg+xml';

    try {
      if (isSvg) {
        const text = await file.text();
        const parsed = parseSVG(text);
        const rasterCanvas = await rasterizeToCanvas(text, 'svg', 256);
        mutateActiveDeco(store, d => {
          d.source = text;
          d.sourceType = 'svg';
          d.shapes = parsed.shapes;
          d.bbox = parsed.bbox;
          d.lastParseWarning = parsed.warning;
          d.rasterCanvas = rasterCanvas;
          d.mode = (parsed.shapes && parsed.shapes.length) ? 'vector' : 'heightmap';
          d.enabled = true;
        });
      } else {
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        const rasterCanvas = await rasterizeToCanvas(dataUrl, 'image', 256);
        mutateActiveDeco(store, d => {
          d.source = dataUrl;
          d.sourceType = 'image';
          d.shapes = null;
          d.bbox = null;
          d.lastParseWarning = null;
          d.rasterCanvas = rasterCanvas;
          d.mode = 'heightmap';
          d.enabled = true;
        });
      }
      refresh();
      rebuild();
    } catch(err) {
      alert(t('deco.error.load', { message: err.message }));
    }
    e.target.value = '';
  });

  // Bouton "Supprimer"
  $('deco-clear').addEventListener('click', () => {
    mutateActiveDeco(store, d => {
      d.enabled = false;
      d.source = null; d.sourceType = null;
      d.shapes = null; d.bbox = null;
      d.rasterCanvas = null; d.lastParseWarning = null;
    });
    refresh();
    rebuild();
  });

  // Expose refresh pour que le main puisse le rappeler (changement de langue, boot initial)
  return { refresh };
}

function activeDeco(store) {
  const s = store.getState();
  return s.decos[s.activeDecoKey];
}

// Rafraîchit tout l'onglet DÉCOR quand on change de panneau actif ou de langue.
function refreshDecoUIImpl(store, decoSliders) {
  const s = store.getState();
  const d = s.decos[s.activeDecoKey];
  const labelKey = DECO_LABEL_KEYS[s.activeDecoKey];

  // Statut du fichier
  const el = $('deco-status');
  if (!d.source) {
    el.textContent = t('deco.status.emptyFor', { panel: t(labelKey) });
    el.classList.remove('loaded');
  } else {
    const kind = d.sourceType === 'svg' ? 'SVG' : 'Image';
    let detail = '';
    if (d.sourceType === 'svg' && d.shapes) {
      const n = d.shapes.length;
      const shapeStr = n > 1 ? t('deco.svg.shapesCountPlural', { n }) : t('deco.svg.shapesCount', { n });
      detail = ' · ' + shapeStr;
    }
    if (d.rasterCanvas) detail += ' · ' + t('deco.raster.size', { w: d.rasterCanvas.width, h: d.rasterCanvas.height });
    el.textContent = kind + detail + ' — ' + t(labelKey);
    el.classList.add('loaded');
  }

  $('deco-params').style.display = d.source ? 'block' : 'none';

  const warn = $('deco-mode-warn');
  if (d.lastParseWarning && d.mode === 'vector') {
    warn.textContent = '⚠ ' + t('deco.warn.parseFallback', { warning: d.lastParseWarning });
    warn.style.display = 'block';
  } else {
    warn.style.display = 'none';
  }

  // Mettre à jour les sliders avec les valeurs de la déco courante
  if (decoSliders) {
    decoSliders.w?.setValue(d.w);
    decoSliders.h?.setValue(d.h);
    decoSliders.posX?.setValue(d.posX);
    decoSliders.posY?.setValue(d.posY);
    decoSliders.rotation?.setValue(d.rotation);
    decoSliders.depth?.setValue(d.depth);
    decoSliders.bevel?.setValue(d.bevel);
    decoSliders.resolution?.setValue(d.resolution);
  }

  // Checkboxes
  $('deco-enable').checked = d.enabled;
  $('deco-enable-label').classList.toggle('on', d.enabled);
  $('deco-invert').checked = !!d.invert;
  $('deco-invert-label').classList.toggle('on', !!d.invert);
  $('deco-clip').checked = !!d.clipToPanel;
  $('deco-clip-label').classList.toggle('on', !!d.clipToPanel);

  // Toggle mode actif + état disabled si pas de shapes
  const hasShapes = !!(d.shapes && d.shapes.length);
  document.querySelectorAll('#deco-mode-toggle .toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === d.mode);
    if (b.dataset.val === 'vector') {
      b.classList.toggle('disabled', !hasShapes);
      b.title = hasShapes ? '' : t('deco.warn.unavailable');
    }
  });

  // Dropdown
  $('deco-target').value = s.activeDecoKey;
}
