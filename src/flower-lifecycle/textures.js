import * as THREE from 'three';
import { mulberry32 } from './utils.js';

// Procedural canvas textures. Every texture is drawn in code: no external images are loaded.

export const PETAL_PALETTES = {
  stargazer: { label: 'Stargazer pink', throat: '#eef0c9', centre: '#fff4f1', flank: '#e0608c', margin: '#fbd3df', tip: '#f2a2bb', spot: '#9c0f3d' },
  blush: { label: 'Blush white', throat: '#eef2cf', centre: '#fffdfb', flank: '#f6c3d1', margin: '#fffafa', tip: '#fbe4ea', spot: '#b4385e' },
  magenta: { label: 'Deep magenta', throat: '#e8ecc0', centre: '#ffe3ec', flank: '#c8336b', margin: '#ef8fb1', tip: '#d75b88', spot: '#5e0623' },
  coral: { label: 'Coral sunset', throat: '#f1edbf', centre: '#fff1e6', flank: '#f08a6c', margin: '#fdd1bf', tip: '#f5a283', spot: '#8f2a16' },
};

export function canvasTexture(w, h, draw, { srgb = true, anisotropy = 4, repeat } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const texture = new THREE.CanvasTexture(canvas);
  texture.userData.redraw = (...args) => {
    draw(canvas.getContext('2d'), w, h, ...args);
    texture.needsUpdate = true;
  };
  texture.userData.redraw();
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
  }
  return texture;
}

// Petal: canvas x spans the width (uv.x), canvas top is the tip (uv.y = 1), bottom is the base.
export function drawPetal(ctx, w, h, palette = PETAL_PALETTES.stargazer) {
  const rand = mulberry32(4031);
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.flank;
  ctx.fillRect(0, 0, w, h);

  // lighter margins
  const across = ctx.createLinearGradient(0, 0, w, 0);
  across.addColorStop(0, palette.margin);
  across.addColorStop(0.17, palette.flank + '00');
  across.addColorStop(0.83, palette.flank + '00');
  across.addColorStop(1, palette.margin);
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, w, h);

  // tip colour
  const tip = ctx.createLinearGradient(0, 0, 0, h * 0.45);
  tip.addColorStop(0, palette.tip);
  tip.addColorStop(1, palette.tip + '00');
  ctx.fillStyle = tip;
  ctx.fillRect(0, 0, w, h * 0.45);

  // white centre band running from the throat up the middle of the petal
  const band = ctx.createRadialGradient(w / 2, h * 1.02, 0, w / 2, h * 1.02, h * 0.62);
  band.addColorStop(0, palette.centre);
  band.addColorStop(0.55, palette.centre + 'cc');
  band.addColorStop(1, palette.centre + '00');
  ctx.save();
  ctx.scale(0.55, 1);
  ctx.translate((w / 0.55 - w) / 2, 0);
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // green-cream throat at the base (nectary)
  const throat = ctx.createLinearGradient(0, h, 0, h * 0.82);
  throat.addColorStop(0, palette.throat);
  throat.addColorStop(1, palette.throat + '00');
  ctx.fillStyle = throat;
  ctx.fillRect(0, h * 0.82, w, h * 0.18);

  // veins: thin lines fanning from the base towards the tip
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 26; i++) {
    const x0 = w * (0.47 + (rand() - 0.5) * 0.08);
    const x1 = w * (0.06 + (i / 25) * 0.88);
    ctx.strokeStyle = `rgba(160, 40, 80, ${0.06 + rand() * 0.06})`;
    ctx.beginPath();
    ctx.moveTo(x0, h);
    ctx.quadraticCurveTo(lerpX(x0, x1, 0.5), h * 0.45, x1, h * (0.02 + rand() * 0.06));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w / 2, h);
  ctx.lineTo(w / 2, h * 0.08);
  ctx.stroke();

  // papillae spots, concentrated near the centre line in the lower half
  for (let i = 0; i < 260; i++) {
    const v = 0.08 + Math.pow(rand(), 1.3) * 0.55;
    const spread = 0.12 + v * 0.35;
    const x = w * (0.5 + (rand() + rand() + rand() - 1.5) * spread * 0.9);
    const y = h * (1 - v);
    const r = (2 + rand() * 4.6) * (1.1 - v * 0.6);
    ctx.fillStyle = palette.spot;
    ctx.globalAlpha = 0.7 + rand() * 0.3;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.8, r * (1.2 + rand() * 0.8), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
const lerpX = (a, b, t) => a + (b - a) * t;

// Grey-scale bump for petals: raised papillae and veins.
export function drawPetalBump(ctx, w, h) {
  const rand = mulberry32(4031);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const x0 = w * (0.47 + (rand() - 0.5) * 0.08);
    const x1 = w * (0.06 + (i / 25) * 0.88);
    rand();
    ctx.strokeStyle = 'rgba(70, 70, 70, 0.5)';
    ctx.beginPath();
    ctx.moveTo(x0, h);
    ctx.quadraticCurveTo(lerpX(x0, x1, 0.5), h * 0.45, x1, h * (0.02 + rand() * 0.06));
    ctx.stroke();
  }
  for (let i = 0; i < 260; i++) {
    const v = 0.08 + Math.pow(rand(), 1.3) * 0.55;
    const spread = 0.12 + v * 0.35;
    const x = w * (0.5 + (rand() + rand() + rand() - 1.5) * spread * 0.9);
    const y = h * (1 - v);
    const r = (2 + rand() * 4.6) * (1.1 - v * 0.6);
    rand(); rand();
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
    g.addColorStop(0, '#e0e0e0');
    g.addColorStop(1, '#80808000');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Lily leaf: parallel venation (monocot) with a pale midrib. x = width, top = tip.
export function drawLeaf(ctx, w, h) {
  const rand = mulberry32(911);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#2f5a1f');
  g.addColorStop(0.5, '#4f8a2f');
  g.addColorStop(1, '#2f5a1f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const lengthwise = ctx.createLinearGradient(0, 0, 0, h);
  lengthwise.addColorStop(0, 'rgba(120, 160, 60, 0.25)');
  lengthwise.addColorStop(1, 'rgba(20, 50, 15, 0.25)');
  ctx.fillStyle = lengthwise;
  ctx.fillRect(0, 0, w, h);
  for (let i = 1; i < 14; i++) {
    const x = (i / 14) * w;
    ctx.strokeStyle = `rgba(190, 220, 140, ${0.1 + rand() * 0.08})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.quadraticCurveTo(x, h * 0.3, w / 2 + (x - w / 2) * 0.15, 0);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(205, 230, 160, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w / 2, h);
  ctx.lineTo(w / 2, 0);
  ctx.stroke();
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(${rand() < 0.5 ? '20,40,10' : '150,190,90'}, 0.05)`;
    ctx.fillRect(rand() * w, rand() * h, 2, 2 + rand() * 6);
  }
}

export function drawStem(ctx, w, h) {
  const rand = mulberry32(77);
  ctx.fillStyle = '#4c7a2c';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${rand() < 0.5 ? '25,55,15' : '140,180,80'}, ${0.08 + rand() * 0.08})`;
    ctx.fillRect(rand() * w, 0, 1 + rand() * 2, h);
  }
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = 'rgba(80, 30, 40, 0.18)';
    ctx.fillRect(rand() * w, rand() * h, 1.5, 1.5);
  }
}

export function drawCapsule(ctx, w, h) {
  const rand = mulberry32(5150);
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${rand() < 0.5 ? '90,90,90' : '255,255,255'}, ${0.08 + rand() * 0.12})`;
    ctx.fillRect(rand() * w, 0, 1 + rand() * 2.5, h);
  }
}

export function drawSoil(ctx, w, h) {
  const rand = mulberry32(2718);
  ctx.fillStyle = '#2b2118';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const r = 1 + rand() * 6;
    const shade = rand();
    ctx.fillStyle = shade < 0.5 ? `rgba(18, 12, 8, ${0.3 + rand() * 0.4})` : shade < 0.85 ? `rgba(78, 60, 42, ${0.25 + rand() * 0.35})` : `rgba(120, 108, 92, ${0.35 + rand() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, r, r * (0.6 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(70, 95, 40, ${0.18 + rand() * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, 8 + rand() * 30, 6 + rand() * 18, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Soft round sprite for motes and the sun glow.
export function drawGlow(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Out-of-focus garden backdrop, painted to wrap seamlessly around a cylinder.
export const BACKGROUNDS = {
  garden: { label: 'Garden bokeh' },
  mist: { label: 'Morning mist' },
  night: { label: 'Night studio' },
};

export function drawBackdrop(ctx, w, h, background = 'garden', lighting = 'sunset') {
  const rand = mulberry32(background === 'garden' ? 101 : background === 'mist' ? 202 : 303);
  const warm = lighting === 'sunset';
  const palettes = {
    garden: warm
      ? { top: '#3d4a22', mid: '#17241a', bottom: '#0b120c', blobs: ['#5f7d33', '#9fb54a', '#2e4a26', '#e8c46a', '#d9a443'], light: '#ffd58a' }
      : { top: '#6f8f55', mid: '#2c4a2a', bottom: '#142417', blobs: ['#7ea65a', '#b5d27a', '#3c6b34', '#e4f2c0', '#8fbf6a'], light: '#f4fbe2' },
    mist: warm
      ? { top: '#f3dcc0', mid: '#c9c2a2', bottom: '#8f9474', blobs: ['#f7e3c4', '#e5cfa4', '#bfc59a', '#fff1d8', '#d9b98c'], light: '#fff3dc' }
      : { top: '#e4ecdf', mid: '#bccbb5', bottom: '#8ea088', blobs: ['#f1f6ec', '#d3e0cb', '#a9bfa2', '#ffffff', '#c4d6bc'], light: '#ffffff' },
    night: warm
      ? { top: '#221a16', mid: '#120f0d', bottom: '#080707', blobs: ['#3a2a1e', '#5c4024', '#1f1a14', '#8a5a2e', '#2a2018'], light: '#c58a4e' }
      : { top: '#151c22', mid: '#0c1014', bottom: '#060809', blobs: ['#1f2a33', '#2c3a44', '#141c22', '#4a5d6b', '#1a242c'], light: '#8fa6b8' },
  };
  const p = palettes[background] ?? palettes.garden;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, p.top);
  grad.addColorStop(0.55, p.mid);
  grad.addColorStop(1, p.bottom);
  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // The canvas wraps a cylinder whose circumference/height ratio is ~2.1x the canvas aspect,
  // so circles are drawn squeezed horizontally to look round on screen.
  const squeeze = (2 * Math.PI * 3.4) / 5 / (w / h);
  const blob = (x, y, r, color, alpha, hard = 0.72) => {
    const rx = r / squeeze;
    for (const dx of [-w, 0, w]) {
      if (x + dx + rx < 0 || x + dx - rx > w) continue;
      ctx.save();
      ctx.translate(x + dx, y);
      ctx.scale(1 / squeeze, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, color);
      g.addColorStop(hard, color);
      g.addColorStop(1, color + '00');
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
  // large soft foliage masses
  for (let i = 0; i < 70; i++) blob(rand() * w, h * (0.25 + rand() * 0.75), 60 + rand() * 220, p.blobs[i % 3], 0.18 + rand() * 0.22);
  // bokeh highlights: brighter discs, more of them in the upper half where light comes through
  for (let i = 0; i < 260; i++) {
    const y = h * Math.pow(rand(), 1.4) * 0.8;
    blob(rand() * w, y, 8 + rand() * 30, rand() < 0.6 ? p.blobs[3] : p.blobs[4], 0.08 + rand() * 0.3, 0.86);
  }
  // light source glow (sun through trees), placed so it sits behind-left of the default view
  const lx = w * 0.62, ly = h * 0.16;
  const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, h * 0.55);
  glow.addColorStop(0, p.light + 'aa');
  glow.addColorStop(0.35, p.light + '33');
  glow.addColorStop(1, p.light + '00');
  ctx.globalAlpha = warm ? 0.9 : 0.5;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
}
