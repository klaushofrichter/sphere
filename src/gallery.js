import * as THREE from 'three';
import { gsap } from 'gsap';
import { gridToSphere, SPHERE_RADIUS, THETA_STEP } from './sphericalMap.js';
import { COLS, ROWS } from './data.js';
import { bakeCardTexture, CARD_ASPECT } from './cardTexture.js';

const GAP = 0.06;          // fraction of cell width left as black gap
const BASE_TINT = 0.73;    // resting brightness (multiplied onto the texture)

export class Gallery {
  constructor(scene, cards, images) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const width = 2 * SPHERE_RADIUS * Math.tan(THETA_STEP / 2) * (1 - GAP);
    const height = width / CARD_ASPECT;
    const geo = new THREE.PlaneGeometry(width, height);

    this.meshes = cards.map((card, i) => {
      const tex = bakeCardTexture(card, images[i]);
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
  }

  update(offsetX, offsetY) {
    for (const mesh of this.meshes) {
      const { visible, position } = gridToSphere(
        mesh.userData.col, mesh.userData.row, offsetX, offsetY, COLS, ROWS,
      );
      mesh.visible = visible;
      if (visible) {
        mesh.position.set(position[0], position[1], position[2]);
        mesh.lookAt(0, 0, 0);
      }
    }
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
