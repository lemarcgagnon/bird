import * as THREE from '/assets/three.module.min.js';

const DEFAULT_PREVIEW_LABEL = 'Preview STL';
const MAX_PREVIEW_TRIANGLES = 1800;
const ALL_TRIANGLES = 0;
const EDGE_VERTEX_LIMIT = 180000;
const DEFAULT_VIEW = 'iso';
const VIEW_UP = new THREE.Vector3(0, 1, 0);
const ROTATE_DAMPING = 0.18;
const ROTATE_SPEED = 0.0048;
const PAN_SPEED = 0.95;
const MAX_VERTICAL_DOT = 0.965;
const VIEW_DIRECTIONS = {
  iso: new THREE.Vector3(0.7, -0.95, 1.45).normalize(),
  front: new THREE.Vector3(0, -0.02, 1).normalize(),
  top: new THREE.Vector3(0, 1, 0.02).normalize(),
  side: new THREE.Vector3(1, -0.02, 0).normalize(),
};
const DEFAULT_CONTROL_LABELS = {
  viewIso: 'Iso',
  viewFront: 'Face',
  viewTop: 'Haut',
  viewSide: 'Cote',
  rotate: 'Tourner',
  horizon: 'Horizon',
  pan: 'Deplacer',
  zoomIn: '+',
  zoomOut: '-',
  fit: 'Fit',
  reset: 'Reset',
};

function log(message, details = {}) {
  console.log('[nichoir library preview]', message, details);
}

function warn(message, details = {}) {
  console.warn('[nichoir library preview]', message, details);
}

function trianglesToGeometry(triangles) {
  const positions = [];
  (triangles || []).forEach((tri) => {
    if (!Array.isArray(tri) || tri.length < 3) return;
    tri.slice(0, 3).forEach((point) => {
      if (!Array.isArray(point) || point.length < 3) return;
      positions.push(Number(point[0]) || 0, Number(point[1]) || 0, Number(point[2]) || 0);
    });
  });
  if (positions.length < 9) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function triangleReadStep(triangleCount, maxTriangles) {
  const limit = Number(maxTriangles);
  if (!Number.isFinite(limit) || limit <= 0 || limit >= triangleCount) return 1;
  return Math.max(1, Math.ceil(triangleCount / Math.max(1, limit)));
}

function parseBinaryStl(bytes, maxTriangles = MAX_PREVIEW_TRIANGLES) {
  if (bytes.byteLength < 84) return [];
  const view = new DataView(bytes);
  const triCount = view.getUint32(80, true);
  const expected = 84 + (triCount * 50);
  if (triCount <= 0 || expected > bytes.byteLength) return [];
  const step = triangleReadStep(triCount, maxTriangles);
  const triangles = [];
  for (let i = 0; i < triCount; i += step) {
    const base = 84 + (i * 50) + 12;
    const tri = [];
    for (let v = 0; v < 3; v += 1) {
      const offset = base + (v * 12);
      tri.push([
        view.getFloat32(offset, true),
        view.getFloat32(offset + 4, true),
        view.getFloat32(offset + 8, true),
      ]);
    }
    triangles.push(tri);
  }
  return triangles;
}

function parseAsciiStl(bytes, maxTriangles = MAX_PREVIEW_TRIANGLES) {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const matches = [...text.matchAll(/vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g)];
  const triCount = Math.floor(matches.length / 3);
  if (triCount <= 0) return [];
  const step = triangleReadStep(triCount, maxTriangles);
  const triangles = [];
  for (let i = 0; i < triCount; i += step) {
    const tri = [];
    for (let v = 0; v < 3; v += 1) {
      const row = matches[(i * 3) + v];
      if (!row) break;
      tri.push([Number(row[1]) || 0, Number(row[2]) || 0, Number(row[3]) || 0]);
    }
    if (tri.length === 3) triangles.push(tri);
  }
  return triangles;
}

function parseStlBytes(bytes, maxTriangles = MAX_PREVIEW_TRIANGLES) {
  const binary = parseBinaryStl(bytes, maxTriangles);
  if (binary.length) return binary;
  return parseAsciiStl(bytes, maxTriangles);
}

function renderError(target, label) {
  target.textContent = label || DEFAULT_PREVIEW_LABEL;
  target.classList.add('library-stl-viewer-error');
}

function viewerControlLabels(options = {}) {
  return {
    ...DEFAULT_CONTROL_LABELS,
    ...(options.controlLabels || {}),
  };
}

function createViewerButton(label, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.addEventListener('click', onClick);
  return button;
}

function createViewerToolbar(controller, options = {}) {
  const labels = viewerControlLabels(options);
  const toolbar = document.createElement('div');
  toolbar.className = 'library-viewer-toolbar';
  toolbar.setAttribute('aria-label', 'Commandes apercu STL');

  const viewGroup = document.createElement('div');
  viewGroup.className = 'library-viewer-toolbar-group';
  const viewButtons = new Map();
  [
    ['iso', labels.viewIso],
    ['front', labels.viewFront],
    ['top', labels.viewTop],
    ['side', labels.viewSide],
  ].forEach(([view, label]) => {
    const button = createViewerButton(label, label, () => controller.setView(view));
    viewButtons.set(view, button);
    viewGroup.appendChild(button);
  });

  const modeGroup = document.createElement('div');
  modeGroup.className = 'library-viewer-toolbar-group';
  const modeButtons = new Map();
  [
    ['rotate', labels.rotate],
    ['horizon', labels.horizon],
    ['pan', labels.pan],
  ].forEach(([mode, label]) => {
    const button = createViewerButton(label, label, () => controller.setMode(mode));
    modeButtons.set(mode, button);
    modeGroup.appendChild(button);
  });

  const zoomGroup = document.createElement('div');
  zoomGroup.className = 'library-viewer-toolbar-group';
  zoomGroup.appendChild(createViewerButton(labels.zoomIn, 'Zoom avant', () => controller.zoom(0.84)));
  zoomGroup.appendChild(createViewerButton(labels.zoomOut, 'Zoom arriere', () => controller.zoom(1.16)));

  const actionGroup = document.createElement('div');
  actionGroup.className = 'library-viewer-toolbar-group';
  actionGroup.appendChild(createViewerButton(labels.fit, labels.fit, () => controller.fit()));
  actionGroup.appendChild(createViewerButton(labels.reset, labels.reset, () => controller.reset()));

  toolbar.append(viewGroup, modeGroup, zoomGroup, actionGroup);
  controller.onStateChange((state) => {
    viewButtons.forEach((button, view) => {
      button.setAttribute('aria-pressed', state.view === view ? 'true' : 'false');
    });
    modeButtons.forEach((button, mode) => {
      button.setAttribute('aria-pressed', state.mode === mode ? 'true' : 'false');
    });
  });
  controller.emitState();
  return toolbar;
}

function renderGeometry(target, geometry, options = {}) {
  if (!geometry) {
    renderError(target, 'Preview STL indisponible');
    return null;
  }

  target.textContent = '';
  target.classList.remove('library-stl-viewer-error');
  target.classList.toggle('has-viewer-controls', Boolean(options.controls));
  const width = Math.max(120, options.width || target.clientWidth || 180);
  const height = Math.max(120, options.height || target.clientHeight || 180);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#fffdf8');

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100000);
  camera.up.copy(VIEW_UP);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer),
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.domElement.setAttribute('aria-label', DEFAULT_PREVIEW_LABEL);
  renderer.domElement.setAttribute('title', 'Glisser pour tourner/deplacer, molette pour zoomer');

  let canvasHost = target;
  let shell = null;
  if (options.controls) {
    shell = document.createElement('div');
    shell.className = 'library-viewer-shell';
    canvasHost = document.createElement('div');
    canvasHost.className = 'library-viewer-stage';
    shell.appendChild(canvasHost);
    target.appendChild(shell);
  }
  canvasHost.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.62));
  const key = new THREE.DirectionalLight(0xfff0d6, 1.0);
  key.position.set(3, -4, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdbeafe, 0.42);
  fill.position.set(-4, 3, 4);
  scene.add(fill);

  const material = new THREE.MeshPhongMaterial({
    color: 0xb86f17,
    emissive: 0x2a1604,
    emissiveIntensity: 0.08,
    shininess: 28,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const group = new THREE.Group();
  group.add(mesh);
  const vertexCount = geometry.getAttribute('position')?.count || 0;
  const edgeLimit = Number(options.edgeVertexLimit || EDGE_VERTEX_LIMIT);
  if (options.showEdges !== false && vertexCount <= edgeLimit) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 20),
      new THREE.LineBasicMaterial({ color: 0x5f3b16, transparent: true, opacity: 0.55 })
    );
    group.add(edges);
  }
  scene.add(group);

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1);
  group.position.sub(center);

  const baseDistance = radius * (options.distanceMultiplier || 2.0);
  const minDistance = radius * 0.35;
  const maxDistance = radius * 10;
  let targetDistance = baseDistance;
  let renderedDistance = baseDistance;
  let activeView = DEFAULT_VIEW;
  let interactionMode = 'rotate';
  const targetCameraDir = VIEW_DIRECTIONS[DEFAULT_VIEW].clone();
  const renderedCameraDir = targetCameraDir.clone();
  const targetPanOffset = new THREE.Vector3();
  const renderedPanOffset = new THREE.Vector3();
  const stateListeners = new Set();
  let animationFrame = 0;
  const emitState = () => {
    stateListeners.forEach((listener) => listener({ view: activeView, mode: interactionMode }));
  };
  const renderNow = () => {
    camera.up.copy(VIEW_UP);
    camera.position.copy(renderedCameraDir).multiplyScalar(renderedDistance).add(renderedPanOffset);
    camera.lookAt(renderedPanOffset);
    renderer.render(scene, camera);
  };
  const settleRenderTargets = () => {
    renderedCameraDir.copy(targetCameraDir);
    renderedPanOffset.copy(targetPanOffset);
    renderedDistance = targetDistance;
  };
  const animateRender = () => {
    animationFrame = 0;
    renderedCameraDir.lerp(targetCameraDir, ROTATE_DAMPING).normalize();
    renderedPanOffset.lerp(targetPanOffset, ROTATE_DAMPING);
    renderedDistance += (targetDistance - renderedDistance) * ROTATE_DAMPING;
    renderNow();
    const settled =
      renderedCameraDir.angleTo(targetCameraDir) < 0.001 &&
      renderedPanOffset.distanceToSquared(targetPanOffset) < Math.max(radius * radius * 0.000001, 0.000001) &&
      Math.abs(renderedDistance - targetDistance) < Math.max(radius * 0.001, 0.001);
    if (!settled) {
      animationFrame = window.requestAnimationFrame(animateRender);
    } else {
      settleRenderTargets();
      renderNow();
    }
  };
  const render = (immediate = false) => {
    if (immediate) {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      settleRenderTargets();
      renderNow();
      return;
    }
    if (!animationFrame) animationFrame = window.requestAnimationFrame(animateRender);
  };
  const orbitCamera = (dx, dy) => {
    const yaw = -dx * ROTATE_SPEED;
    if (yaw) targetCameraDir.applyAxisAngle(VIEW_UP, yaw).normalize();
    if (interactionMode !== 'horizon') {
      const right = new THREE.Vector3().crossVectors(VIEW_UP, targetCameraDir);
      if (right.lengthSq() < 0.000001) right.set(1, 0, 0);
      right.normalize();
      const candidate = targetCameraDir.clone().applyAxisAngle(right, -dy * ROTATE_SPEED).normalize();
      if (Math.abs(candidate.dot(VIEW_UP)) < MAX_VERTICAL_DOT) targetCameraDir.copy(candidate);
    }
  };
  camera.near = Math.max(radius / 1000, 0.01);
  camera.far = radius * 40;
  camera.updateProjectionMatrix();

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
    canvasHost.classList.add('is-dragging');
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (interactionMode === 'pan') {
      camera.updateMatrixWorld();
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const panScale = targetDistance / Math.max(width, height) * PAN_SPEED;
      targetPanOffset.addScaledVector(right, -dx * panScale);
      targetPanOffset.addScaledVector(up, dy * panScale);
    } else {
      orbitCamera(dx, dy);
      activeView = 'custom';
    }
    render();
    emitState();
  });
  const finishDrag = (event) => {
    dragging = false;
    canvasHost.classList.remove('is-dragging');
    try {
      renderer.domElement.releasePointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture may already be released by the browser.
    }
  };
  renderer.domElement.addEventListener('pointerup', finishDrag);
  renderer.domElement.addEventListener('pointercancel', finishDrag);
  renderer.domElement.addEventListener('wheel', (event) => {
    event.preventDefault();
    targetDistance = Math.min(maxDistance, Math.max(minDistance, targetDistance * (event.deltaY > 0 ? 1.08 : 0.92)));
    render();
  }, { passive: false });

  const setMode = (mode) => {
    interactionMode = mode === 'pan' || mode === 'horizon' ? mode : 'rotate';
    canvasHost.classList.toggle('is-pan-mode', interactionMode === 'pan');
    canvasHost.classList.toggle('is-horizon-mode', interactionMode === 'horizon');
    emitState();
  };
  const setView = (name) => {
    const nextView = VIEW_DIRECTIONS[name] ? name : DEFAULT_VIEW;
    activeView = nextView;
    targetCameraDir.copy(VIEW_DIRECTIONS[nextView]);
    targetDistance = nextView === 'front' ? radius * 1.9 : baseDistance;
    targetPanOffset.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    render();
    emitState();
  };
  const fit = () => {
    targetDistance = baseDistance;
    targetPanOffset.set(0, 0, 0);
    render();
  };
  const reset = () => {
    group.rotation.set(0, 0, 0);
    activeView = DEFAULT_VIEW;
    targetCameraDir.copy(VIEW_DIRECTIONS[DEFAULT_VIEW]);
    targetDistance = baseDistance;
    targetPanOffset.set(0, 0, 0);
    setMode('rotate');
    render();
    emitState();
  };
  const controller = {
    render,
    setMode,
    setView,
    fit,
    reset,
    zoom(factor) {
      const value = Number(factor);
      targetDistance = Math.min(maxDistance, Math.max(minDistance, targetDistance * (Number.isFinite(value) ? value : 1)));
      render();
    },
    onStateChange(listener) {
      if (typeof listener === 'function') stateListeners.add(listener);
    },
    emitState,
    state() {
      return { view: activeView, mode: interactionMode };
    },
    snapshot() {
      render(true);
      return renderer.domElement.toDataURL('image/png');
    },
  };
  if (shell && options.controls) {
    shell.insertBefore(createViewerToolbar(controller, options), canvasHost);
  }
  setMode(options.mode || 'horizon');
  render(true);
  return controller;
}

function renderStlPayload(target, payload, options = {}) {
  return renderGeometry(target, trianglesToGeometry(payload.mesh_triangles), options);
}

export async function renderLocalStlFilePreview(target, file) {
  target.textContent = 'Chargement preview STL...';
  target.classList.remove('library-stl-viewer-error');
  try {
    const bytes = await file.arrayBuffer();
    const triangles = parseStlBytes(bytes, ALL_TRIANGLES);
    renderGeometry(target, trianglesToGeometry(triangles), { showEdges: triangles.length <= 60000 });
    log('local_stl_preview_rendered', { name: file.name, triangles: triangles.length, untouched: true });
  } catch (error) {
    warn('local_stl_preview_failed', { name: file?.name || '', error: error.message || String(error) });
    renderError(target, 'Preview STL indisponible');
  }
}

async function loadOriginalStlGeometry(stlUrl, maxTriangles = ALL_TRIANGLES) {
  const response = await fetch(stlUrl, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(response.statusText || 'stl_load_failed');
  const bytes = await response.arrayBuffer();
  const triangles = parseStlBytes(bytes, maxTriangles);
  const geometry = trianglesToGeometry(triangles);
  if (!geometry) throw new Error('stl_parse_failed');
  return { bytes, triangles, geometry };
}

export async function renderOriginalStlUrlPreview(target, stlUrl, options = {}) {
  if (!target || !stlUrl) return null;
  target.textContent = options.loadingLabel || 'Chargement STL original...';
  target.classList.remove('library-stl-viewer-error');
  try {
    const loaded = await loadOriginalStlGeometry(stlUrl, options.maxTriangles || ALL_TRIANGLES);
    target.replaceChildren();
    const controller = renderGeometry(target, loaded.geometry, {
      controls: true,
      width: Math.max(280, target.clientWidth || 360),
      height: Math.max(280, target.clientHeight || 360),
      distanceMultiplier: 2.0,
      showEdges: loaded.triangles.length <= 60000,
      ...(options.viewerOptions || {}),
    });
    log('original_stl_url_preview_rendered', {
      url: stlUrl,
      bytes: loaded.bytes.byteLength,
      triangles: loaded.triangles.length,
      untouched: true,
    });
    return controller;
  } catch (error) {
    warn('original_stl_url_preview_failed', { url: stlUrl, error: error.message || String(error) });
    renderError(target, options.errorLabel || 'STL original indisponible');
    return null;
  }
}

export async function renderAdminOriginalStlViewers(root = document) {
  const targets = Array.from(root.querySelectorAll('[data-library-admin-stl-viewer]'));
  if (!targets.length) return;
  await Promise.all(targets.map(async (target) => {
    const itemId = Number(target.dataset.libraryAdminStlViewer || 0);
    if (!itemId || target.dataset.originalRendered === '1') return;
    target.dataset.originalRendered = '1';
    target.textContent = 'Chargement STL original...';
    target.classList.remove('library-stl-viewer-error');
    log('admin_original_stl_request', { itemId });
    try {
      const response = await fetch(`/api/admin/library/stl-file?item_id=${encodeURIComponent(itemId)}`, {
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(response.statusText || 'stl_load_failed');
      const bytes = await response.arrayBuffer();
      const triangles = parseStlBytes(bytes, ALL_TRIANGLES);
      const geometry = trianglesToGeometry(triangles);
      if (!geometry) throw new Error('stl_parse_failed');
      target.replaceChildren();
      renderGeometry(target, geometry, {
        width: Math.max(240, target.clientWidth || 280),
        height: Math.max(240, target.clientHeight || 280),
        distanceMultiplier: 2.0,
        showEdges: triangles.length <= 60000,
        controls: true,
      });
      log('admin_original_stl_rendered', {
        itemId,
        bytes: bytes.byteLength,
        triangles: triangles.length,
        untouched: true,
      });
    } catch (error) {
      warn('admin_original_stl_failed', { itemId, error: error.message || String(error) });
      renderError(target, 'STL original indisponible');
    }
  }));
}

export function attachLibraryThumbnailEditor(root = document) {
  const modal = root.querySelector('[data-library-thumbnail-modal]');
  if (!modal || modal.dataset.thumbnailEditorAttached === '1') return;
  modal.dataset.thumbnailEditorAttached = '1';
  const csrfToken = modal.dataset.csrf || '';
  const stage = modal.querySelector('[data-library-thumbnail-stage]');
  const title = modal.querySelector('#library-thumbnail-title');
  const status = modal.querySelector('[data-library-thumbnail-status]');
  const saveButton = modal.querySelector('[data-library-thumbnail-save]');
  let currentItemId = 0;
  let currentController = null;

  const setStatus = (message) => {
    if (status) status.textContent = message || '';
  };
  const close = () => {
    modal.hidden = true;
    currentItemId = 0;
    currentController = null;
    if (stage) stage.replaceChildren();
    setStatus('');
  };
  modal.querySelector('[data-library-thumbnail-close]')?.addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  modal.querySelectorAll('[data-library-thumbnail-view]').forEach((button) => {
    button.addEventListener('click', () => {
      currentController?.setView(button.dataset.libraryThumbnailView || 'iso');
    });
  });

  root.querySelectorAll('[data-library-thumbnail-editor]').forEach((button) => {
    button.addEventListener('click', async () => {
      currentItemId = Number(button.dataset.libraryThumbnailEditor || 0);
      if (!currentItemId || !stage) return;
      modal.hidden = false;
      if (title) title.textContent = button.dataset.libraryThumbnailTitle || 'Vignette STL';
      stage.replaceChildren();
      stage.textContent = 'Chargement STL...';
      setStatus('');
      log('thumbnail_editor_open', { itemId: currentItemId });
      try {
        const response = await fetch(`/api/admin/library/stl-file?item_id=${encodeURIComponent(currentItemId)}`, {
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error(response.statusText || 'stl_load_failed');
        const bytes = await response.arrayBuffer();
        const triangles = parseStlBytes(bytes, ALL_TRIANGLES);
        const geometry = trianglesToGeometry(triangles);
        stage.replaceChildren();
        currentController = renderGeometry(stage, geometry, {
          preserveDrawingBuffer: true,
          width: Math.max(360, stage.clientWidth || 512),
          height: Math.max(360, stage.clientHeight || 512),
          distanceMultiplier: 2.0,
          controls: true,
        });
        currentController?.setView('iso');
        setStatus(`${triangles.length} triangles originaux`);
        log('thumbnail_editor_loaded', { itemId: currentItemId, triangles: triangles.length, untouched: true });
      } catch (error) {
        warn('thumbnail_editor_load_failed', { itemId: currentItemId, error: error.message || String(error) });
        renderError(stage, 'STL indisponible');
        setStatus('Chargement refuse');
      }
    });
  });

  saveButton?.addEventListener('click', async () => {
    if (!currentItemId || !currentController) return;
    saveButton.disabled = true;
    setStatus('Enregistrement...');
    try {
      const pngDataUrl = currentController.snapshot();
      const response = await fetch('/api/admin/library/thumbnail', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csrf_token: csrfToken,
          item_id: currentItemId,
          png_data_url: pngDataUrl,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || response.statusText);
      const url = payload.thumbnail_url || `/api/library/thumbnail?item_id=${encodeURIComponent(currentItemId)}&v=${Date.now()}`;
      root.querySelectorAll(`[data-library-thumbnail-img="${currentItemId}"]`).forEach((img) => {
        img.src = url;
      });
      setStatus('PNG sauvegarde');
      log('thumbnail_editor_saved', { itemId: currentItemId });
    } catch (error) {
      warn('thumbnail_editor_save_failed', { itemId: currentItemId, error: error.message || String(error) });
      setStatus('Enregistrement refuse');
    } finally {
      saveButton.disabled = false;
    }
  });
}

export async function renderLibraryStlPreviews(root = document) {
  const targets = Array.from(root.querySelectorAll('[data-library-stl-preview]'));
  if (!targets.length) return;
  await Promise.all(targets.map(async (target) => {
    const itemId = Number(target.dataset.libraryStlPreview || 0);
    if (!itemId || target.dataset.previewRendered === '1') return;
    target.dataset.previewRendered = '1';
    log('stl_preview_request', { itemId });
    try {
      try {
        const originalUrl = `/api/library/stl-original-preview?item_id=${encodeURIComponent(itemId)}`;
        const loaded = await loadOriginalStlGeometry(originalUrl, ALL_TRIANGLES);
        target.replaceChildren();
        renderGeometry(target, loaded.geometry, {
          width: Math.max(96, target.clientWidth || 120),
          height: Math.max(96, target.clientHeight || target.clientWidth || 120),
          distanceMultiplier: 2.0,
          showEdges: loaded.triangles.length <= 60000,
        });
        log('stl_original_preview_rendered', {
          itemId,
          bytes: loaded.bytes.byteLength,
          triangles: loaded.triangles.length,
          untouched: true,
        });
        return;
      } catch (originalError) {
        warn('stl_original_preview_failed_fallback', { itemId, error: originalError.message || String(originalError) });
      }
      const response = await fetch(`/api/library/stl-preview?item_id=${encodeURIComponent(itemId)}`, {
        credentials: 'same-origin',
      });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) throw new Error(payload.error || response.statusText);
      renderStlPayload(target, payload);
      log('stl_preview_rendered', {
        itemId,
        sampled_triangles: payload.sampled_triangles,
        bbox: payload.bbox,
      });
    } catch (error) {
      warn('stl_preview_failed', { itemId, error: error.message || String(error) });
      renderError(target, 'Preview STL indisponible');
    }
  }));
}

export async function renderPublicLibraryStlPreview(target, itemId, options = {}) {
  if (!target || !itemId) return null;
  target.textContent = options.loadingLabel || 'Chargement STL...';
  target.classList.remove('library-stl-viewer-error');
  log('public_stl_preview_request', { itemId });
  try {
    const originalUrl = options.originalUrl || `/api/library/stl-original-preview?item_id=${encodeURIComponent(itemId)}`;
    if (options.preferOriginal !== false && originalUrl) {
      try {
        const loaded = await loadOriginalStlGeometry(originalUrl, ALL_TRIANGLES);
        target.replaceChildren();
        const controller = renderGeometry(target, loaded.geometry, {
          controls: true,
          width: Math.max(280, target.clientWidth || 360),
          height: Math.max(280, target.clientHeight || 360),
          distanceMultiplier: 2.0,
          showEdges: loaded.triangles.length <= 60000,
          ...(options.viewerOptions || {}),
        });
        log('public_original_stl_preview_rendered', {
          itemId,
          source: originalUrl,
          bytes: loaded.bytes.byteLength,
          triangles: loaded.triangles.length,
          untouched: true,
        });
        return controller;
      } catch (originalError) {
        warn('public_original_stl_preview_failed_fallback', { itemId, error: originalError.message || String(originalError) });
      }
    }
    const detail = options.detail || 'high';
    const response = await fetch(`/api/library/stl-preview?item_id=${encodeURIComponent(itemId)}&detail=${encodeURIComponent(detail)}`, {
      credentials: 'same-origin',
    });
    const payload = await response.json();
    if (!response.ok || payload.ok === false) throw new Error(payload.error || response.statusText);
    target.replaceChildren();
    const controller = renderStlPayload(target, payload, {
      controls: true,
      width: Math.max(280, target.clientWidth || 360),
      height: Math.max(280, target.clientHeight || 360),
      distanceMultiplier: 2.0,
      ...(options.viewerOptions || {}),
    });
    log('public_stl_preview_rendered', {
      itemId,
      sampled_triangles: payload.sampled_triangles,
      bbox: payload.bbox,
    });
    return controller;
  } catch (error) {
    warn('public_stl_preview_failed', { itemId, error: error.message || String(error) });
    renderError(target, options.errorLabel || 'Preview STL indisponible');
    return null;
  }
}

renderLibraryStlPreviews();
renderAdminOriginalStlViewers();
attachLibraryThumbnailEditor();
