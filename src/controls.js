import { gsap } from 'gsap';

const DRAG_SPEED = 0.0022; // radians of scroll per pixel of pointer travel
const EASE = 0.085;        // per-frame lerp factor toward target (calibrated for 60 fps)
const CLICK_DIST = 6;      // px of travel below which pointerup counts as a click
const FLING = 0.45;        // velocity-to-distance scale: extra radians = velocity (rad/s) * FLING (s)

export class Controls {
  constructor(el, onClick) {
    this.onClick = onClick;
    this.enabled = true;
    this.target = { x: 0, y: 0 };
    this.current = { x: 0, y: 0 };
    this.dragging = false;
    this.start = null;
    this.last = { x: 0, y: 0, t: 0 }; // mutated in place (pointermove fires often)
    this.velocity = { x: 0, y: 0 };
    this._hoverCard = false;

    this.el = el;
    this._onDown = (e) => this.onDown(e);
    this._onMove = (e) => this.onMove(e);
    this._onUp = (e) => this.onUp(e);
    this._onCancel = () => this.cancel();

    el.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onCancel);
  }

  onDown(e) {
    if (!this.enabled || e.button !== 0) return;
    this.dragging = true;
    this.start = { x: e.clientX, y: e.clientY };
    this.last.x = e.clientX;
    this.last.y = e.clientY;
    this.last.t = performance.now();
    this.velocity = { x: 0, y: 0 };
    gsap.killTweensOf(this.target);
    document.body.classList.add('dragging');
  }

  onMove(e) {
    if (!this.dragging) return;
    const now = performance.now();
    const dx = e.clientX - this.last.x;
    const dy = e.clientY - this.last.y;
    const dt = Math.max(now - this.last.t, 1);
    this.target.x -= dx * DRAG_SPEED;
    this.target.y += dy * DRAG_SPEED;
    this.velocity.x = (-dx * DRAG_SPEED / dt) * 1000;
    this.velocity.y = (dy * DRAG_SPEED / dt) * 1000;
    this.last.x = e.clientX;
    this.last.y = e.clientY;
    this.last.t = now;
  }

  onUp(e) {
    if (!this.dragging) return;
    this.dragging = false;
    document.body.classList.remove('dragging');
    const travel = Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y);
    if (performance.now() - this.last.t > 80) {
      this.velocity.x = 0;
      this.velocity.y = 0;
    }
    if (travel < CLICK_DIST) {
      this.onClick(e);
      return;
    }
    gsap.to(this.target, {
      x: this.target.x + this.velocity.x * FLING,
      y: this.target.y + this.velocity.y * FLING,
      duration: 1.4,
      ease: 'power3.out',
    });
  }

  cancel() {
    if (!this.dragging) return;
    this.dragging = false;
    document.body.classList.remove('dragging');
  }

  tick() {
    this.current.x += (this.target.x - this.current.x) * EASE;
    this.current.y += (this.target.y - this.current.y) * EASE;
  }

  /**
   * Cursor state lives here alongside the 'dragging' class: Controls owns
   * every body class that reflects pointer interaction. No-ops when the
   * state hasn't changed, so calling it every frame is free.
   */
  setHoverCard(on) {
    if (on === this._hoverCard) return;
    this._hoverCard = on;
    document.body.classList.toggle('hover-card', on);
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onCancel);
    gsap.killTweensOf(this.target);
    document.body.classList.remove('dragging', 'hover-card');
  }
}
