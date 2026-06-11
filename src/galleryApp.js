import * as THREE from 'three';
import { gsap } from 'gsap';
import { loadCameraCards } from './cameras';
import { bakeCardTexture } from './cardTexture.js';
import { Gallery } from './gallery.js';
import { Controls } from './controls.js';
import { Overlay } from './overlay.js';

let ctx = null;
let startGen = 0;

export async function startGallery(container) {
  if (ctx) {
    console.warn('startGallery called while a gallery is already running; ignoring');
    return;
  }

  const gen = ++startGen;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(
    65, window.innerWidth / window.innerHeight, 0.1, 50,
  );

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  gsap.ticker.lagSmoothing(0);

  const onPreview = (deviceId, dataUrl) => {
    const apply = (img) => {
      if (gen !== startGen) return; // gallery torn down before this preview arrived
      for (const mesh of gallery.meshes) {
        const card = mesh.userData.card;
        if (card.deviceId !== deviceId) continue;
        card.pending = false;
        const tex = bakeCardTexture(card, img);
        mesh.material.map?.dispose();
        mesh.material.map = tex;
        mesh.material.needsUpdate = true;
      }
    };
    if (!dataUrl) { apply(null); return; }
    const img = new Image();
    img.onload = () => apply(img);
    img.onerror = () => apply(null);
    img.src = dataUrl;
  };

  const { cards, error } = await loadCameraCards(onPreview);

  const cleanupPartial = () => {
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
  if (gen !== startGen) { cleanupPartial(); return; }
  if (error) { cleanupPartial(); return { error }; }

  const gallery = new Gallery(scene, cards, cards.map(() => null));
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let pointerOnScreen = false;
  const onPointerMove = (e) => {
    pointerOnScreen = true;
    pointerNdc.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    );
  };
  window.addEventListener('pointermove', onPointerMove);

  function pick() {
    if (!pointerOnScreen) return null;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(gallery.meshes.filter((m) => m.visible));
    return hits.length ? hits[0].object : null;
  }

  const overlay = new Overlay();

  const controls = new Controls(renderer.domElement, () => {
    const mesh = pick();
    if (mesh) {
      controls.enabled = false;
      gallery.setHover(null);
      overlay.open(mesh.userData.card);
    }
  });
  overlay.onCloseStart = () => { controls.enabled = true; };

  const tick = () => {
    controls.tick();
    gallery.update(controls.current.x, controls.current.y);
    const hoverMesh = (controls.dragging || overlay.isOpen) ? null : pick();
    gallery.setHover(hoverMesh);
    document.body.classList.toggle('hover-card', !!hoverMesh && !controls.dragging);
    renderer.render(scene, camera);
  };
  gsap.ticker.add(tick);

  camera.fov = 95;
  camera.updateProjectionMatrix();
  gsap.to(camera, {
    fov: 65,
    duration: 1.8,
    ease: 'power3.inOut',
    onUpdate: () => camera.updateProjectionMatrix(),
  });
  gsap.from(controls.target, { x: 0.6, y: -0.3, duration: 1.8, ease: 'power3.out' });

  // Test hook (dev server only): lets e2e tests wait for motion to settle by
  // reading controls state instead of diffing canvas pixels. Set last, after
  // the intro tweens exist, so its presence implies the intro has started.
  if (import.meta.env.DEV) {
    window.__sphere = { controls };
  }

  ctx = { renderer, gallery, overlay, controls, tick, onResize, onPointerMove, camera };
}

export function destroyGallery() {
  startGen++; // cancels any in-flight startGallery
  if (!ctx) return;
  gsap.ticker.remove(ctx.tick);
  gsap.killTweensOf(ctx.camera);
  window.removeEventListener('resize', ctx.onResize);
  window.removeEventListener('pointermove', ctx.onPointerMove);
  ctx.controls.dispose();
  ctx.overlay.dispose();
  ctx.gallery.dispose();
  ctx.renderer.dispose();
  ctx.renderer.forceContextLoss(); // release the GL context so cycles don't exhaust the ~16-context cap
  ctx.renderer.domElement.remove();
  document.body.classList.remove('hover-card', 'dragging');
  if (import.meta.env.DEV) delete window.__sphere;
  ctx = null;
}
