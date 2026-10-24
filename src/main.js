import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

/*
  Complete rewrite: Photorealistic single rose matching rose1.jpg
  
  Key differences from previous attempts:
  1. Petal geometry modeled as deformed teardrop discs, not "blades growing upward"
  2. Each petal individually shaped with spoon-cupping + edge reflex
  3. Simple, clean materials - no fighting effects
  4. Leaf geometry with proper ovate shape and natural droop
  5. Arrangement matches the photo exactly
*/

const app = document.querySelector('#app');
const errorBox = document.querySelector('#error');
const loading = document.querySelector('.loading');
const toastEl = document.querySelector('#toast');

function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._tid);
  toastEl._tid = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/* ---------- seeded RNG ---------- */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const rr = (lo, hi) => lo + (hi - lo) * rand();
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

/* ============================================================
   COLOR PALETTES
   ============================================================ */
const PALETTES = {
  crimson:   { base: [0.72, 0.04, 0.12], dark: [0.22, 0.01, 0.04], light: [0.88, 0.12, 0.22], sheen: '#e8284a', emissive: '#3a020a', name: 'Velvet Crimson' },
  burgundy:  { base: [0.38, 0.02, 0.08], dark: [0.12, 0.005, 0.02], light: [0.55, 0.06, 0.14], sheen: '#8a1028', emissive: '#1e0106', name: 'Royal Burgundy' },
  pink:      { base: [0.85, 0.38, 0.52], dark: [0.45, 0.12, 0.22], light: [0.98, 0.62, 0.72], sheen: '#ff8ca8', emissive: '#3a0c1a', name: 'Blush Pink' },
  ivory:     { base: [0.92, 0.88, 0.78], dark: [0.48, 0.42, 0.32], light: [0.98, 0.96, 0.92], sheen: '#fffaee', emissive: '#2b2318', name: 'Pure Ivory' },
  peach:     { base: [0.88, 0.42, 0.24], dark: [0.42, 0.12, 0.05], light: [0.96, 0.62, 0.48], sheen: '#ff8a6b', emissive: '#380f05', name: 'Sunset Peach' },
  yellow:    { base: [0.88, 0.68, 0.05], dark: [0.42, 0.28, 0.0], light: [0.96, 0.82, 0.28], sheen: '#ffd447', emissive: '#3b2500', name: 'Golden Sun' },
  lavender:  { base: [0.58, 0.28, 0.72], dark: [0.22, 0.08, 0.32], light: [0.78, 0.52, 0.92], sheen: '#ca80f8', emissive: '#240833', name: 'Royal Lilac' },
  black:     { base: [0.15, 0.09, 0.13], dark: [0.05, 0.02, 0.04], light: [0.28, 0.18, 0.25], sheen: '#734b67', emissive: '#0e070c', name: 'Midnight Velvet' },
};

let activePalette = PALETTES.crimson;

try {
  /* ============================================================
     THREE.JS SETUP
     ============================================================ */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#132118');
  scene.fog = new THREE.FogExp2('#132118', 0.022);

  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 80);
  const VIEWS = {
    hero:    { p: [0.4, 2.75, 5.0],  t: [0.08, 2.42, 0] },
    closeup: { p: [0.25, 2.85, 2.0], t: [0.1, 2.72, 0.04] },
    top:     { p: [0.06, 5.2, 0.7],  t: [0.1, 2.6, 0] },
    full:    { p: [0.6, 2.0, 7.5],   t: [0.08, 1.6, 0] },
  };
  camera.position.set(...VIEWS.hero.p);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  app.prepend(renderer.domElement);

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.06;
  orbit.minDistance = 1;
  orbit.maxDistance = 14;
  orbit.maxPolarAngle = Math.PI * 0.86;
  orbit.target.set(...VIEWS.hero.t);
  orbit.update();

  /* ---------- lighting: soft outdoor / garden ---------- */
  scene.add(new THREE.HemisphereLight('#d8ecfb', '#263d22', 1.0));

  const sun = new THREE.DirectionalLight('#fff3e2', 2.6);
  sun.position.set(-3.5, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 4, bottom: -3, near: 1, far: 22 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun);

  const rim = new THREE.DirectionalLight('#aac8f0', 1.0);
  rim.position.set(4, 5, -4);
  scene.add(rim);

  const fill = new THREE.PointLight('#445e38', 0.8, 8);
  fill.position.set(-0.5, 0.6, 1);
  scene.add(fill);

  // ---------- procedural textures ----------
  function canvasTexture(w, h, draw, srgb = true) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  }

  // Petal: canvas y=0 is the tip (v=1), y=h is the base (v=0); x spans the petal width.
  const petalMap = canvasTexture(512, 1024, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0.0, '#2c0509');
    g.addColorStop(0.1, '#4d0814');
    g.addColorStop(0.35, '#74091f');
    g.addColorStop(0.7, '#920c2a');
    g.addColorStop(1.0, '#a31434');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // lighter, silkier margins
    const eg = ctx.createLinearGradient(0, 0, w, 0);
    eg.addColorStop(0, 'rgba(230,70,100,0.16)');
    eg.addColorStop(0.2, 'rgba(230,70,100,0)');
    eg.addColorStop(0.8, 'rgba(230,70,100,0)');
    eg.addColorStop(1, 'rgba(230,70,100,0.16)');
    ctx.fillStyle = eg; ctx.fillRect(0, 0, w, h);
    // soft mottling, like pigment pooling
    for (let i = 0; i < 1600; i++) {
      const x = rand() * w, y = rand() * h, r = rr(8, 40);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      const dark = rand() < 0.55;
      rg.addColorStop(0, dark ? 'rgba(30,0,8,0.05)' : 'rgba(255,90,120,0.04)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // fan of veins radiating from the claw
    ctx.lineCap = 'round';
    const n = 54;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const x2 = w * (0.03 + 0.94 * t);
      const bend = (t - 0.5) * w * 0.35;
      ctx.beginPath();
      ctx.moveTo(w * (0.5 + (t - 0.5) * 0.14), h);
      ctx.bezierCurveTo(w * 0.5 + bend * 0.2, h * 0.7, w * 0.5 + (x2 - w * 0.5) * 0.7, h * 0.35, x2, h * rr(0.02, 0.1));
      ctx.strokeStyle = `rgba(20,0,6,${rr(0.06, 0.15).toFixed(3)})`;
      ctx.lineWidth = rr(0.8, 2.0);
      ctx.stroke();
    }
    // velvet grain
    for (let i = 0; i < 24000; i++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(255,120,140,0.035)' : 'rgba(20,0,5,0.04)';
      ctx.fillRect(rand() * w, rand() * h, 1.5, 1.5);
    }
  });

  const petalBump = canvasTexture(512, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
    ctx.filter = 'blur(1.6px)';
    ctx.lineCap = 'round';
    const n = 54;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const x2 = w * (0.03 + 0.94 * t);
      ctx.beginPath();
      ctx.moveTo(w * (0.5 + (t - 0.5) * 0.14), h);
      ctx.bezierCurveTo(w * 0.5 + (t - 0.5) * w * 0.07, h * 0.7, w * 0.5 + (x2 - w * 0.5) * 0.7, h * 0.35, x2, h * rr(0.02, 0.1));
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = rr(2, 3.6);
      ctx.stroke();
    }
    ctx.filter = 'none';
    for (let i = 0; i < 30000; i++) {
      const v = 128 + (rand() - 0.5) * 60;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
    ctx.globalAlpha = 1;
  }, false);

  // Leaflet: midrib down the middle, pinnate lateral veins curving toward the tip.
  function drawLeafVeins(ctx, w, h, colour, mid, lat, sub) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = colour; ctx.lineWidth = mid;
    ctx.beginPath(); ctx.moveTo(w / 2, h); ctx.lineTo(w / 2, h * 0.02); ctx.stroke();
    ctx.lineWidth = lat;
    const pairs = 12;
    for (let k = 0; k < pairs; k++) {
      const y = h * (0.94 - (k / pairs) * 0.86);
      for (const side of [-1, 1]) {
        const x = w / 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + side * w * 0.22, y - h * 0.035, x + side * w * 0.46, y - h * 0.13);
        ctx.stroke();
      }
    }
    ctx.lineWidth = sub;
    for (let i = 0; i < 700; i++) {
      const x = rr(0.04, 0.96) * w, y = rr(0.04, 0.96) * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rr(-14, 14), y - rr(6, 18));
      ctx.stroke();
    }
    pCtx.globalAlpha = 1;

    // Soft mottling
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = 4 + Math.random() * 20;
      const rg = pCtx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, Math.random() < 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      pCtx.fillStyle = rg; pCtx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    drawLeafVeins(ctx, w, h, 'rgba(150,185,100,0.5)', 7, 2.6, 0.8);
    for (let i = 0; i < 16; i++) {                                   // tiny brown blemishes
      const x = rr(0.15, 0.85) * w, y = rr(0.1, 0.9) * h, r = rr(3, 9);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(90,60,25,0.38)'); rg.addColorStop(1, 'rgba(90,60,25,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // slightly redder, thinner margin as on young rose foliage
    const eg = ctx.createLinearGradient(0, 0, w, 0);
    eg.addColorStop(0, 'rgba(120,40,30,0.22)'); eg.addColorStop(0.1, 'rgba(120,40,30,0)');
    eg.addColorStop(0.9, 'rgba(120,40,30,0)'); eg.addColorStop(1, 'rgba(120,40,30,0.22)');
    ctx.fillStyle = eg; ctx.fillRect(0, 0, w, h);
  });
  const leafBump = canvasTexture(512, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#909090'; ctx.fillRect(0, 0, w, h);
    ctx.filter = 'blur(1.4px)';
    drawLeafVeins(ctx, w, h, 'rgba(0,0,0,0.65)', 10, 4, 1.4);
    ctx.filter = 'none';
    for (let i = 0; i < 20000; i++) {
      const v = 144 + (rand() - 0.5) * 40;
      ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.globalAlpha = 0.3;
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
    ctx.globalAlpha = 1;
  }, false);

  // ---------- materials ----------
  const petalMat = new THREE.MeshPhysicalMaterial({
    map: petalMap,
    bumpMap: petalBump,
    bumpScale: 1.1,
    vertexColors: true,
  });

  const leafMat = new THREE.MeshStandardMaterial({
    color: '#2d5428',
    roughness: 0.55,
    metalness: 0,
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  petalMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>',
      `#include <color_fragment>
       if (!gl_FrontFacing) { diffuseColor.rgb = diffuseColor.rgb * 1.4 + vec3(0.05, 0.007, 0.018); }`);
  };
  const leafMat = new THREE.MeshPhysicalMaterial({
    map: leafMap,
    bumpMap: leafBump,
    bumpScale: 1.0,
    vertexColors: true,
    roughness: 0.5,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
    sheen: 0.15,
    sheenColor: new THREE.Color('#7fa85a'),
    envMapIntensity: 0.5,
    side: THREE.DoubleSide
  });
  // underside of a leaf: paler, greyer, matte
  leafMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>',
      `#include <color_fragment>
       if (!gl_FrontFacing) { diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.3, 0.14), 0.62); }`);
  };
  const greenPlainMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.62, side: THREE.DoubleSide });
  const stemMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.55 });
  const prickleMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.5, side: THREE.DoubleSide });
  const dewMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.02,
    transmission: 1, ior: 1.33, thickness: 0.05,
    clearcoat: 1, clearcoatRoughness: 0.02,
    envMapIntensity: 1.5,
  });

  function applyPalette(pal) {
    activePalette = pal;
    paintPetalTex(pal);
    petalMat.sheenColor.set(pal.sheen);
    petalMat.emissive.set(pal.emissive);
    petalMat.needsUpdate = true;
  }

  /* ============================================================
     PETAL GEOMETRY — Teardrop disc with spoon-cup + reflexed rim
     
     This is the KEY change: instead of a "blade growing upward",
     each petal is a flat teardrop shape that is then cupped and
     curled in 3D space. This produces the natural overlapping
     spoon-shape seen in real roses.
     ============================================================ */
  function createPetalGeometry(petalLength, petalWidth, cupping, reflexAmount, edgeRuffle) {
    const rows = 32, cols = 20;
    const pos = [], uv = [], col = [], idx = [];

    for (let i = 0; i <= rows; i++) {
      const u = i / rows; // 0 = base (claw), 1 = tip

      // Teardrop outline: narrow at base, widest at ~60%, pointed at tip
      const outline = u < 0.15
        ? smoothstep(0, 0.15, u) * 0.6  // narrow claw
        : u < 0.65
          ? 0.6 + 0.4 * smoothstep(0.15, 0.65, u)  // widening blade
          : Math.pow(1 - smoothstep(0.65, 1.0, u), 0.7);  // rounded tip taper

      const halfW = outline * petalWidth * 0.5;

      for (let j = 0; j <= cols; j++) {
        const v = (j / cols) * 2 - 1; // -1 = left edge, +1 = right edge

        const x = v * halfW;
        let y = u * petalLength;

        // CUPPING: spoon-shaped bowl (deeper at center, zero at edges)
        // This creates the concave inner surface that holds the bloom shape
        const cupDepth = cupping * (1 - v * v) * Math.sin(Math.PI * clamp(u / 0.8, 0, 1));
        let z = -cupDepth;

        // REFLEX: outer petals curl backward at the tip and edges
        // This is the signature backward roll seen in rose1.jpg
        const reflexZone = smoothstep(0.5, 1.0, u);
        const edgeFactor = Math.pow(Math.abs(v), 1.5);
        z += reflexAmount * reflexZone * (0.4 + 0.6 * edgeFactor);

        // EDGE RUFFLE: subtle organic waviness along the margin
        const ruffleFreq = 8 + Math.floor(rr(0, 4));
        z += edgeRuffle * edgeFactor * Math.sin(u * ruffleFreq + v * 2) * smoothstep(0.3, 0.9, u);

        // Slight lengthwise arch at the base (lifts petal off the receptacle)
        y += 0.02 * petalLength * Math.sin(Math.PI * u * 0.3);

        pos.push(x, y, z);
        uv.push((v + 1) / 2, u);

        // Vertex colors: dark at base, lighter at edges/tip (simulates subsurface scattering)
        const baseDarken = 1 - 0.4 * (1 - u) * (1 - Math.abs(v));
        const edgeBrighten = 1 + 0.08 * edgeFactor * smoothstep(0.4, 1, u);
        const brightness = clamp(baseDarken * edgeBrighten, 0.4, 1.15);
        col.push(brightness, brightness, brightness);
      }
    }

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const a = i * (cols + 1) + j;
        const b = a + cols + 1;
        idx.push(a, a + 1, b);
        idx.push(a + 1, b + 1, b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  /* ============================================================
     LEAF GEOMETRY — Ovate with serrations, midrib groove, V-keel
     ============================================================ */
  function createLeafGeometry(length, width) {
    const rows = 32, cols = 16;
    const pos = [], uv = [], col = [], idx = [];

    for (let i = 0; i <= rows; i++) {
      const u = i / rows;

      // Ovate-elliptic outline with acuminate tip
      const outline = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.7);
      // Serrated margin
      const serr = u > 0.08 && u < 0.92 ? (1 - 0.06 + 0.06 * ((u * 14) % 1)) : 1;
      const halfW = outline * serr * width * 0.5;

      for (let j = 0; j <= cols; j++) {
        const v = (j / cols) * 2 - 1;
        const x = v * halfW;

        // V-keel fold along midrib
        const keel = Math.abs(v) * halfW * 0.35;
        // Sunken midrib
        const midrib = -0.004 * Math.exp(-20 * v * v) * smoothstep(0.05, 0.85, u);
        // Natural arch & droop
        const arch = 0.06 * length * Math.sin(u * 2) - 0.15 * length * Math.pow(u, 2);
        const z = keel + midrib + arch;

        pos.push(x, u * length, z);
        uv.push((v + 1) / 2, u);

        // Vertex colors: natural green variation
        const r = lerp(0.14, 0.18, u) * (1 - 0.05 * Math.abs(v));
        const g = lerp(0.30, 0.40, u) * (1 + 0.08 * Math.abs(v));
        const b = lerp(0.12, 0.16, u);
        col.push(r, g, b);
      }
    }

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const a = i * (cols + 1) + j;
        const b = a + cols + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // =========================================================
  //  PLANT
  // =========================================================
  const plant = new THREE.Group();   // sways from the soil line
  scene.add(plant);

  // ----- stem -----
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.05, 0.55, 0.035),
    new THREE.Vector3(0.0, 1.2, -0.025),
    new THREE.Vector3(0.07, 1.9, 0.01),
    new THREE.Vector3(0.12, 2.42, 0.03),
    new THREE.Vector3(0.14, 2.72, 0.0)
  ]);
  const stemBase = hex('#4a4a22'), stemTop = hex('#2f6530'), stemRed = hex('#5a2f22');
  const stemGeo = makeTube(
    stemCurve, 90, 12,
    (t) => lerp(0.052, 0.027, Math.pow(t, 0.8)),
    (t) => {
      const c = mix(stemBase, stemTop, smoothstep(0.0, 0.4, t));
      return mix(c, stemRed, 0.18 * (1 - t)); // woody, reddish-brown toward the base
    }
  );
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.castShadow = true; stem.receiveShadow = true;
  plant.add(stem);

  // ----- prickles: flattened, curved triangles with a broad base -----
  function makePrickle(size) {
    const geo = makeBlade({
      length: size, rows: 10, cols: 4,
      halfWidth: (u) => size * 0.34 * Math.pow(1 - u, 0.9) + 0.002,
      section: (u, v, w) => [v * w, 0.16 * w * (1 - v * v) * (1 - u)],
      shiftX: (u) => -size * 0.55 * u * u,           // hooks downward
      shade: (u) => mix(hex('#3a2418'), hex('#55261c'), u)
    });
    return new THREE.Mesh(geo, prickleMat);
  }
  const prickleTs = [0.07, 0.13, 0.2, 0.27, 0.34, 0.43, 0.5, 0.58, 0.66, 0.75];
  prickleTs.forEach((t, i) => {
    const P = stemCurve.getPointAt(t);
    const T = stemCurve.getTangentAt(t);
    const az = i * 2.4 + 0.5;
    const radial = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    radial.addScaledVector(T, -radial.dot(T)).normalize();
    const mesh = makePrickle(lerp(0.1, 0.055, t) * rr(0.85, 1.15));
    const r = lerp(0.052, 0.027, Math.pow(t, 0.8)) * 0.75;
    mesh.position.copy(P).addScaledVector(radial, r);
    const xAx = T.clone();                       // blade width runs along the stem axis
    const zAx = new THREE.Vector3().crossVectors(xAx, radial).normalize();
    mesh.quaternion.copy(basisQuat(xAx, radial, zAx));
    mesh.castShadow = true;
    plant.add(mesh);
  });

  // ----- compound leaf (petiole + rachis + 5 serrated leaflets + stipules) -----
  const leafAnimated = [];
  function makeLeaflet(len, young) {
    const W = len * rr(0.3, 0.36);
    const tint = young
      ? [rr(1.22, 1.38), rr(0.86, 0.96), rr(0.8, 0.92)]    // bronze-red new growth
      : [rr(0.9, 1.05), rr(0.92, 1.08), rr(0.88, 1.0)];
    const teeth = Math.round(len * 32);                       // serrations per side
    const phase = [rr(0, 1), rr(0, 1)];
    const asym = rr(-0.05, 0.05), twist = rr(-0.18, 0.18), droop = rr(0.35, 0.6), wavePh = rr(0, 6.28);
    const geo = makeBlade({
      length: len, rows: 112, cols: 16,
      halfWidth: (u) => {
        // ovate blade, rounded base, drawn-out (acuminate) tip
        const b = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.7);
        return W * b * (1 - 0.35 * smoothstep(0.78, 1, u));
      },
      bend: (u) => 0.15 * Math.sin(u * 2.4) - droop * Math.pow(u, 1.9),   // arch, then tip droops
      section: (u, v, w0) => {
        const side = v < 0 ? 0 : 1;
        const tt = (u * teeth + phase[side]) % 1;                          // forward-pointing saw teeth
        const mask = smoothstep(0.78, 1, Math.abs(v)) * smoothstep(0.05, 0.15, u) * (1 - smoothstep(0.9, 0.98, u));
        const sc = (1 + asym * (side ? 1 : -1)) * (1 - 0.055 * (1 - tt) * mask);
        const x = v * w0 * sc;
        const fold = Math.abs(x) * 0.26;                                    // V-shaped fold along the midrib
        const pucker = 0.0028 * Math.sin(u * 75 + side * 1.3) * smoothstep(0.1, 0.5, Math.abs(v)) * Math.min(1, w0 * 10);   // blister between lateral veins
        const wave = 0.0032 * Math.sin(u * 17 + wavePh) * smoothstep(0.6, 1, Math.abs(v));                                 // wavy margin
        return [x, fold + pucker + wave + x * twist * u];
      },
      shade: (u, v) => {
        const ao = lerp(0.8, 1, smoothstep(0, 0.35, u)) * (1 - 0.1 * v * v);
        return [ao * tint[0], ao * tint[1], ao * tint[2]];
      }
    });
    const m = new THREE.Mesh(geo, leafMat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  function makeCompoundLeaf(scale, young, sevenLeaflets) {
    const g = new THREE.Group();
    const rachis = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.2, 0.1, 0),
      new THREE.Vector3(0.46, 0.15, 0),
      new THREE.Vector3(0.7, 0.1, 0),
      new THREE.Vector3(0.9, 0.0, 0)
    ]);
    const rachisGeo = makeTube(rachis, 28, 6, (t) => 0.013 * (1 - 0.6 * t), (t) => mix(hex('#376a30'), hex(young ? '#7a3f2c' : '#477a36'), 0.3 + 0.2 * t));
    const rm = new THREE.Mesh(rachisGeo, stemMat);
    rm.castShadow = true;
    g.add(rm);

    const specs = sevenLeaflets ? [        // lower leaves carry 7 leaflets, upper ones 5
      { t: 0.38, side: 1, len: 0.3 }, { t: 0.38, side: -1, len: 0.3 },
      { t: 0.62, side: 1, len: 0.4 }, { t: 0.62, side: -1, len: 0.4 },
      { t: 0.82, side: 1, len: 0.44 }, { t: 0.82, side: -1, len: 0.44 },
      { t: 1.0, side: 0, len: 0.56 }
    ] : [
      { t: 0.52, side: 1, len: 0.38 }, { t: 0.52, side: -1, len: 0.38 },
      { t: 0.77, side: 1, len: 0.44 }, { t: 0.77, side: -1, len: 0.44 },
      { t: 1.0, side: 0, len: 0.56 }
    ];
    specs.forEach((sp) => {
      const P = rachis.getPointAt(sp.t);
      const T = rachis.getTangentAt(sp.t);
      const yAx = T.clone().applyAxisAngle(UP, sp.side * rr(0.75, 1.05)).normalize();
      // short petiolule between rachis and blade
      const base = P.clone().addScaledVector(yAx, 0.015).add(new THREE.Vector3(0, 0.005, 0));
      const zHint = UP.clone().addScaledVector(yAx, -UP.dot(yAx));
      zHint.applyAxisAngle(yAx, -sp.side * 0.12).normalize();
      const xAx = new THREE.Vector3().crossVectors(yAx, zHint).normalize();
      const leaflet = makeLeaflet(sp.len, young);
      leaflet.position.copy(base);
      leaflet.quaternion.copy(basisQuat(xAx, yAx, zHint));
      g.add(leaflet);
    });

    // stipules: two slender wings where the petiole joins the stem
    for (const side of [-1, 1]) {
      const geo = makeBlade({
        length: 0.15, rows: 10, cols: 4,
        halfWidth: (u) => 0.028 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.6)), 0.8) + 0.0006,
        bend: (u) => -0.5 * u * u,
        section: (u, v, w) => [v * w, Math.abs(v * w) * 0.5],
        shade: () => hex('#33602d')
      });
      const m = new THREE.Mesh(geo, greenPlainMat);
      m.position.set(0.02, 0.0, side * 0.012);
      const yAx = new THREE.Vector3(0.7, 0.35, side * 0.55).normalize();
      const zHint = UP.clone().addScaledVector(yAx, -UP.dot(yAx)).normalize();
      m.quaternion.copy(basisQuat(new THREE.Vector3().crossVectors(yAx, zHint).normalize(), yAx, zHint));
      g.add(m);
    }
    g.scale.setScalar(scale);
    return g;
  }

  const leafNodes = [
    { t: 0.13, scale: 1.2 }, { t: 0.27, scale: 1.14 }, { t: 0.41, scale: 1.06 },
    { t: 0.55, scale: 0.96 }, { t: 0.68, scale: 0.86 }, { t: 0.8, scale: 0.74 }
  ];
  leafNodes.forEach((n, i) => {
    const P = stemCurve.getPointAt(n.t);
    const az = i * 2.513 + 0.4;       // 144 deg: 2/5 phyllotaxis, as on real rose stems
    const leaf = makeCompoundLeaf(n.scale, i >= 4, i < 3);
    leaf.position.copy(P).add(new THREE.Vector3(Math.cos(az), 0, Math.sin(az)).multiplyScalar(0.03));
    leaf.rotation.order = 'YZX';
    leaf.rotation.set(0, -az, 0.52 - i * 0.04);
    leaf.userData.base = leaf.rotation.clone();
    leaf.userData.phase = i * 1.9;
    plant.add(leaf);
    leafAnimated.push(leaf);
  });

  // =========================================================
  //  FLOWER HEAD
  // =========================================================
  const head = new THREE.Group();
  head.position.copy(stemCurve.getPointAt(1));
  head.quaternion.setFromUnitVectors(UP, stemCurve.getTangentAt(1));
  head.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.14, 0, -0.07)));  // flower nods slightly
  plant.add(head);

  // receptacle / hip
  const hipProfile = [
    [0.028, 0], [0.05, 0.035], [0.09, 0.09], [0.135, 0.165], [0.155, 0.235],
    [0.14, 0.295], [0.1, 0.33], [0.05, 0.345], [0.0, 0.35]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const hipGeo = new THREE.LatheGeometry(hipProfile, 28);
  {
    const p = hipGeo.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const c = mix(hex('#3a6a2d'), hex('#6a3022'), smoothstep(0.1, 0.34, p.getY(i)) * 0.5);
      col.set(c, i * 3);
    }
    hipGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const hip = new THREE.Mesh(hipGeo, stemMat);
  hip.castShadow = true; hip.receiveShadow = true;
  head.add(hip);

  const bloom = new THREE.Group();
  bloom.position.y = 0.335;
  head.add(bloom);

  // ----- sepals: five, tapering, reflexed under the open flower, two with fringed edges -----
  for (let i = 0; i < 5; i++) {
    const az = i * ((Math.PI * 2) / 5) + 0.3;
    const len = rr(0.4, 0.5);
    const fringed = i < 2;
    const geo = makeBlade({
      length: len, rows: 30, cols: 6,
      halfWidth: (u) => {
        let w = 0.062 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.5)), 0.75) * (1 - 0.35 * u);
        if (fringed && u > 0.12 && u < 0.8) w *= 1 + 0.55 * Math.max(0, Math.sin(u * 52));
        return w;
      },
      bend: (u) => -0.15 * u + 0.75 * u * u,
      section: (u, v, w) => [v * w, Math.abs(v * w) * 1.1],
      shade: (u) => mix(hex('#294f26'), hex('#4d7a36'), u)
    });
    const m = new THREE.Mesh(geo, greenPlainMat);
    const phi = rr(1.85, 2.3);
    const r = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const yw = new THREE.Vector3(0, Math.cos(phi), 0).addScaledVector(r, Math.sin(phi));
    const zw = r.clone().multiplyScalar(-Math.cos(phi)); zw.y += Math.sin(phi);
    const xw = new THREE.Vector3().crossVectors(yw, zw);
    m.quaternion.copy(basisQuat(xw, yw, zw));
    m.position.copy(r).multiplyScalar(0.115); m.position.y = -0.075;
    m.castShadow = true; m.receiveShadow = true;
    bloom.add(m);
  }

  // ----- petals on a golden-angle spiral -----
  const GOLDEN = (137.508 * Math.PI) / 180;
  const PETALS = 44;
  const petalNodes = [];      // { pivot, mesh, s }
  const petalOutline = (u) => {
    const u0 = 0.6;
    if (u < u0) { const t = u / u0; return 0.13 + 0.87 * (1 - Math.pow(1 - t, 2.3)); }   // narrow claw widening into the blade
    const t = (u - u0) / (1 - u0);
    return Math.pow(Math.max(0, 1 - Math.pow(t, 2.5)), 1 / 2.5);                          // broad, rounded tip (super-ellipse)
  };

  function createPetal(s) {
    const L = 0.38 + 0.44 * Math.pow(s, 0.78) * rr(0.96, 1.05);
    const W = 0.15 + 0.27 * Math.pow(s, 0.85) * rr(0.94, 1.06);          // half-width
    const wrap = 3.5 - 2.55 * Math.pow(s, 0.62);                       // total cross-section wrap angle
    const bendTotal = lerp(0.7, -0.38, Math.pow(s, 0.8)) + rr(-0.06, 0.06);
    const roll = lerp(0.0, 0.14, smoothstep(0.3, 1, s));                 // rim rolled back (outer petals)
    const ripple = lerp(0.005, 0.026, s);
    const rf = rr(8, 13), ph = rr(0, 6.28);
    const asym = rr(-0.09, 0.09);                                        // left/right petal never identical
    const edgeAmp = lerp(0.025, 0.075, s);
    const edgePh = [rr(0, 6.28), rr(0, 6.28), rr(0, 6.28), rr(0, 6.28)];
    const tipSkew = rr(-0.035, 0.035);
    const inner = 1 - s;
    const tint = [rr(0.92, 1.08), rr(0.86, 1.12), rr(0.86, 1.12)];
    const geo = makeBlade({
      length: L, rows: 64, cols: 38,
      halfWidth: (u) => petalOutline(u) * W,
      bend: (u) => bendTotal * Math.pow(u, 1.45),
      section: (u, v, w0) => {
        const side = v < 0 ? 0 : 1;
        // irregular, hand-made outline: two slow undulations per side + asymmetry
        const body = smoothstep(0.12, 0.5, u) * (1 - smoothstep(0.92, 1, u));
        const noise = 1 + edgeAmp * body * (Math.sin(u * 5.3 + edgePh[side * 2]) + 0.55 * Math.sin(u * 12.7 + edgePh[side * 2 + 1]));
        const w = w0 * noise * (1 + asym * (side ? 1 : -1));
        const wr = wrap * (0.82 + 0.18 * smoothstep(0, 0.45, u));
        const a = (v * wr) / 2;
        const x = (w * Math.sin(a)) / (wr / 2);
        let zc = (w / (wr / 2)) * (1 - Math.cos(a));
        const edge = Math.pow(Math.abs(v), 2.4);
        zc += ripple * edge * smoothstep(0.25, 1, u) * (Math.sin(u * rf + ph + v * 1.8) + 0.6 * Math.sin(u * rf * 2.3 + ph * 1.7 - v * 2.6));
        zc -= roll * Math.pow(smoothstep(0.55, 1.0, u), 1.6) * (0.3 + 0.7 * Math.pow(Math.abs(v), 1.4));
        // faint longitudinal flutes, as real petals have
        zc += 0.004 * Math.sin(v * 17 + ph) * smoothstep(0.2, 0.8, u);
        return [x, zc];
      },
      yMod: (u, v) => -L * 0.06 * Math.pow(u, 9) * Math.exp(-v * v * 5) + L * tipSkew * Math.pow(u, 6) * v,   // heart-shaped notch, slightly lopsided
      shade: (u, v) => {
        // baked ambient occlusion: deep inside the bloom and near the claw it is darker
        const depth = lerp(0.3, 0.9, 1 - inner * 0.9);
        const ao = lerp(depth * 0.55, 1, smoothstep(0.0, 0.85, u));
        const edgeLift = 1 + 0.12 * Math.pow(Math.abs(v), 3) * smoothstep(0.4, 1, u);
        const c = ao * edgeLift;
        return [c * tint[0], c * tint[1], c * tint[2]];
      }
    });
    const mesh = new THREE.Mesh(geo, petalMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  for (let i = 0; i < PETALS; i++) {
    const s = i / (PETALS - 1);                     // 0 = innermost, 1 = outermost
    const ang = i * GOLDEN + rr(-0.04, 0.04);
    const r0 = 0.012 + 0.1 * Math.pow(s, 0.95);
    const y0 = 0.02 * (1 - s) - 0.065 * s * s;
    const phi = Math.max(0.02, 0.03 + 1.02 * Math.pow(s, 1.75) + rr(-0.04, 0.04) * (0.4 + s));

    const rhat = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const yw = new THREE.Vector3(0, Math.cos(phi), 0).addScaledVector(rhat, Math.sin(phi));
    const zw = rhat.clone().multiplyScalar(-Math.cos(phi)); zw.y += Math.sin(phi);     // faces the flower axis
    const xw = new THREE.Vector3().crossVectors(yw, zw);

    const pivot = new THREE.Group();
    pivot.position.set(rhat.x * r0, y0, rhat.z * r0);
    pivot.quaternion.copy(basisQuat(xw, yw, zw));
    pivot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rr(-0.07, 0.07)));  // small twist
    const mesh = createPetal(s);
    pivot.add(mesh);
    pivot.userData = { base: pivot.quaternion.clone(), phase: ang * 1.7 + i, amp: 0.006 + 0.02 * s };
    bloom.add(pivot);
    petalNodes.push({ pivot, mesh, s });
  }

  // =========================================================
  //  DEW DROPLETS
  // =========================================================
  plant.updateMatrixWorld(true);
  {
    const dropGeo = new THREE.SphereGeometry(1, 24, 16);
    const placed = [];
    const wq = new THREE.Quaternion(), n = new THREE.Vector3(), p = new THREE.Vector3(), wp = new THREE.Vector3();
    let attempts = 0;
    while (placed.length < 15 && attempts++ < 900) {
      const node = petalNodes[Math.floor(rr(petalNodes.length * 0.55, petalNodes.length))];
      const pos = node.mesh.geometry.attributes.position, nor = node.mesh.geometry.attributes.normal;
      const row = Math.floor(rr(20, 52)), col = Math.floor(rr(10, 28));
      const idx = row * 39 + col;
      n.fromBufferAttribute(nor, idx);
      p.fromBufferAttribute(pos, idx);
      node.mesh.getWorldQuaternion(wq);
      const wn = n.clone().applyQuaternion(wq);
      if (Math.abs(wn.y) < 0.55) continue;
      const side = Math.sign(wn.y);
      wp.copy(p); node.mesh.localToWorld(wp);
      if (placed.some((q) => q.distanceTo(wp) < 0.12)) continue;
      placed.push(wp.clone());
      const radius = rr(0.012, 0.03);
      const drop = new THREE.Mesh(dropGeo, dewMat);
      const nl = n.clone().multiplyScalar(side);
      drop.position.copy(p).addScaledVector(nl, radius * 0.5);
      drop.quaternion.setFromUnitVectors(UP, nl);
      drop.scale.set(radius * 1.15, radius * 0.62, radius * 1.15);
      node.mesh.add(drop);
    }
  }

  // =========================================================
  //  POT, GROUND, MOTES
  // =========================================================
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#1b281a', roughness: 0.96 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  scene.add(ground);

  const potMat = new THREE.MeshStandardMaterial({ color: '#3a2e24', roughness: 0.78, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.65, 48, 1, true), potMat).translateY(-0.37));
  scene.add(new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.04, 10, 48), new THREE.MeshStandardMaterial({ color: '#544438', roughness: 0.68 })).rotateX(Math.PI / 2).translateZ(0.05));
  scene.add(new THREE.Mesh(new THREE.CircleGeometry(0.38, 48), new THREE.MeshStandardMaterial({ color: '#1a1510', roughness: 1 })).rotateX(-Math.PI / 2).translateY(-0.045));

  // Floating motes
  const moteCount = 80;
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 6;
    motePos[i * 3 + 1] = Math.random() * 5;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * 3;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    color: '#f0deb0', size: 0.016, transparent: true, opacity: 0.35, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  scene.add(motes);

  // Sparkle particles
  const sparkCount = 80;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkVel = Array.from({ length: sparkCount }, () => new THREE.Vector3());
  const sparkLife = new Float32Array(sparkCount);
  for (let i = 0; i < sparkCount; i++) { sparkPos[i * 3 + 1] = -20; sparkLife[i] = 0; }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  scene.add(new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: '#e8f4ff', size: 0.032, transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.AdditiveBlending,
  })));

  function sparkBurst(origin, count = 20, speed = 1.5) {
    let n = 0;
    for (let i = 0; i < sparkCount && n < count; i++) {
      if (sparkLife[i] <= 0) {
        sparkPos[i*3] = origin.x; sparkPos[i*3+1] = origin.y; sparkPos[i*3+2] = origin.z;
        sparkVel[i].set((Math.random()-.5)*2, Math.random()*1.5+0.3, (Math.random()-.5)*2)
          .normalize().multiplyScalar(speed * (0.5 + Math.random()));
        sparkLife[i] = 1;
        n++;
      }
    }
    sparkGeo.attributes.position.needsUpdate = true;
  }

  /* ============================================================
     PHYSICS STATE
     ============================================================ */
  const phys = {
    windSpeed: 1.0, gravity: 1.0, dewOn: true, mode: 'multi',
    tiltX: 0, tiltZ: 0, velX: 0, velZ: 0,
    spring: 36, damp: 4.0,
    shakeE: 0, shakeF: 22,
    dragging: false,
  };

  /* ---------- interaction ---------- */
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let pDown = new THREE.Vector2(), isDown = false, downT = 0, drag = 0;

  function onPD(e) {
    if (e.target !== renderer.domElement) return;
    isDown = true; downT = performance.now(); pDown.set(e.clientX, e.clientY); drag = 0;
    mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    if (ray.intersectObjects([plant], true).length) {
      phys.dragging = true; orbit.enabled = false;
      renderer.domElement.classList.add('grabbing');
    }
  }
  function onPM(e) {
    if (!isDown) return;
    drag = Math.hypot(e.clientX - pDown.x, e.clientY - pDown.y);
    if (phys.dragging) {
      const dx = e.clientX - pDown.x, dy = e.clientY - pDown.y;
      phys.velX += dy * 0.003; phys.velZ += dx * 0.003;
      pDown.set(e.clientX, e.clientY);
    }
  }
  function onPU(e) {
    isDown = false; renderer.domElement.classList.remove('grabbing');
    if (phys.dragging) { phys.dragging = false; orbit.enabled = true; phys.velX *= 1.6; phys.velZ *= 1.6; }
    if (drag < 6 && performance.now() - downT < 350) {
      mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects([plant], true);
      if (hits.length) {
        phys.velX += (Math.random() - 0.5) * 1.5; phys.velZ += (Math.random() - 0.5) * 1.5;
        sparkBurst(hits[0].point, 20, 1.2);
        showToast('✨ Click effect: spring impulse + dew scatter');
      }
    }
  }
  window.addEventListener('pointerdown', onPD);
  window.addEventListener('pointermove', onPM);
  window.addEventListener('pointerup', onPU);

  function doShake(intensity = 1) {
    phys.shakeE = Math.min(2.5, phys.shakeE + 1.2 * intensity);
    phys.velX += (Math.random() - 0.5) * 2.5 * intensity;
    phys.velZ += (Math.random() - 0.5) * 2.5 * intensity;
    const wp = new THREE.Vector3(); heroHead.getWorldPosition(wp);
    sparkBurst(wp, 35, 2);
    showToast('🌪️ Shaken! Elastic flutter');
  }

  /* ============================================================
     UI BINDINGS
     ============================================================ */
  const titleEl = document.querySelector('#title-text');

  // Mode switch
  document.querySelector('#mode-multi')?.addEventListener('click', () => {
    phys.mode = 'multi'; branchGroup.visible = true;
    document.querySelector('#mode-multi')?.classList.add('active');
    document.querySelector('#mode-single')?.classList.remove('active');
    titleEl && (titleEl.textContent = 'A Living Rose Bush');
    showToast('All flowering stages visible');
  });
  document.querySelector('#mode-single')?.addEventListener('click', () => {
    phys.mode = 'single'; branchGroup.visible = false;
    document.querySelector('#mode-single')?.classList.add('active');
    document.querySelector('#mode-multi')?.classList.remove('active');
    titleEl && (titleEl.textContent = 'A Single Living Rose');
    showToast('Single hero bloom');
  });

  // Color
  document.querySelectorAll('.color-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const p = PALETTES[chip.dataset.color];
      if (p) { applyPalette(p); showToast(`Color: ${p.name}`); }
    });
  });
  document.querySelector('#custom-color-input')?.addEventListener('input', e => {
    document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
    const col = new THREE.Color(e.target.value);
    const hsl = {}; col.getHSL(hsl);
    const pal = {
      base: [col.r, col.g, col.b],
      dark: [col.r * 0.3, col.g * 0.3, col.b * 0.3],
      light: [Math.min(1, col.r * 1.4), Math.min(1, col.g * 1.4), Math.min(1, col.b * 1.4)],
      sheen: e.target.value,
      emissive: new THREE.Color().setHSL(hsl.h, hsl.s * 0.8, hsl.l * 0.15).getHexString(),
      name: 'Custom',
    };
    pal.emissive = '#' + pal.emissive;
    applyPalette(pal);
  });

  // Wind
  const windSlider = document.querySelector('#wind-slider');
  const windBadge = document.querySelector('#wind-val');
  windSlider?.addEventListener('input', e => {
    phys.windSpeed = parseFloat(e.target.value);
    const v = phys.windSpeed;
    const label = v === 0 ? 'Still air' : v < 0.6 ? 'Whisper' : v < 1.6 ? 'Gentle breeze' : v < 2.8 ? 'Brisk gust' : 'Gale';
    windBadge && (windBadge.textContent = `${v.toFixed(1)} · ${label}`);
  });

  // Gravity
  const gravSlider = document.querySelector('#gravity-slider');
  const gravBadge = document.querySelector('#gravity-val');
  gravSlider?.addEventListener('input', e => {
    phys.gravity = parseFloat(e.target.value);
    const v = phys.gravity;
    const label = v === 0 ? 'Zero-G' : v < 0.5 ? 'Moon' : v <= 1.2 ? 'Earth' : 'Heavy';
    gravBadge && (gravBadge.textContent = `${v.toFixed(1)}g · ${label}`);
  });
  document.querySelectorAll('.slider-ticks span').forEach(t =>
    t.addEventListener('click', () => { gravSlider.value = t.dataset.val; gravSlider.dispatchEvent(new Event('input')); })
  );

  // Bloom slider
  const bloomSlider = document.querySelector('#bloom-slider');
  const bloomBadge = document.querySelector('#bloom-val');
  bloomSlider?.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    bloomBadge && (bloomBadge.textContent = `${Math.round(v*100)}% · ${v > 0.85 ? 'Full Bloom' : v > 0.5 ? 'Half-Open' : 'Tight Bud'}`);
  });

  // Shake
  document.querySelector('#btn-shake')?.addEventListener('click', () => doShake(1.2));

  // Dew toggle
  const dewBtn = document.querySelector('#btn-dew');
  dewBtn?.addEventListener('click', () => {
    phys.dewOn = !phys.dewOn;
    dewMeshes.forEach(m => m.visible = phys.dewOn);
    dewBtn.textContent = phys.dewOn ? '💧 Dewdrops: On' : '💧 Dewdrops: Off';
    dewBtn.classList.toggle('active', phys.dewOn);
  });

  // Panel toggle
  const panel = document.querySelector('#control-panel');
  const panelBtn = document.querySelector('#panel-toggle');
  panelBtn?.addEventListener('click', () => {
    const c = panel.classList.toggle('collapsed');
    panelBtn.textContent = c ? '+' : '—';
  });

  // Camera views
  let camTarget = new THREE.Vector3(...VIEWS.hero.t);
  let camPos = new THREE.Vector3(...VIEWS.hero.p);
  document.querySelectorAll('.cam-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const v = VIEWS[btn.dataset.view];
      if (v) { camPos.set(...v.p); camTarget.set(...v.t); }
    });
  });

  /* ============================================================
     ANIMATION LOOP
     ============================================================ */
  const clock = new THREE.Clock();
  const tmpE = new THREE.Euler(), tmpQ = new THREE.Quaternion();

  (function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsedTime();
    const w = phys.windSpeed;

    // Camera smoothing
    camera.position.lerp(camPos, 0.06);
    orbit.target.lerp(camTarget, 0.06);

    // Spring physics
    phys.velX += (-phys.spring * phys.tiltX - phys.damp * phys.velX) * dt;
    phys.velZ += (-phys.spring * phys.tiltZ - phys.damp * phys.velZ) * dt;
    phys.tiltX += phys.velX * dt;
    phys.tiltZ += phys.velZ * dt;
    if (phys.shakeE > 0.001) phys.shakeE = Math.max(0, phys.shakeE - dt * 1.8);
    const shake = Math.sin(t * phys.shakeF) * phys.shakeE * 0.07;

    const gSag = (phys.gravity - 1) * 0.05;
    const gDroop = (phys.gravity - 1) * 0.035;

    // Main plant sway
    plant.rotation.z = phys.tiltZ + w * (Math.sin(t * 0.62) * 0.014 + Math.sin(t * 1.2 + 1) * 0.006) + shake;
    plant.rotation.x = phys.tiltX + w * (Math.sin(t * 0.5) * 0.01) + gSag;

    // Bloom nod
    heroBloom.rotation.z = w * Math.sin(t * 0.8 + 0.5) * 0.01 + shake * 1.1;
    heroBloom.rotation.x = w * Math.sin(t * 0.6) * 0.008 + gDroop;

    // Petal flutter
    for (const pv of allPetalPivots) {
      const d = pv.userData;
      const amp = d.amp * (1 + w * 0.6 + phys.shakeE * 2);
      tmpE.set(Math.sin(t * 1.0 + d.phase) * amp, 0, Math.sin(t * 1.3 + d.phase) * amp * 0.7);
      pv.quaternion.copy(d.base).multiply(tmpQ.setFromEuler(tmpE));
    }

    // Leaf sway
    for (const leaf of animLeaves) {
      const b = leaf.userData.baseRot, ph = leaf.userData.phase, sp = leaf.userData.speed;
      leaf.rotation.set(
        b.x + w * Math.sin(t * 0.78 * sp + ph) * 0.018 + gDroop * 0.4,
        b.y + w * Math.sin(t * 0.65 * sp + ph) * 0.024,
        b.z + w * Math.sin(t * 0.92 * sp + ph) * 0.032 + shake * 1.2,
      );
    }

    // Motes
    const mp = motes.geometry.attributes.position;
    for (let i = 0; i < moteCount; i++) {
      let mx = mp.getX(i) + w * 0.002; if (mx > 3) mx = -3;
      let my = mp.getY(i) + 0.001 * Math.sin(t * 0.6 + i); if (my > 5) my = 0;
      mp.setXYZ(i, mx, my, mp.getZ(i));
    }
    mp.needsUpdate = true;

    // Sparks
    for (let i = 0; i < sparkCount; i++) {
      if (sparkLife[i] > 0) {
        sparkLife[i] -= dt * 1.2;
        sparkVel[i].y -= 3.5 * phys.gravity * dt;
        sparkPos[i*3] += sparkVel[i].x * dt;
        sparkPos[i*3+1] += sparkVel[i].y * dt;
        sparkPos[i*3+2] += sparkVel[i].z * dt;
        if (sparkPos[i*3+1] < -0.05) { sparkVel[i].y *= -0.3; sparkPos[i*3+1] = -0.05; }
      } else { sparkPos[i*3+1] = -20; }
    }
    sparkGeo.attributes.position.needsUpdate = true;

    orbit.update();
    renderer.render(scene, camera);
  })();

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  });

  setTimeout(() => loading?.classList.add('done'), 400);
  setTimeout(() => loading?.remove(), 1200);

} catch (err) {
  console.error(err);
  if (errorBox) { errorBox.style.display = 'block'; errorBox.textContent = `Error: ${err.message}`; }
  loading?.classList.add('done');
}
