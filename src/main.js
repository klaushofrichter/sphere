import * as THREE from 'three';
import { gsap } from 'gsap';
import { makeCards } from './data.js';
import { Gallery } from './gallery.js';
import { Controls } from './controls.js';
import { Overlay } from './overlay.js';

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(
  65, window.innerWidth / window.innerHeight, 0.1, 50,
);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function loadImages(cards) {
  return Promise.all(cards.map((c) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = c.image;
  })));
}

gsap.ticker.lagSmoothing(0);

const cards = makeCards();
const images = await loadImages(cards);
const gallery = new Gallery(scene, cards, images);
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let pointerOnScreen = false;
window.addEventListener('pointermove', (e) => {
  pointerOnScreen = true;
  pointerNdc.set(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
  );
});

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

gsap.ticker.add(() => {
  controls.tick();
  gallery.update(controls.current.x, controls.current.y);
  const hoverMesh = (controls.dragging || overlay.isOpen) ? null : pick();
  gallery.setHover(hoverMesh);
  document.body.classList.toggle('hover-card', !!hoverMesh && !controls.dragging);
  renderer.render(scene, camera);
});

camera.fov = 95;
camera.updateProjectionMatrix();
gsap.to(camera, {
  fov: 65,
  duration: 1.8,
  ease: 'power3.inOut',
  onUpdate: () => camera.updateProjectionMatrix(),
});
gsap.from(controls.target, { x: 0.6, y: -0.3, duration: 1.8, ease: 'power3.out' });
