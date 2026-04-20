// src/ui/camera-input.js
// Souris / molette / touch → mutations de l'état caméra.
// Le module n'appelle pas rebuild() : la caméra se met à jour dans animate().

export function bindCameraInputs(viewportEl, store) {
  let mouse = { down: false, x: 0, y: 0, btn: 0, shift: false };
  let tch = { x: 0, y: 0, d: 0, cx: 0, cy: 0 };

  const doPan = (dx, dy) => {
    const cam = store.getState().camera;
    const rx = Math.sin(cam.theta), rz = -Math.cos(cam.theta);
    const sp = Math.sin(cam.phi), cp = Math.cos(cam.phi);
    const ux = -cp * Math.cos(cam.theta), uy = sp, uz = -cp * Math.sin(cam.theta);
    const scale = cam.dist * 0.0013;
    store.setState(s => ({
      ...s,
      camera: {
        ...s.camera,
        tx: s.camera.tx + (-dx * rx + dy * ux) * scale,
        ty: s.camera.ty + dy * uy * scale,
        tz: s.camera.tz + (-dx * rz + dy * uz) * scale,
      },
    }));
  };

  const orbit = (dx, dy) => {
    store.setState(s => ({
      ...s,
      camera: {
        ...s.camera,
        theta: s.camera.theta - dx * 0.007,
        phi: Math.max(0.15, Math.min(Math.PI - 0.15, s.camera.phi + dy * 0.007)),
      },
    }));
  };

  const zoom = (factor) => {
    store.setState(s => ({
      ...s,
      camera: { ...s.camera, dist: Math.max(80, Math.min(2500, s.camera.dist * factor)) },
    }));
  };

  viewportEl.addEventListener('mousedown', e => {
    mouse = { down: true, x: e.clientX, y: e.clientY, btn: e.button, shift: e.shiftKey };
  });
  viewportEl.addEventListener('mousemove', e => {
    if (!mouse.down) return;
    const dx = e.clientX - mouse.x, dy = e.clientY - mouse.y;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (mouse.btn === 2 || mouse.btn === 1 || mouse.shift) doPan(dx, dy);
    else orbit(dx, dy);
  });
  viewportEl.addEventListener('mouseup', () => { mouse.down = false; });
  viewportEl.addEventListener('mouseleave', () => { mouse.down = false; });
  viewportEl.addEventListener('wheel', e => {
    zoom(1 + e.deltaY * 0.0012);
  }, { passive: true });
  viewportEl.addEventListener('contextmenu', e => e.preventDefault());

  viewportEl.addEventListener('dblclick', () => {
    store.setState(s => ({
      ...s,
      camera: { theta: Math.PI * 0.25, phi: Math.PI / 3.2, dist: 550, tx: 0, ty: 0, tz: 0 },
    }));
  });

  viewportEl.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      tch.x = e.touches[0].clientX; tch.y = e.touches[0].clientY;
    }
    if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      tch.d = Math.sqrt(dx*dx + dy*dy);
      tch.cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      tch.cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    }
  }, { passive: true });

  viewportEl.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - tch.x, dy = e.touches[0].clientY - tch.y;
      tch.x = e.touches[0].clientX; tch.y = e.touches[0].clientY;
      orbit(dx, dy);
    }
    if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (tch.d > 0) zoom(tch.d / d);
      tch.d = d;
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      doPan(cx - tch.cx, cy - tch.cy);
      tch.cx = cx; tch.cy = cy;
    }
  }, { passive: false });
}
