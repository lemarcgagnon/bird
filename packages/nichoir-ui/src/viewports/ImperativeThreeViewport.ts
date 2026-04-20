// src/viewports/ImperativeThreeViewport.ts
//
// Implémentation de ViewportAdapter utilisant Three.js impératif (r160+).
// Wrappe la logique de src/three-scene.js (createScene, updateCameraFromState)
// et src/geometry/panels.materializeDefs (porté dans ../rendering/materializeDefs).
//
// Respecte les invariants V1-V7 de VIEWPORT.md :
//   V1 : aucune référence React/JSX
//   V2 : les consumers ne voient que l'interface ViewportAdapter (pas THREE)
//   V3 : ne touche qu'à son <canvas> enfant du host, jamais au parent
//   V4 : cycle mount → N×update → unmount ; throws sur ordres inversés
//   V5 : chaque instance a son propre scene/camera/renderer (pas de singleton)
//   V6 : unmount() idempotent (no-op si déjà démonté)
//   V7 : ResizeObserver attaché dans mount(), disconnect dans unmount()

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildPanelDefs } from '@nichoir/core';
import type { NichoirState, BuildResult } from '@nichoir/core';
import type { ViewportAdapter } from './ViewportAdapter.js';
import { materializeDefs, clearGroup } from '../rendering/materializeDefs.js';

// Registre module-level des hosts occupés par un ViewportAdapter actif.
// Respecte VIEWPORT.md:56 : "throws si `el` est déjà hôte d'un autre adapter actif".
// WeakSet : n'empêche pas le GC du host quand il est détaché du DOM.
const MOUNTED_HOSTS = new WeakSet<HTMLElement>();

export class ImperativeThreeViewport implements ViewportAdapter {
  // State interne : tous initialisés à null pour respecter V4 (peut throw si utilisés pré-mount)
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private panelGroup: THREE.Group | null = null;
  private clipPlanes: { x: THREE.Plane; y: THREE.Plane; z: THREE.Plane } | null = null;
  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animationFrame: number | null = null;
  private lastState: NichoirState | null = null;
  // Cible de lookAt (lookX, lookY, lookZ) dérivée de state.camera + state.params.H.
  // Persistée pour permettre l'inverse mapping dans readCameraState() même si
  // camera.position est muté par des controls externes (P2.1+).
  private lookTarget: THREE.Vector3 | null = null;
  // OrbitControls (souris : rotate/pan/zoom). Autorité sur camera.position +
  // controls.target post-mount. Disposé à l'unmount pour nettoyer les listeners
  // pointer attachés au canvas (V3 + V7 : pas de listener global, propre au cycle).
  private controls: OrbitControls | null = null;

  mount(el: HTMLElement, initialState: NichoirState): void {
    if (this.host) {
      throw new Error('ImperativeThreeViewport: mount() called while already mounted. Call unmount() first.');
    }
    if (MOUNTED_HOSTS.has(el)) {
      throw new Error('ImperativeThreeViewport: the host element is already occupied by another adapter. Unmount it first.');
    }

    // Mount atomique : on commit host + MOUNTED_HOSTS immédiatement pour que le
    // rollback (unmount) puisse nettoyer proprement si quelque chose échoue plus
    // loin (ex: WebGLRenderer qui throw sur absence de WebGL).
    this.host = el;
    MOUNTED_HOSTS.add(el);

    try {
      const w = Math.max(1, el.clientWidth);
      const h = Math.max(1, el.clientHeight);

      // ─── Scene setup (port de createScene dans src/three-scene.js) ──────────
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x13151c);

      this.camera = new THREE.PerspectiveCamera(45, w / h, 1, 5000);

      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(w, h, false);
      this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
      this.renderer.localClippingEnabled = true;
      this.canvas = this.renderer.domElement;
      el.appendChild(this.canvas);

      // Lumières (1:1 vs src)
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
      const dl1 = new THREE.DirectionalLight(0xfff5e6, 0.85);
      dl1.position.set(250, 450, 350);
      this.scene.add(dl1);
      const dl2 = new THREE.DirectionalLight(0xe6f0ff, 0.3);
      dl2.position.set(-250, 200, -250);
      this.scene.add(dl2);

      // Grille de sol (1:1 vs src)
      this.scene.add(new THREE.GridHelper(800, 24, 0x2a2d38, 0x1c1f28));

      // Plans de clipping (constants ajustés à chaque update)
      this.clipPlanes = {
        x: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 100),
        y: new THREE.Plane(new THREE.Vector3(0, -1, 0), 100),
        z: new THREE.Plane(new THREE.Vector3(0, 0, -1), 100),
      };

      // Groupe des panneaux (rebuild complet à chaque update)
      this.panelGroup = new THREE.Group();
      this.scene.add(this.panelGroup);

      // ─── V7 : ResizeObserver sur le host ──────────────────────────────────
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(el);
      } else if (typeof window !== 'undefined') {
        // Fallback V7 : window resize listener
        window.addEventListener('resize', this.handleResize);
      }

      // ─── Première update + démarrage animation loop ───────────────────────
      this.update(initialState);

      // ─── OrbitControls : rotate/pan/zoom souris (P3 feature) ──────────────
      // Créé APRÈS la première update() pour que lookTarget existe et soit
      // synchronisé avec controls.target. enableDamping=false : pas besoin de
      // tick controls.update() en loop, les events input suffisent à pousser
      // camera.position + controls.target. L'animation loop re-render à chaque
      // frame, ce qui visualise les mouvements souris instantanément.
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enablePan = true;
      this.controls.enableZoom = true;
      this.controls.enableRotate = true;
      this.controls.enableDamping = false;
      if (this.lookTarget) this.controls.target.copy(this.lookTarget);

      this.startAnimationLoop();
    } catch (err) {
      // Rollback atomique : unmount() est idempotent et null-guarded, il nettoie
      // tout ce qui a été commité avant l'échec (host, MOUNTED_HOSTS, canvas
      // attaché, renderer WebGL, ResizeObserver, etc.). On re-throw l'erreur
      // d'origine pour que l'appelant soit informé.
      this.unmount();
      throw err;
    }
  }

  update(state: NichoirState): void {
    if (!this.scene || !this.panelGroup || !this.clipPlanes) {
      throw new Error('ImperativeThreeViewport: update() called before mount().');
    }

    // Rebuild complet du panelGroup
    clearGroup(this.panelGroup);
    const buildResult: BuildResult = buildPanelDefs(state);

    // Collecter les plans de clipping actifs
    const activeClipPlanes: THREE.Plane[] = [];
    if (buildResult.clipPlanesOut.x) {
      this.clipPlanes.x.constant = buildResult.clipPlanesOut.x.constant;
      activeClipPlanes.push(this.clipPlanes.x);
    }
    if (buildResult.clipPlanesOut.y) {
      this.clipPlanes.y.constant = buildResult.clipPlanesOut.y.constant;
      activeClipPlanes.push(this.clipPlanes.y);
    }
    if (buildResult.clipPlanesOut.z) {
      this.clipPlanes.z.constant = buildResult.clipPlanesOut.z.constant;
      activeClipPlanes.push(this.clipPlanes.z);
    }

    materializeDefs(this.panelGroup, buildResult, state.params.mode, activeClipPlanes);

    // Mise à jour de la caméra : uniquement si state.camera a changé de
    // référence (ou premier update au mount). Sans cette garde, chaque
    // changement de slider UI (W, H, door, etc.) écraserait la rotation
    // interactive de l'utilisateur — OrbitControls deviendrait inutilisable.
    // Zustand garantit une nouvelle référence sur `state.camera` uniquement
    // quand `setState({ camera: ... })` est appelé explicitement.
    const cameraChanged = !this.lastState || this.lastState.camera !== state.camera;
    if (cameraChanged) {
      this.updateCameraFromState(state);
      // Re-synchroniser controls.target après que updateCameraFromState a
      // reconstruit lookTarget (peut être différent si params.H ou tx/ty/tz
      // ont changé côté store).
      if (this.controls && this.lookTarget) {
        this.controls.target.copy(this.lookTarget);
      }
    }

    this.lastState = state;
  }

  unmount(): void {
    // V6 : idempotent
    if (!this.host) return;

    // Arrêter la loop d'animation
    if (this.animationFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrame);
    }
    this.animationFrame = null;

    // Disposer OrbitControls : retire les listeners pointer attachés au canvas
    // (V3 : propre au cycle de vie de l'adapter).
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    // V7 : cleanup resize listeners
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
    }

    // Dispose scene/panel resources
    if (this.panelGroup) {
      clearGroup(this.panelGroup);
    }
    // Dispose aussi les ressources autres que panelGroup dans scene.children
    // (AmbientLight, DirectionalLight × 2, GridHelper, panelGroup lui-même).
    // scene.traverse visite tous les descendants. dispose() est idempotent sur
    // BufferGeometry (2e appel = no-op). Lights n'ont pas de dispose mais le
    // optional chaining ?.() le gère. Sans ce nettoyage, GridHelper laisse
    // fuiter un BufferGeometry + LineBasicMaterial par cycle mount/unmount.
    if (this.scene) {
      this.scene.traverse((obj) => {
        const d = obj as unknown as {
          geometry?: { dispose?: () => void };
          material?: { dispose?: () => void };
        };
        d.geometry?.dispose?.();
        d.material?.dispose?.();
      });
    }
    if (this.renderer) {
      this.renderer.dispose();
      // V3 : retirer uniquement notre canvas, pas le host
      if (this.canvas && this.canvas.parentNode === this.host) {
        this.host.removeChild(this.canvas);
      }
    }

    // Libérer le host du registre des hôtes occupés (fin de la promesse mount:56).
    if (this.host) MOUNTED_HOSTS.delete(this.host);

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.panelGroup = null;
    this.clipPlanes = null;
    this.host = null;
    this.canvas = null;
    this.lastState = null;
    this.lookTarget = null;
  }

  readCameraState(): NichoirState['camera'] {
    if (!this.camera || !this.lastState || !this.lookTarget) {
      throw new Error('ImperativeThreeViewport: readCameraState() called before mount().');
    }
    // Inverse mapping : depuis camera.position (autorité) + lookTarget (persisté) +
    // bodyHeight du lastState, on reconstruit {theta, phi, dist, tx, ty, tz}.
    //
    // updateCameraFromState fait :
    //   lookX = tx, lookY = ty + bodyHeight*0.4, lookZ = tz
    //   pos.x = lookX + dist*sin(phi)*cos(theta)
    //   pos.y = lookY + dist*cos(phi)
    //   pos.z = lookZ + dist*sin(phi)*sin(theta)
    //
    // Donc :
    //   delta = pos - lookTarget
    //   dist  = |delta|
    //   phi   = acos(delta.y / dist)             (phi ∈ [0, π])
    //   theta = atan2(delta.z, delta.x)          (theta ∈ (-π, π])
    //   tx, ty, tz = lookTarget[x, y - bodyHeight*0.4, z]
    //
    // Cette formulation capte l'état actuel de la caméra même si un control
    // externe (OrbitControls à venir en P2.1+) a mué camera.position.
    const deltaX = this.camera.position.x - this.lookTarget.x;
    const deltaY = this.camera.position.y - this.lookTarget.y;
    const deltaZ = this.camera.position.z - this.lookTarget.z;
    const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
    // Garde-fou contre dist=0 (caméra sur la cible) : retourner les valeurs du state.
    if (dist < 1e-9) return { ...this.lastState.camera };
    const phi = Math.acos(Math.max(-1, Math.min(1, deltaY / dist)));
    const theta = Math.atan2(deltaZ, deltaX);
    const bodyHeight = this.lastState.params.H;
    return {
      theta,
      phi,
      dist,
      tx: this.lookTarget.x,
      ty: this.lookTarget.y - bodyHeight * 0.4,
      tz: this.lookTarget.z,
    };
  }

  // ─── Internes ──────────────────────────────────────────────────────────────

  private updateCameraFromState(state: NichoirState): void {
    if (!this.camera) return;
    const { theta, phi, dist, tx, ty, tz } = state.camera;
    const bodyHeight = state.params.H;
    const lookX = tx;
    const lookY = ty + bodyHeight * 0.4;
    const lookZ = tz;
    this.camera.position.set(
      lookX + dist * Math.sin(phi) * Math.cos(theta),
      lookY + dist * Math.cos(phi),
      lookZ + dist * Math.sin(phi) * Math.sin(theta),
    );
    this.camera.lookAt(lookX, lookY, lookZ);
    // Persistance du lookTarget pour l'inverse mapping dans readCameraState().
    if (!this.lookTarget) {
      this.lookTarget = new THREE.Vector3(lookX, lookY, lookZ);
    } else {
      this.lookTarget.set(lookX, lookY, lookZ);
    }
  }

  private handleResize = (): void => {
    if (!this.host || !this.camera || !this.renderer) return;
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false); // V3 : updateStyle=false
  };

  private startAnimationLoop(): void {
    if (typeof requestAnimationFrame === 'undefined') return; // env sans raf (tests node)
    const tick = (): void => {
      if (!this.scene || !this.camera || !this.renderer) return;
      this.renderer.render(this.scene, this.camera);
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }
}
