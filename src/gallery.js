import * as THREE from 'three';
import { gsap } from 'gsap';
import { gridToSphere, SPHERE_RADIUS, THETA_STEP } from './sphericalMap.js';
import { COLS, ROWS } from './cameras';
import { bakeCardTexture, CARD_ASPECT } from './cardTexture.js';

const GAP = 0.06;          // fraction of cell width left as black gap
const BASE_TINT = 0.73;    // resting brightness (multiplied onto the texture)

export class Gallery {
  constructor(scene, cards) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const width = 2 * SPHERE_RADIUS * Math.tan(THETA_STEP / 2) * (1 - GAP);
    const height = width / CARD_ASPECT;
    const geo = new THREE.PlaneGeometry(width, height);
    this.geo = geo;

    this.meshes = cards.map((card, i) => {
      const tex = bakeCardTexture(card, null); // placeholder; previews stream in via updatePreview
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      mat.color.setScalar(BASE_TINT);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.card = card;
      mesh.userData.col = i % COLS;
      mesh.userData.row = Math.floor(i / COLS);
      this.group.add(mesh);
      return mesh;
    });

    this.hovered = null;
    // Maintained by update(); read by raycasting and the refresh scheduler so
    // hot paths never re-filter (and never re-allocate) the mesh list.
    this.visibleMeshes = [];
  }

  update(offsetX, offsetY) {
    this.visibleMeshes.length = 0;
    for (const mesh of this.meshes) {
      const { visible, position } = gridToSphere(
        mesh.userData.col, mesh.userData.row, offsetX, offsetY, COLS, ROWS,
      );
      mesh.visible = visible;
      if (visible) {
        mesh.position.set(position[0], position[1], position[2]);
        mesh.lookAt(0, 0, 0);
        this.visibleMeshes.push(mesh);
      }
    }
  }

  /**
   * Re-bake a camera's preview onto every cell showing it. Bakes ONCE per
   * camera and shares the texture across its cells (their content is
   * identical) — matters at 10 re-bakes/sec.
   */
  updatePreview(deviceId, img) {
    let tex = null;
    for (const mesh of this.meshes) {
      const card = mesh.userData.card;
      if (card.deviceId !== deviceId) continue;
      card.pending = false;
      tex ??= bakeCardTexture(card, img);
      if (mesh.material.map !== tex) mesh.material.map?.dispose();
      mesh.material.map = tex;
      mesh.material.needsUpdate = true;
    }
  }

  /** Distinct on-screen cameras → pending flag (for the refresh scheduler). */
  visibleDeviceIds() {
    const seen = new Map();
    for (const mesh of this.visibleMeshes) {
      const card = mesh.userData.card;
      if (!seen.has(card.deviceId)) seen.set(card.deviceId, card.pending);
    }
    return seen;
  }

  dispose() {
    gsap.killTweensOf(this.meshes.map((m) => m.material.color));
    for (const mesh of this.meshes) {
      mesh.material.map?.dispose();
      mesh.material.dispose();
    }
    this.geo.dispose();
    this.group.removeFromParent();
  }

  setHover(mesh) {
    if (this.hovered === mesh) return;
    if (this.hovered) {
      gsap.to(this.hovered.material.color, {
        r: BASE_TINT, g: BASE_TINT, b: BASE_TINT, duration: 0.4, ease: 'power2.out', overwrite: 'auto',
      });
    }
    this.hovered = mesh;
    if (mesh) {
      gsap.to(mesh.material.color, { r: 1, g: 1, b: 1, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
    }
  }
}
