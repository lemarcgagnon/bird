import * as THREE from '/assets/three.module.min.js';

const DEFAULT_PREVIEW_LABEL = 'Preview STL';
const MAX_PREVIEW_TRIANGLES = 1800;

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

function parseBinaryStl(bytes) {
  if (bytes.byteLength < 84) return [];
  const view = new DataView(bytes);
  const triCount = view.getUint32(80, true);
  const expected = 84 + (triCount * 50);
  if (triCount <= 0 || expected > bytes.byteLength) return [];
  const step = Math.max(1, Math.ceil(triCount / MAX_PREVIEW_TRIANGLES));
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

function parseAsciiStl(bytes) {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const matches = [...text.matchAll(/vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g)];
  const triCount = Math.floor(matches.length / 3);
  if (triCount <= 0) return [];
  const step = Math.max(1, Math.ceil(triCount / MAX_PREVIEW_TRIANGLES));
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

function parseStlBytes(bytes) {
  const binary = parseBinaryStl(bytes);
  if (binary.length) return binary;
  return parseAsciiStl(bytes);
}

function renderError(target, label) {
  target.textContent = label || DEFAULT_PREVIEW_LABEL;
  target.classList.add('library-stl-viewer-error');
}

function renderGeometry(target, geometry) {
  if (!geometry) {
    renderError(target, 'Preview STL indisponible');
    return;
  }

  target.textContent = '';
  target.classList.remove('library-stl-viewer-error');
  const width = Math.max(120, target.clientWidth || 180);
  const height = Math.max(120, target.clientHeight || 180);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#fffdf8');

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.domElement.setAttribute('aria-label', DEFAULT_PREVIEW_LABEL);
  renderer.domElement.setAttribute('title', 'Glisser pour tourner, molette pour zoomer');
  target.appendChild(renderer.domElement);

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
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 20),
    new THREE.LineBasicMaterial({ color: 0x5f3b16, transparent: true, opacity: 0.55 })
  );
  const group = new THREE.Group();
  group.add(mesh);
  group.add(edges);
  scene.add(group);

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1);
  group.position.sub(center);

  let distance = radius * 2.0;
  const cameraDir = new THREE.Vector3(0.7, -0.95, 1.45).normalize();
  const render = () => {
    camera.position.copy(cameraDir).multiplyScalar(distance);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  };
  camera.near = Math.max(radius / 1000, 0.01);
  camera.far = radius * 20;
  camera.updateProjectionMatrix();

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
    target.classList.add('is-dragging');
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    group.rotation.z += dx * 0.01;
    group.rotation.x += dy * 0.01;
    render();
  });
  renderer.domElement.addEventListener('pointerup', (event) => {
    dragging = false;
    target.classList.remove('is-dragging');
    try {
      renderer.domElement.releasePointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture may already be released by the browser.
    }
  });
  renderer.domElement.addEventListener('wheel', (event) => {
    event.preventDefault();
    distance = Math.min(radius * 8, Math.max(radius * 0.6, distance * (event.deltaY > 0 ? 1.12 : 0.88)));
    render();
  }, { passive: false });

  render();
}

function renderStlPayload(target, payload) {
  renderGeometry(target, trianglesToGeometry(payload.mesh_triangles));
}

export async function renderLocalStlFilePreview(target, file) {
  target.textContent = 'Chargement preview STL...';
  target.classList.remove('library-stl-viewer-error');
  try {
    const bytes = await file.arrayBuffer();
    const triangles = parseStlBytes(bytes);
    renderGeometry(target, trianglesToGeometry(triangles));
    log('local_stl_preview_rendered', { name: file.name, sampled_triangles: triangles.length });
  } catch (error) {
    warn('local_stl_preview_failed', { name: file?.name || '', error: error.message || String(error) });
    renderError(target, 'Preview STL indisponible');
  }
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

renderLibraryStlPreviews();
