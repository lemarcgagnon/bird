import * as THREE from '/assets/three.module.min.js';

const DEFAULT_PREVIEW_LABEL = 'Preview STL';

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

function renderError(target, label) {
  target.textContent = label || DEFAULT_PREVIEW_LABEL;
  target.classList.add('library-stl-viewer-error');
}

function renderStlPayload(target, payload) {
  const geometry = trianglesToGeometry(payload.mesh_triangles);
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

  camera.position.set(radius * 0.7, radius * -0.95, radius * 1.45);
  camera.lookAt(0, 0, 0);
  camera.near = Math.max(radius / 1000, 0.01);
  camera.far = radius * 20;
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
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
