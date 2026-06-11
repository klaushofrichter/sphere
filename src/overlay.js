import { gsap } from 'gsap';

const PALETTE = ['#5b5bd6', '#d65b5b', '#3e8e5a', '#c98a2d', '#7a4fd0', '#2d8fc9'];

export class Overlay {
  constructor() {
    this.el = document.getElementById('overlay');
    this.clientEl = document.getElementById('overlay-client');
    this.titleEl = document.getElementById('overlay-title');
    this.metaEl = document.getElementById('overlay-meta');
    this.paneEl = document.querySelector('.video-pane');
    this.isOpen = false;
    this.onCloseStart = null;

    this._onCloseClick = () => this.close();
    this._closeBtn = document.getElementById('overlay-close');
    this._closeBtn.addEventListener('click', this._onCloseClick);
    this._onKeydown = (e) => {
      if (e.key === 'Escape') this.close();
    };
    window.addEventListener('keydown', this._onKeydown);
  }

  open(card) {
    if (this.isOpen) return;
    this.isOpen = true;
    this.el.style.background = PALETTE[card.id % PALETTE.length];
    this.clientEl.textContent = 'EEN';
    this.titleEl.textContent = card.title;
    this.metaEl.textContent = card.tags.join('  ·  ');
    this.el.setAttribute('aria-hidden', 'false');

    gsap.timeline()
      .set(this.el, { display: 'block' })
      .fromTo(this.el,
        { clipPath: 'inset(100% 0 0 0)' },
        { clipPath: 'inset(0% 0 0 0)', duration: 0.7, ease: 'power4.inOut' })
      .from([this.clientEl, this.titleEl, this.metaEl, this.paneEl], {
        y: 60, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out',
      }, '-=0.25');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.onCloseStart) this.onCloseStart();
    gsap.to(this.el, {
      clipPath: 'inset(0 0 100% 0)',
      duration: 0.55,
      ease: 'power4.inOut',
      onComplete: () => {
        gsap.set(this.el, { display: 'none' });
        this.el.setAttribute('aria-hidden', 'true');
      },
    });
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeydown);
    this._closeBtn.removeEventListener('click', this._onCloseClick);
    gsap.killTweensOf([this.el, this.clientEl, this.titleEl, this.metaEl, this.paneEl]);
  }
}
