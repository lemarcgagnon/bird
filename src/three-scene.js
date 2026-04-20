// src/three-scene.js
// Scène, caméra, renderer, lumières. Expose aussi le groupe de panneaux et
// les plans de clipping. Ce module NE lit PAS le store — il est passif.

export function createScene(viewportEl) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x13151c);

  const camera = new THREE.PerspectiveCamera(45, viewportEl.clientWidth / viewportEl.clientHeight, 1, 5000);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(viewportEl.clientWidth, viewportEl.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.localClippingEnabled = true;
  viewportEl.appendChild(renderer.domElement);

  // Lumières
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const dl1 = new THREE.DirectionalLight(0xfff5e6, 0.85);
  dl1.position.set(250, 450, 350);
  scene.add(dl1);
  const dl2 = new THREE.DirectionalLight(0xe6f0ff, 0.3);
  dl2.position.set(-250, 200, -250);
  scene.add(dl2);

  // Grille de sol
  scene.add(new THREE.GridHelper(800, 24, 0x2a2d38, 0x1c1f28));

  // Plans de clipping (leur `constant` est ajusté à chaque rebuild)
  const clipPlanes = {
    x: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 100),
    y: new THREE.Plane(new THREE.Vector3(0, -1, 0), 100),
    z: new THREE.Plane(new THREE.Vector3(0, 0, -1), 100),
  };

  // Groupe qui contient tous les panneaux/décors reconstruits
  const panelGroup = new THREE.Group();
  scene.add(panelGroup);

  return { scene, camera, renderer, panelGroup, clipPlanes };
}

// Vide et dispose proprement un groupe Three.js.
export function clearGroup(group) {
  while (group.children.length) {
    const c = group.children[0];
    group.remove(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  }
}

// Applique la caméra orbitale. lookY est offset pour viser à 40% de la hauteur
// du nichoir plutôt que le sol.
export function updateCameraFromState(camera, camState, bodyHeight) {
  const lookX = camState.tx;
  const lookY = camState.ty + bodyHeight * 0.4;
  const lookZ = camState.tz;
  camera.position.set(
    lookX + camState.dist * Math.sin(camState.phi) * Math.cos(camState.theta),
    lookY + camState.dist * Math.cos(camState.phi),
    lookZ + camState.dist * Math.sin(camState.phi) * Math.sin(camState.theta)
  );
  camera.lookAt(lookX, lookY, lookZ);
}
