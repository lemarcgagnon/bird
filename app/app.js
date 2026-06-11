import init, {
  default_params_json,
  render_app_html,
  scene_meshes_json,
  export_house_stl,
  export_house_obj,
  export_door_stl,
  export_panels_zip,
  mesh_report_json,
  plan_preview_svg,
} from '../wasm/pkg/wasm.js?v=20260611-hig-dim-v1';
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

const APP_BUILD_ID = '20260611-hig-dim-v1';
const root = document.getElementById('app');
const THEME_KEY = 'nichoir-theme';
let params = null;
let frameId = null;
let activeTab = 'dim';
let cleanupViewer = null;
let theme = localStorage.getItem(THEME_KEY)
  || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function applyTheme() {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark', isDark);
  document.body.dataset.theme = theme;
  document.querySelectorAll('[data-action="theme-toggle"]').forEach((button) => {
    button.textContent = isDark ? 'Sombre' : 'Clair';
    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute('aria-label', isDark ? 'Passer au mode clair' : 'Passer au mode sombre');
  });
}

function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
  renderViewer();
}

function initialCameraState() {
  return {
    theta: 0.7,
    phi: 0.95,
    dist: Math.max(260, Math.min(1800, Math.max(params?.W || 160, params?.H || 220, params?.D || 160) * 2.8)),
    target: new THREE.Vector3(0, 0, 0),
  };
}

let cameraState = {
  theta: 0.7,
  phi: 0.95,
  dist: 620,
  target: new THREE.Vector3(0, 0, 0),
};

function resetCameraView() {
  cameraState = initialCameraState();
  renderViewer();
}

function download(bytesOrText, filename, type) {
  const blob = new Blob([bytesOrText], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

function toDownloadBytes(raw) {
  if (raw instanceof Uint8Array) return raw.slice();
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength).slice();
  if (Array.isArray(raw)) return new Uint8Array(raw);
  return null;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function dataUrlBytes(dataUrl) {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : '';
}

function rasterizeSvgToPngBase64(svgText, size = 256) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, size, size);
        const iw = img.naturalWidth || size;
        const ih = img.naturalHeight || size;
        const scale = Math.min(size / iw, size / ih);
        const w = iw * scale;
        const h = ih * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        const png = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(dataUrlBytes(png));
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG rasterization failed'));
    };
    img.src = url;
  });
}

function setExportStatus(message, tone = 'info') {
  let status = root.querySelector('#export-status');
  const buttons = root.querySelector('[data-action="export-house"]')?.closest('.buttons');
  if (!status && buttons) {
    status = document.createElement('div');
    status.id = 'export-status';
    buttons.after(status);
  }
  if (!status) return;
  status.className = `export-status ${tone}`;
  status.textContent = message;
}

function exportBinary(filename, type, producer, emptyMessage) {
  try {
    const bytes = toDownloadBytes(producer());
    if (!bytes || !bytes.byteLength) {
      setExportStatus(emptyMessage, 'warn');
      return;
    }
    download(bytes, filename, type);
    setExportStatus(`Fichier cree: ${filename} (${bytes.byteLength.toLocaleString('fr-CA')} octets)`, 'ok');
  } catch (err) {
    console.error(err);
    setExportStatus(`Erreur export: ${err?.message || err}`, 'error');
  }
}

function exportText(filename, type, producer, emptyMessage) {
  try {
    const text = producer();
    if (!text || !String(text).length) {
      setExportStatus(emptyMessage, 'warn');
      return;
    }
    download(String(text), filename, type);
    setExportStatus(`Fichier cree: ${filename} (${String(text).length.toLocaleString('fr-CA')} caracteres)`, 'ok');
  } catch (err) {
    console.error(err);
    setExportStatus(`Erreur export: ${err?.message || err}`, 'error');
  }
}

function parseResponse(raw) {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return obj && obj.ok ? obj.payload : null;
  } catch {
    return null;
  }
}

function captureUiState() {
  const scroller = root.querySelector('.tab-scroll');
  const active = document.activeElement;
  const focus = active && active.dataset ? {
    param: active.dataset.param || null,
    paramNumber: active.dataset.paramNumber || null,
    decoParam: active.dataset.decoParam || null,
    decoNumber: active.dataset.decoNumber || null,
    choice: active.dataset.choice || null,
    bool: active.dataset.bool || null,
    decoBool: active.dataset.decoBool || null,
    decoTarget: active.hasAttribute('data-deco-target'),
    panelPreset: active.hasAttribute('data-panel-preset'),
  } : null;
  return {
    scrollTop: scroller ? scroller.scrollTop : 0,
    focus,
  };
}

function restoreUiState(state) {
  if (!state) return;
  const scroller = root.querySelector('.tab-scroll');
  if (scroller) scroller.scrollTop = state.scrollTop || 0;
  if (!state.focus) return;

  let selector = null;
  if (state.focus.param) selector = `[data-param="${state.focus.param}"]`;
  if (state.focus.paramNumber) selector = `[data-param-number="${state.focus.paramNumber}"]`;
  if (state.focus.decoParam) selector = `[data-deco-param="${state.focus.decoParam}"]`;
  if (state.focus.decoNumber) selector = `[data-deco-number="${state.focus.decoNumber}"]`;
  if (state.focus.choice) selector = `[data-choice="${state.focus.choice}"]`;
  if (state.focus.bool) selector = `[data-bool="${state.focus.bool}"]`;
  if (state.focus.decoBool) selector = `[data-deco-bool="${state.focus.decoBool}"]`;
  if (state.focus.decoTarget) selector = '[data-deco-target]';
  if (state.focus.panelPreset) selector = '[data-panel-preset]';
  const target = selector ? root.querySelector(selector) : null;
  if (target && typeof target.focus === 'function') {
    target.focus({ preventScroll: true });
  }
}

function syncRangeControl(key, value) {
  const control = root.querySelector(`[data-param="${key}"]`)?.closest('.range-control')
    || root.querySelector(`[data-param-number="${key}"]`)?.closest('.range-control');
  if (!control) return;
  const range = control.querySelector(`[data-param="${key}"]`);
  const number = control.querySelector(`[data-param-number="${key}"]`);
  if (range) range.value = String(value);
  if (number) number.value = String(value);
}

function valueToParam(input) {
  const scale = Number(input.dataset.paramScale || 1);
  return Number(input.value) * (Number.isFinite(scale) ? scale : 1);
}

function decoValueToParam(input) {
  const scale = Number(input.dataset.decoScale || 1);
  return Number(input.value) * (Number.isFinite(scale) ? scale : 1);
}

function ensureDecos() {
  if (!params.decos || typeof params.decos !== 'object') params.decos = {};
  ['front', 'back', 'left', 'right', 'roofL', 'roofR'].forEach((key) => {
    if (!params.decos[key]) {
      params.decos[key] = {
        enabled: false,
        sourceType: '',
        sourceText: '',
        sourceData: '',
        mode: 'vector',
        w: 60,
        h: 60,
        posX: 50,
        posY: 50,
        rotation: 0,
        depth: 2,
        bevel: 0,
        smooth: 25,
        threshold: 2,
        invert: false,
        resolution: 64,
        removeBg: false,
        clipToPanel: true,
      };
    }
    if (params.decos[key].smooth === undefined) params.decos[key].smooth = 25;
    if (params.decos[key].threshold === undefined) params.decos[key].threshold = 2;
    if (params.decos[key].removeBg === undefined) params.decos[key].removeBg = false;
    if (params.decos[key].clipToPanel === undefined) params.decos[key].clipToPanel = true;
  });
  if (!params.decorActive || !params.decos[params.decorActive]) params.decorActive = 'front';
}

function activeDeco() {
  ensureDecos();
  return params.decos[params.decorActive];
}

function syncDecoControl(key, value) {
  const control = root.querySelector(`[data-deco-param="${key}"]`)?.closest('.range-control')
    || root.querySelector(`[data-deco-number="${key}"]`)?.closest('.range-control');
  if (!control) return;
  const range = control.querySelector(`[data-deco-param="${key}"]`);
  const number = control.querySelector(`[data-deco-number="${key}"]`);
  if (range) range.value = String(value);
  if (number) number.value = String(value);
}

function normalizeDependentParams(changedKey) {
  if (changedKey === 'slope' && Math.abs(Number(params.slope) - 45) > 0.001) {
    params.ridge = 'miter';
  }
}

function refreshGeneratedViews() {
  renderPlanPreview();
  renderViewer();
}

async function refreshDecoRasterIfNeeded(deco) {
  if (!deco || deco.sourceType !== 'svg' || !deco.sourceText) return;
  const size = Math.max(64, Math.min(1024, Number(deco.resolution || 64) * 4));
  deco.sourceData = await rasterizeSvgToPngBase64(deco.sourceText, size);
}

function renderViewer() {
  const mount = document.getElementById('viewer');
  if (!mount) return;
  if (frameId) cancelAnimationFrame(frameId);
  if (cleanupViewer) cleanupViewer();
  cleanupViewer = null;

  const payload = parseResponse(scene_meshes_json(JSON.stringify(params)));
  if (!payload || !Array.isArray(payload.meshes)) return;

  const scene = new THREE.Scene();
  const css = getComputedStyle(document.body);
  const viewerBg = css.getPropertyValue('--viewer-bg').trim() || '#13151c';
  const edgeColor = css.getPropertyValue('--edge').trim() || '#2a1e15';
  scene.background = new THREE.Color(viewerBg);

  const rect = mount.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(260, Math.floor(rect.height));

  const camera = new THREE.PerspectiveCamera(42, width / height, 1, 5000);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  mount.textContent = '';
  mount.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  const key = new THREE.DirectionalLight(0xfff4df, 0.9);
  key.position.set(300, 420, 260);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdcecff, 0.35);
  fill.position.set(-260, 180, -260);
  scene.add(fill);

  const group = new THREE.Group();
  scene.add(group);
  const disposables = [];

  payload.meshes.forEach((m) => {
    if (!m.vertices || m.vertices.length < 9) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(m.vertices, 3));
    geo.computeVertexNormals();
    const edgesOnly = params.mode === 'edges';
    const isFacade = m.key === 'front' || m.key === 'back';
    const mat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(m.color || '#d4a574'),
      side: THREE.DoubleSide,
      wireframe: params.mode === 'wireframe',
      transparent: params.mode === 'xray',
      opacity: params.mode === 'xray' ? 0.28 : 1,
      depthWrite: params.mode !== 'xray',
      visible: !edgesOnly,
      shininess: 22,
      specular: 0x222222,
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    disposables.push(geo, mat);

    if (isFacade && !edgesOnly) return;
    const edges = new THREE.EdgesGeometry(geo, 18);
    const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
      color: edgesOnly ? 0xd4a574 : edgeColor,
      transparent: params.mode === 'xray',
      opacity: params.mode === 'xray' ? 0.62 : 1,
    }));
    group.add(lines);
    disposables.push(edges, lines.material);
  });

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);

  const updateCamera = () => {
    const phi = Math.max(0.18, Math.min(Math.PI - 0.18, cameraState.phi));
    const x = cameraState.dist * Math.sin(phi) * Math.sin(cameraState.theta);
    const y = cameraState.dist * Math.cos(phi);
    const z = cameraState.dist * Math.sin(phi) * Math.cos(cameraState.theta);
    camera.position.set(
      cameraState.target.x + x,
      cameraState.target.y + y,
      cameraState.target.z + z,
    );
    camera.lookAt(cameraState.target);
  };

  let dragging = false;
  let panMode = false;
  let lastX = 0;
  let lastY = 0;

  mount.addEventListener('pointerdown', (event) => {
    dragging = true;
    panMode = event.shiftKey || event.button === 1 || event.button === 2;
    lastX = event.clientX;
    lastY = event.clientY;
    mount.setPointerCapture(event.pointerId);
  });

  mount.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (panMode) {
      cameraState.target.x -= dx * 0.5;
      cameraState.target.y += dy * 0.5;
    } else {
      cameraState.theta -= dx * 0.008;
      cameraState.phi += dy * 0.008;
    }
    updateCamera();
  });

  mount.addEventListener('pointerup', (event) => {
    dragging = false;
    mount.releasePointerCapture(event.pointerId);
  });

  mount.addEventListener('contextmenu', (event) => event.preventDefault());
  mount.addEventListener('wheel', (event) => {
    event.preventDefault();
    cameraState.dist = Math.max(160, Math.min(1800, cameraState.dist + event.deltaY * 0.65));
    updateCamera();
  }, { passive: false });

  function animate() {
    updateCamera();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  }

  cleanupViewer = () => {
    disposables.forEach((item) => item.dispose && item.dispose());
    renderer.dispose();
  };
  animate();
}

function updateTabs() {
  root.querySelectorAll('[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === activeTab);
  });
  root.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === activeTab);
  });
}

function bindTabs() {
  root.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      activeTab = button.dataset.tab;
      updateTabs();
      renderPlanPreview();
    });
  });
  updateTabs();
}

function renderPlanPreview() {
  const target = document.getElementById('plan-preview');
  if (!target) return;
  const payload = parseResponse(plan_preview_svg(JSON.stringify(params)));
  target.innerHTML = payload && payload.svg ? payload.svg : '';
}

function render() {
  const uiState = captureUiState();
  ensureDecos();
  if (frameId) cancelAnimationFrame(frameId);
  if (cleanupViewer) cleanupViewer();
  cleanupViewer = null;
  root.innerHTML = render_app_html(JSON.stringify(params));
  applyTheme();

  root.querySelectorAll('[data-param]').forEach((input) => {
    input.addEventListener('input', () => {
      params[input.dataset.param] = valueToParam(input);
      normalizeDependentParams(input.dataset.param);
      syncRangeControl(input.dataset.param, input.value);
      refreshGeneratedViews();
    });
    input.addEventListener('change', () => {
      params[input.dataset.param] = valueToParam(input);
      normalizeDependentParams(input.dataset.param);
      syncRangeControl(input.dataset.param, input.value);
      render();
    });
  });

  root.querySelectorAll('[data-param-number]').forEach((input) => {
    input.addEventListener('input', () => {
      const value = valueToParam(input);
      if (!Number.isFinite(value)) return;
      params[input.dataset.paramNumber] = value;
      normalizeDependentParams(input.dataset.paramNumber);
      syncRangeControl(input.dataset.paramNumber, input.value);
      refreshGeneratedViews();
    });
    input.addEventListener('change', () => {
      const value = valueToParam(input);
      if (!Number.isFinite(value)) return;
      params[input.dataset.paramNumber] = value;
      normalizeDependentParams(input.dataset.paramNumber);
      syncRangeControl(input.dataset.paramNumber, input.value);
      render();
    });
  });

  root.querySelectorAll('[data-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      params[button.dataset.choice] = button.dataset.value;
      render();
    });
  });

  root.querySelectorAll('[data-bool]').forEach((input) => {
    input.addEventListener('change', () => {
      params[input.dataset.bool] = input.checked;
      render();
    });
  });

  root.querySelector('[data-deco-target]')?.addEventListener('change', (event) => {
    ensureDecos();
    params.decorActive = event.target.value;
    render();
  });

  root.querySelectorAll('[data-deco-param]').forEach((input) => {
    input.addEventListener('input', () => {
      const deco = activeDeco();
      deco[input.dataset.decoParam] = decoValueToParam(input);
      syncDecoControl(input.dataset.decoParam, input.value);
      refreshGeneratedViews();
    });
    input.addEventListener('change', () => {
      const deco = activeDeco();
      deco[input.dataset.decoParam] = decoValueToParam(input);
      syncDecoControl(input.dataset.decoParam, input.value);
      if (input.dataset.decoParam === 'resolution') {
        refreshDecoRasterIfNeeded(deco).finally(() => render());
      } else {
        render();
      }
    });
  });

  root.querySelectorAll('[data-deco-number]').forEach((input) => {
    input.addEventListener('input', () => {
      const value = decoValueToParam(input);
      if (!Number.isFinite(value)) return;
      const deco = activeDeco();
      deco[input.dataset.decoNumber] = value;
      syncDecoControl(input.dataset.decoNumber, input.value);
      refreshGeneratedViews();
    });
    input.addEventListener('change', () => {
      const value = decoValueToParam(input);
      if (!Number.isFinite(value)) return;
      const deco = activeDeco();
      deco[input.dataset.decoNumber] = value;
      syncDecoControl(input.dataset.decoNumber, input.value);
      if (input.dataset.decoNumber === 'resolution') {
        refreshDecoRasterIfNeeded(deco).finally(() => render());
      } else {
        render();
      }
    });
  });

  root.querySelectorAll('[data-deco-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const deco = activeDeco();
      deco[button.dataset.decoChoice] = button.dataset.value;
      render();
    });
  });

  root.querySelectorAll('[data-deco-bool]').forEach((input) => {
    input.addEventListener('change', () => {
      const deco = activeDeco();
      deco[input.dataset.decoBool] = input.checked;
      render();
    });
  });

  root.querySelector('[data-deco-file]')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isSvg = file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg');
    const isRaster = /image\/(png|jpeg|gif|webp)/i.test(file.type) || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
    if (!isSvg && !isRaster) {
      setExportStatus('Decor: charge un SVG, PNG, JPG, GIF ou WEBP.', 'warn');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const deco = activeDeco();
      try {
        if (isSvg) {
          const svgText = String(reader.result || '');
          deco.sourceType = 'svg';
          deco.sourceText = svgText;
          deco.sourceData = await rasterizeSvgToPngBase64(svgText, Math.max(64, Math.min(512, Number(deco.resolution || 64) * 4)));
          deco.mode = 'heightmap';
          deco.enabled = true;
          deco.clipToPanel = true;
          setExportStatus('Decor: SVG rasterise en heightmap et envoye au WASM.', 'ok');
        } else {
          const lower = file.name.toLowerCase();
          deco.sourceType = lower.endsWith('.webp') || file.type.includes('webp')
            ? 'webp'
            : lower.endsWith('.gif') || file.type.includes('gif')
              ? 'gif'
              : file.type.includes('jpeg') || /\.jpe?g$/i.test(lower)
                ? 'jpg'
                : 'png';
          deco.sourceText = '';
          deco.sourceData = bytesToBase64(new Uint8Array(reader.result));
          deco.mode = 'heightmap';
          deco.enabled = true;
          deco.clipToPanel = true;
          setExportStatus('Decor: image heightmap envoyee au WASM.', 'ok');
        }
        render();
      } catch (err) {
        console.error(err);
        setExportStatus(`Decor: conversion heightmap impossible (${err?.message || err}).`, 'error');
      }
    };
    reader.onerror = () => setExportStatus('Decor: impossible de lire le SVG.', 'error');
    if (isSvg) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });

  root.querySelector('[data-deco-clear]')?.addEventListener('click', () => {
    const deco = activeDeco();
    deco.sourceType = '';
    deco.sourceText = '';
    deco.sourceData = '';
    deco.enabled = false;
    render();
  });

  root.querySelector('[data-panel-preset]')?.addEventListener('change', (event) => {
    const value = event.target.value;
    if (!value || value === 'custom') return;
    const [w, h] = value.split('x').map(Number);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return;
    params.panelW = w;
    params.panelH = h;
    render();
  });

  root.querySelectorAll('[data-action="reset-view"]').forEach((button) => {
    button.addEventListener('click', () => {
      resetCameraView();
    });
  });

  root.querySelectorAll('[data-action="theme-toggle"]').forEach((button) => {
    button.addEventListener('click', () => {
      toggleTheme();
    });
  });

  root.querySelector('[data-action="export-house"]')?.addEventListener('click', () => {
    exportBinary(
      'nichoir_maison.stl',
      'model/stl',
      () => export_house_stl(JSON.stringify(params)),
      'Export maison vide: le modele n a genere aucun triangle.'
    );
  });

  root.querySelector('[data-action="export-door"]')?.addEventListener('click', () => {
    exportBinary(
      'nichoir_porte.stl',
      'model/stl',
      () => export_door_stl(JSON.stringify(params)),
      'Pas de porte STL: choisis une porte et active "Creer le panneau de porte".'
    );
  });

  root.querySelector('[data-action="export-panels"]')?.addEventListener('click', () => {
    exportBinary(
      'nichoir_panneaux.zip',
      'application/zip',
      () => export_panels_zip(JSON.stringify(params)),
      'Export panneaux vide: aucune piece n a ete generee.'
    );
  });

  root.querySelector('[data-action="export-plan"]')?.addEventListener('click', () => {
    try {
      const payload = parseResponse(plan_preview_svg(JSON.stringify(params)));
      if (payload && payload.svg) {
        download(payload.svg, 'nichoir_plan.svg', 'image/svg+xml');
        setExportStatus('Fichier cree: nichoir_plan.svg', 'ok');
      } else {
        setExportStatus('Export plan impossible: aucun SVG genere.', 'warn');
      }
    } catch (err) {
      console.error(err);
      setExportStatus(`Erreur export plan: ${err?.message || err}`, 'error');
    }
  });

  root.querySelector('[data-action="export-obj"]')?.addEventListener('click', () => {
    exportText(
      'nichoir_maison_debug.obj',
      'text/plain',
      () => export_house_obj(JSON.stringify(params)),
      'Export OBJ vide: le modele n a genere aucun triangle.'
    );
  });

  root.querySelector('[data-action="mesh-report"]')?.addEventListener('click', () => {
    try {
      const payload = parseResponse(mesh_report_json(JSON.stringify(params)));
      if (!payload) {
        setExportStatus('Rapport mesh impossible: reponse WASM invalide.', 'error');
        return;
      }
      const report = JSON.stringify(payload, null, 2);
      download(report, 'nichoir_mesh_report.json', 'application/json');
      const deg = payload.house?.degenerate_triangles ?? 0;
      const warnCount = payload.house?.warnings?.length ?? 0;
      const tone = deg || warnCount ? 'warn' : 'ok';
      setExportStatus(
        `Rapport cree: maison ${payload.house?.triangles ?? 0} triangles, ${deg} degeneres, ZIP ${(payload.zip_bytes ?? 0).toLocaleString('fr-CA')} octets`,
        tone
      );
    } catch (err) {
      console.error(err);
      setExportStatus(`Erreur rapport mesh: ${err?.message || err}`, 'error');
    }
  });

  bindTabs();
  renderPlanPreview();
  renderViewer();
  restoreUiState(uiState);
}

await init(new URL(`../wasm/pkg/wasm_bg.wasm?v=${APP_BUILD_ID}`, import.meta.url));
params = JSON.parse(default_params_json());
cameraState = initialCameraState();
applyTheme();
render();
