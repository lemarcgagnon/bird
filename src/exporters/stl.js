// src/exporters/stl.js
// Export STL binaire : maison complète, porte seule, ZIP panneau par panneau.
// Lit les meshes depuis le groupe Three.js (pas le store).

import { t } from '../i18n.js';
import { DECO_KEYS } from '../state.js';

const HOUSE_KEYS = ['front', 'back', 'left', 'right', 'bottom', 'roofL', 'roofR', 'perch'];
const DECO_STL_KEYS = DECO_KEYS.map(k => 'deco_' + k);

// Extrait les triangles monde d'un mesh, en appliquant sa transformation de base.
function meshTriangles(mesh, bPos, bRot) {
  const tmp = new THREE.Object3D();
  tmp.position.set(bPos[0], bPos[1], bPos[2]);
  tmp.rotation.set(bRot[0], bRot[1], bRot[2]);
  tmp.updateMatrixWorld(true);
  const mx = tmp.matrixWorld;

  const geo = mesh.geometry;
  const pos = geo.getAttribute('position');
  const idx = geo.getIndex();
  const nf = idx ? idx.count/3 : pos.count/3;
  const tris = [];

  const _ba = new THREE.Vector3();
  const _ca = new THREE.Vector3();

  for (let i = 0; i < nf; i++) {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    if (idx) {
      a.fromBufferAttribute(pos, idx.getX(i*3));
      b.fromBufferAttribute(pos, idx.getX(i*3+1));
      c.fromBufferAttribute(pos, idx.getX(i*3+2));
    } else {
      a.fromBufferAttribute(pos, i*3);
      b.fromBufferAttribute(pos, i*3+1);
      c.fromBufferAttribute(pos, i*3+2);
    }
    a.applyMatrix4(mx); b.applyMatrix4(mx); c.applyMatrix4(mx);
    _ba.subVectors(b, a);
    _ca.subVectors(c, a);
    const n = new THREE.Vector3().crossVectors(_ba, _ca).normalize();
    tris.push({ n, a, b, c });
  }
  return tris;
}

function trisToSTL(tris, label) {
  const buf = new ArrayBuffer(80 + 4 + tris.length * 50);
  const dv = new DataView(buf);
  const hdr = 'Nichoir - ' + (label || 'export');
  for (let i = 0; i < hdr.length && i < 80; i++) dv.setUint8(i, hdr.charCodeAt(i));
  dv.setUint32(80, tris.length, true);
  let o = 84;
  tris.forEach(tri => {
    [tri.n, tri.a, tri.b, tri.c].forEach(v => {
      dv.setFloat32(o, v.x, true); o += 4;
      dv.setFloat32(o, v.y, true); o += 4;
      dv.setFloat32(o, v.z, true); o += 4;
    });
    dv.setUint16(o, 0, true); o += 2;
  });
  return buf;
}

function dlBlob(buf, name) {
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
}

function collectPanelTris(panelGroup, keys) {
  const tris = [];
  panelGroup.children.forEach(c => {
    if (c.isMesh && c.userData.panelKey && keys.includes(c.userData.panelKey)) {
      tris.push(...meshTriangles(c, c.userData.basePos, c.userData.baseRot));
    }
  });
  return tris;
}

// Toast fugace pour retour visuel des exports lourds.
function showBusyToast(msg) {
  let el = document.getElementById('busy-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'busy-toast';
    el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);'
      + 'background:#e8a955;color:#0f1117;padding:8px 18px;border-radius:4px;'
      + 'font-family:"Space Mono",monospace;font-size:12px;font-weight:700;z-index:9999;'
      + 'box-shadow:0 4px 16px rgba(0,0,0,.5);';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
}
function hideBusyToast() {
  const el = document.getElementById('busy-toast');
  if (el) el.style.display = 'none';
}

function runExportWithFeedback(label, work) {
  showBusyToast('⏳ ' + label + '…');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      const t0 = performance.now();
      const result = work();
      const dt = Math.round(performance.now() - t0);
      if (result && typeof result.then === 'function') {
        result.then(() => {
          hideBusyToast();
          showBusyToast('✓ ' + label + ' (' + dt + ' ms)');
          setTimeout(hideBusyToast, 1500);
        }).catch(err => {
          hideBusyToast();
          alert(t('export.error.generic', { message: err?.message || err }));
          console.error(err);
        });
      } else {
        hideBusyToast();
        showBusyToast('✓ ' + label + ' (' + dt + ' ms)');
        setTimeout(hideBusyToast, 1500);
      }
    } catch(err) {
      hideBusyToast();
      alert(t('export.error.generic', { message: err?.message || err }));
      console.error(err);
    }
  }));
}

export function exportHouseSTL(panelGroup) {
  runExportWithFeedback(t('export.busy.house'), () => {
    const tris = collectPanelTris(panelGroup, [...HOUSE_KEYS, ...DECO_STL_KEYS]);
    if (!tris.length) { alert(t('export.error.nothing')); return; }
    dlBlob(trisToSTL(tris, 'maison_complete'), 'nichoir_maison.stl');
  });
}

export function exportDoorSTL(panelGroup) {
  runExportWithFeedback(t('export.busy.door'), () => {
    const tris = collectPanelTris(panelGroup, ['doorPanel']);
    if (!tris.length) { alert(t('export.error.noDoor')); return; }
    dlBlob(trisToSTL(tris, 'porte'), 'nichoir_porte.stl');
  });
}

export function exportPanelsZIP(panelGroup, params) {
  if (typeof JSZip === 'undefined') { alert(t('export.error.noJSZip')); return; }
  runExportWithFeedback(t('export.busy.zip'), () => {
    const zip = new JSZip();
    const allKeys = [...HOUSE_KEYS];
    if (params.door !== 'none' && params.doorPanel) allKeys.push('doorPanel');

    let totalFiles = 0;
    allKeys.forEach(key => {
      const collectKeys = [key];
      if (DECO_KEYS.includes(key)) collectKeys.push('deco_' + key);
      const tris = collectPanelTris(panelGroup, collectKeys);
      if (tris.length) {
        const fname = t('panel.' + key) + '.stl';
        zip.file(fname, trisToSTL(tris, key));
        totalFiles++;
      }
    });

    if (!totalFiles) { alert(t('export.error.nothing')); return; }

    return zip.generateAsync({ type: 'blob' }).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nichoir_panneaux.zip';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
    });
  });
}
