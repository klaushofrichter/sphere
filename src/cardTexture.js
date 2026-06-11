import * as THREE from 'three';

const W = 688;
const H = 592;
const MARGIN_X = 24;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;

export const CARD_ASPECT = W / H;

export function bakeCardTexture(card, image) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (image) {
    ctx.drawImage(image, MARGIN_X, MARGIN_TOP, 640, 480);
  } else {
    ctx.fillStyle = '#101010';
    ctx.fillRect(MARGIN_X, MARGIN_TOP, 640, 480);
    ctx.fillStyle = '#444';
    ctx.font = '600 28px "SF Mono", Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(card.pending ? 'LOADING…' : 'NO PREVIEW', W / 2, H / 2);
  }

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = '600 17px "SF Mono", Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('EEN', MARGIN_X, MARGIN_TOP / 2);
  ctx.textAlign = 'right';
  ctx.fillText(card.title.toUpperCase(), W - MARGIN_X, MARGIN_TOP / 2);

  const chipY = H - MARGIN_BOTTOM / 2;
  let x = MARGIN_X;
  ctx.font = '500 14px "SF Mono", Menlo, monospace';
  for (const tag of card.tags) {
    const tw = ctx.measureText(tag).width;
    ctx.fillStyle = '#262626';
    ctx.beginPath();
    ctx.roundRect(x, chipY - 13, tw + 20, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#cfcfcf';
    ctx.textAlign = 'left';
    ctx.fillText(tag, x + 10, chipY + 1);
    x += tw + 30;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
