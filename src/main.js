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

  /* ============================================================
     PETAL TEXTURE  (canvas)
     ============================================================ */
  const PTEX_W = 512, PTEX_H = 512;
  const petalCanvas = document.createElement('canvas');
  petalCanvas.width = PTEX_W; petalCanvas.height = PTEX_H;
  const pCtx = petalCanvas.getContext('2d');
  const petalTex = new THREE.CanvasTexture(petalCanvas);
  petalTex.colorSpace = THREE.SRGBColorSpace;

  function paintPetalTex(pal) {
    const w = PTEX_W, h = PTEX_H;
    // Radial gradient: dark center fading to body color
    const g = pCtx.createRadialGradient(w * 0.5, h * 0.85, 0, w * 0.5, h * 0.5, w * 0.7);
    const dark = `rgb(${(pal.dark[0]*255)|0},${(pal.dark[1]*255)|0},${(pal.dark[2]*255)|0})`;
    const base = `rgb(${(pal.base[0]*255)|0},${(pal.base[1]*255)|0},${(pal.base[2]*255)|0})`;
    const lite = `rgb(${(pal.light[0]*255)|0},${(pal.light[1]*255)|0},${(pal.light[2]*255)|0})`;
    g.addColorStop(0, dark);
    g.addColorStop(0.45, base);
    g.addColorStop(1.0, lite);
    pCtx.fillStyle = g; pCtx.fillRect(0, 0, w, h);

    // Fine radial veins
    pCtx.globalAlpha = 0.06;
    pCtx.strokeStyle = '#000';
    pCtx.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const angle = -0.9 + (i / 39) * 1.8;
      pCtx.beginPath();
      pCtx.moveTo(w * 0.5, h);
      pCtx.quadraticCurveTo(
        w * 0.5 + Math.sin(angle) * w * 0.35,
        h * 0.5,
        w * 0.5 + Math.sin(angle) * w * 0.5,
        0
      );
      pCtx.stroke();
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
    petalTex.needsUpdate = true;
  }
  paintPetalTex(activePalette);

  /* ============================================================
     MATERIALS
     ============================================================ */
  const petalMat = new THREE.MeshPhysicalMaterial({
    map: petalTex,
    side: THREE.DoubleSide,
    roughness: 0.65,
    metalness: 0,
    sheen: 1.0,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color(activePalette.sheen),
    emissive: new THREE.Color(activePalette.emissive),
    emissiveIntensity: 0.25,
    clearcoat: 0,
    vertexColors: true,
  });

  const leafMat = new THREE.MeshStandardMaterial({
    color: '#2d5428',
    roughness: 0.55,
    metalness: 0,
    side: THREE.DoubleSide,
    vertexColors: true,
  });

  const stemMat = new THREE.MeshStandardMaterial({
    color: '#3a6e30',
    roughness: 0.6,
    metalness: 0,
    vertexColors: true,
  });

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

  /* ============================================================
     COMPOUND LEAF
     ============================================================ */
  function makeCompoundLeaf(scale, isYoung) {
    const group = new THREE.Group();

    // Rachis (leaf stem)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.15, 0.07, 0),
      new THREE.Vector3(0.35, 0.1, 0),
      new THREE.Vector3(0.55, 0.06, 0),
      new THREE.Vector3(0.7, 0.0, 0),
    ]);
    const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.008, 6, false);
    // Add vertex colors to tube
    const tubePos = tubeGeo.attributes.position;
    const tubeCol = new Float32Array(tubePos.count * 3);
    for (let i = 0; i < tubePos.count; i++) {
      tubeCol[i * 3] = 0.18;
      tubeCol[i * 3 + 1] = 0.36;
      tubeCol[i * 3 + 2] = 0.14;
    }
    tubeGeo.setAttribute('color', new THREE.BufferAttribute(tubeCol, 3));
    const rachisMesh = new THREE.Mesh(tubeGeo, stemMat);
    rachisMesh.castShadow = true;
    group.add(rachisMesh);

    // 5 leaflets in alternating pairs + terminal
    const leafletSpecs = [
      { t: 0.45, side:  1, len: 0.28, wid: 0.12 },
      { t: 0.45, side: -1, len: 0.28, wid: 0.12 },
      { t: 0.7,  side:  1, len: 0.34, wid: 0.14 },
      { t: 0.7,  side: -1, len: 0.34, wid: 0.14 },
      { t: 0.98, side:  0, len: 0.42, wid: 0.17 }, // terminal
    ];

    leafletSpecs.forEach(spec => {
      const geo = createLeafGeometry(spec.len, spec.wid);
      const mesh = new THREE.Mesh(geo, leafMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const pt = curve.getPointAt(spec.t);
      const tan = curve.getTangentAt(spec.t);
      mesh.position.copy(pt);

      const yDir = tan.clone().applyAxisAngle(UP, spec.side * 0.8).normalize();
      const zDir = UP.clone().addScaledVector(yDir, -UP.dot(yDir)).normalize();
      zDir.applyAxisAngle(yDir, -spec.side * 0.1);
      const xDir = new THREE.Vector3().crossVectors(yDir, zDir).normalize();
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xDir, yDir, zDir));

      group.add(mesh);
    });

    group.scale.setScalar(scale);
    return group;
  }

  /* ============================================================
     ROSE BLOOM — arranged in concentric rings matching rose1.jpg
     
     The photo shows ~5 visible rings of petals:
     Ring 0: 3-4 tightly spiraled inner petals (the core spiral)
     Ring 1: 5-6 cupped inner petals (forming the high center cone)
     Ring 2: 7-8 partially open petals (mid-level cup)
     Ring 3: 8-10 reflexed petals (the visible bowl)  
     Ring 4: 10-12 fully reflexed guard petals (outermost ring)
     ============================================================ */
  const allPetalPivots = [];
  const dewMeshes = [];

  function createBloom(bloomStage, bloomScale) {
    const bloomGroup = new THREE.Group();
    const GOLDEN_ANGLE = 137.508 * Math.PI / 180;

    // Ring definitions: [petalCount, length, width, cupping, reflex, ruffle, tiltFromVertical, radiusFromCenter, yOffset]
    const rings = [];
    const totalPetals = bloomStage > 0.8 ? 48 : bloomStage > 0.4 ? 32 : bloomStage > 0.15 ? 18 : 8;

    for (let i = 0; i < totalPetals; i++) {
      const s = i / (totalPetals - 1);          // 0 = innermost, 1 = outermost
      const ring = Math.min(4, Math.floor(s * 5)); // which whorl ring

      // Petal dimensions grow from center outward
      const pLen = lerp(0.18, 0.48, Math.pow(s, 0.7)) * bloomStage;
      const pWid = lerp(0.10, 0.38, Math.pow(s, 0.8)) * bloomStage;

      // Inner petals deeply cupped, outer petals less cupped
      const cupping = lerp(0.12, 0.04, Math.pow(s, 0.5)) * bloomStage;

      // Reflex increases dramatically on outer petals (the backward curl in rose1.jpg)
      const reflex = lerp(0.0, 0.14, Math.pow(s, 1.5)) * bloomStage;

      // Ruffle increases on outer petals
      const ruffle = lerp(0.002, 0.02, s) * bloomStage;

      // Tilt from vertical: inner petals nearly upright, outer petals flare outward
      const tilt = lerp(0.08, 1.25, Math.pow(s, 1.4)) * lerp(0.25, 1.0, bloomStage);

      // Radial distance from center
      const radius = lerp(0.005, 0.14, Math.pow(s, 0.9)) * bloomStage;

      // Y position: inner petals sit higher
      const yOff = lerp(0.02, -0.04, s * s) * bloomStage;

      const angle = i * GOLDEN_ANGLE + rr(-0.04, 0.04);

      rings.push({ s, pLen, pWid, cupping, reflex, ruffle, tilt, radius, yOff, angle });
    }

    rings.forEach(cfg => {
      const geo = createPetalGeometry(cfg.pLen, cfg.pWid, cfg.cupping, cfg.reflex, cfg.ruffle);
      const mesh = new THREE.Mesh(geo, petalMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const pivot = new THREE.Group();

      // Position radially from center
      const rx = Math.cos(cfg.angle) * cfg.radius;
      const rz = Math.sin(cfg.angle) * cfg.radius;
      pivot.position.set(rx, cfg.yOff, rz);

      // Orient: petal grows along +y, we need to tilt it outward
      // First, rotate so the petal faces outward from center
      const outDir = new THREE.Vector3(rx, 0, rz).normalize();
      if (outDir.length() < 0.001) outDir.set(1, 0, 0);

      // yAxis = direction petal grows (tilted outward by cfg.tilt)
      const yAxis = new THREE.Vector3(0, Math.cos(cfg.tilt), 0)
        .addScaledVector(outDir, Math.sin(cfg.tilt));
      yAxis.normalize();

      // zAxis = petal face normal (points toward center for inner, away for outer)
      const zAxis = outDir.clone().multiplyScalar(-Math.cos(cfg.tilt));
      zAxis.y += Math.sin(cfg.tilt);
      zAxis.normalize();

      const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();

      pivot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
      // Small random twist for organic irregularity
      pivot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rr(-0.08, 0.08)));

      pivot.add(mesh);
      bloomGroup.add(pivot);

      pivot.userData = {
        base: pivot.quaternion.clone(),
        phase: cfg.angle * 1.5 + cfg.s * 3,
        amp: 0.003 + 0.012 * cfg.s,
        s: cfg.s,
      };
      allPetalPivots.push(pivot);
    });

    // Dewdrops on outer petals
    if (bloomStage > 0.3) {
      const dropGeo = new THREE.SphereGeometry(1, 12, 8);
      const placed = [];
      for (let d = 0; d < 50; d++) {
        const pivotIdx = Math.floor(rr(totalPetals * 0.4, totalPetals));
        if (pivotIdx >= bloomGroup.children.length) continue;
        const pivot = bloomGroup.children[pivotIdx];
        const mesh = pivot.children[0];
        if (!mesh || !mesh.geometry) continue;

        const posAttr = mesh.geometry.attributes.position;
        const norAttr = mesh.geometry.attributes.normal;
        const vi = Math.floor(rr(posAttr.count * 0.3, posAttr.count * 0.9));
        if (vi >= posAttr.count) continue;

        const p = new THREE.Vector3().fromBufferAttribute(posAttr, vi);
        if (placed.some(q => q.distanceTo(p) < 0.04)) continue;
        placed.push(p.clone());

        const n = new THREE.Vector3().fromBufferAttribute(norAttr, vi);
        const r = rr(0.008, 0.022);
        const drop = new THREE.Mesh(dropGeo, dewMat);
        drop.position.copy(p).addScaledVector(n, r * 0.5);
        drop.scale.set(r * 1.1, r * 0.55, r * 1.1);
        drop.castShadow = true;
        mesh.add(drop);
        dewMeshes.push(drop);
      }
    }

    bloomGroup.scale.setScalar(bloomScale);
    return bloomGroup;
  }

  /* ============================================================
     SEPALS — 5 pointed green blades beneath the bloom
     ============================================================ */
  function createSepals(stage) {
    const group = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const angle = i * TAU / 5 + 0.3;
      const len = lerp(0.3, 0.48, stage);

      const geo = createLeafGeometry(len, 0.08);
      const mesh = new THREE.Mesh(geo, leafMat);
      mesh.castShadow = true;

      // Position at base of bloom
      const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

      // Reflexed downward in full bloom, clasping in bud
      const reflexAngle = lerp(0.3, 2.1, Math.pow(stage, 0.8));
      const yDir = new THREE.Vector3(0, Math.cos(reflexAngle), 0)
        .addScaledVector(dir, Math.sin(reflexAngle)).normalize();
      const zDir = dir.clone().multiplyScalar(-Math.cos(reflexAngle));
      zDir.y += Math.sin(reflexAngle);
      zDir.normalize();
      const xDir = new THREE.Vector3().crossVectors(yDir, zDir).normalize();

      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xDir, yDir, zDir));
      mesh.position.copy(dir).multiplyScalar(0.09);
      mesh.position.y = -0.06;

      group.add(mesh);
    }
    return group;
  }

  /* ============================================================
     RECEPTACLE (HIP) — the rounded base beneath sepals
     ============================================================ */
  function createHip() {
    const profile = [
      [0.025, 0], [0.048, 0.035], [0.085, 0.09],
      [0.13, 0.16], [0.148, 0.23], [0.135, 0.29],
      [0.09, 0.33], [0.04, 0.345], [0.0, 0.35],
    ].map(([x, y]) => new THREE.Vector2(x, y));

    const geo = new THREE.LatheGeometry(profile, 20);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = smoothstep(0.1, 0.34, pos.getY(i));
      colors[i * 3]     = lerp(0.22, 0.35, t);
      colors[i * 3 + 1] = lerp(0.38, 0.25, t * 0.5);
      colors[i * 3 + 2] = lerp(0.18, 0.14, t);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, stemMat);
  }

  /* ============================================================
     STEM — tapered tube following a natural curve
     ============================================================ */
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.04, 0.55, 0.03),
    new THREE.Vector3(0.01, 1.2, -0.02),
    new THREE.Vector3(0.06, 1.9, 0.01),
    new THREE.Vector3(0.11, 2.42, 0.025),
    new THREE.Vector3(0.13, 2.72, 0.0),
  ]);

  function createStem() {
    const geo = new THREE.TubeGeometry(stemCurve, 64, 1, 10, false);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const tmp = new THREE.Vector3();
    const segs = 64, radial = 10;

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const P = stemCurve.getPointAt(t);
      const r = lerp(0.046, 0.022, Math.pow(t, 0.75));
      const rWoody = lerp(0.18, 0.0, t);

      for (let j = 0; j <= radial; j++) {
        const idx = i * (radial + 1) + j;
        // Scale radius
        tmp.fromBufferAttribute(pos, idx).sub(P).multiplyScalar(r).add(P);
        pos.setXYZ(idx, tmp.x, tmp.y, tmp.z);
        // Color: greenish with woody brown at base
        colors[idx * 3]     = lerp(0.18, 0.28, t) + rWoody * 0.12;
        colors[idx * 3 + 1] = lerp(0.30, 0.42, t) - rWoody * 0.08;
        colors[idx * 3 + 2] = lerp(0.12, 0.18, t);
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, stemMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /* ---------- prickles (thorns) ---------- */
  function createPrickle(size) {
    const rows = 8, cols = 4;
    const pos = [], uv = [], col = [], idx = [];
    for (let i = 0; i <= rows; i++) {
      const u = i / rows;
      const w = size * 0.3 * Math.pow(1 - u, 0.85);
      for (let j = 0; j <= cols; j++) {
        const v = (j / cols) * 2 - 1;
        pos.push(v * w, u * size, -size * 0.5 * u * u + 0.12 * w * (1 - v * v) * (1 - u));
        uv.push((v + 1) / 2, u);
        col.push(lerp(0.26, 0.38, u), lerp(0.18, 0.14, u), lerp(0.10, 0.08, u));
      }
    }
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const a = i * (cols + 1) + j, b = a + cols + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, stemMat);
    m.castShadow = true;
    return m;
  }

  /* ============================================================
     ASSEMBLE THE PLANT
     ============================================================ */
  const plant = new THREE.Group();
  scene.add(plant);
  const branchGroup = new THREE.Group();
  plant.add(branchGroup);

  // Main stem
  plant.add(createStem());

  // Thorns
  const thornTs = [0.08, 0.15, 0.22, 0.30, 0.38, 0.46, 0.54, 0.62, 0.70, 0.78];
  thornTs.forEach((t, i) => {
    const P = stemCurve.getPointAt(t);
    const T = stemCurve.getTangentAt(t);
    const az = i * 2.4 + 0.5;
    const radial = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    radial.addScaledVector(T, -radial.dot(T)).normalize();
    const m = createPrickle(lerp(0.12, 0.06, t) * rr(0.85, 1.15));
    const r = lerp(0.046, 0.022, Math.pow(t, 0.75)) * 0.8;
    m.position.copy(P).addScaledVector(radial, r);
    const xA = T.clone();
    const zA = new THREE.Vector3().crossVectors(xA, radial).normalize();
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, radial, zA));
    plant.add(m);
  });

  // Compound leaves along main stem
  const animLeaves = [];
  [
    { t: 0.18, sc: 1.1 }, { t: 0.35, sc: 1.0 },
    { t: 0.52, sc: 0.92 }, { t: 0.68, sc: 0.82 }, { t: 0.82, sc: 0.72 },
  ].forEach((cfg, i) => {
    const P = stemCurve.getPointAt(cfg.t);
    const az = i * 2.513 + 0.4;
    const leaf = makeCompoundLeaf(cfg.sc, i >= 3);
    leaf.position.copy(P).add(new THREE.Vector3(Math.cos(az), 0, Math.sin(az)).multiplyScalar(0.028));
    leaf.rotation.order = 'YZX';
    leaf.rotation.set(0, -az, 0.5 - i * 0.04);
    leaf.userData = { baseRot: leaf.rotation.clone(), phase: i * 1.9, speed: 0.82 + i * 0.05 };
    plant.add(leaf);
    animLeaves.push(leaf);

    // Dewdrops on leaves
    for (let d = 0; d < 4; d++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), dewMat);
      const dr = rr(0.006, 0.014);
      drop.scale.set(dr * 1.2, dr * 0.5, dr * 1.2);
      drop.position.set(rr(0.08, 0.5) * cfg.sc, rr(0.02, 0.06) * cfg.sc, rr(-0.08, 0.08) * cfg.sc);
      leaf.add(drop);
      dewMeshes.push(drop);
    }
  });

  // HERO FLOWER HEAD at apex
  const heroHead = new THREE.Group();
  const heroHip = createHip();
  heroHip.castShadow = true;
  heroHead.add(heroHip);

  const heroSepals = createSepals(1.0);
  heroSepals.position.y = 0.33;
  heroHead.add(heroSepals);

  const heroBloom = createBloom(1.0, 1.0);
  heroBloom.position.y = 0.34;
  heroHead.add(heroBloom);

  heroHead.position.copy(stemCurve.getPointAt(1));
  heroHead.quaternion.setFromUnitVectors(UP, stemCurve.getTangentAt(1));
  heroHead.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, -0.06)));
  plant.add(heroHead);

  // LATERAL BRANCH: Half-bloom (Stage 3)
  const br1Curve = new THREE.CatmullRomCurve3([
    stemCurve.getPointAt(0.62),
    new THREE.Vector3(0.36, 2.05, 0.1),
    new THREE.Vector3(0.7, 2.3, 0.16),
    new THREE.Vector3(0.94, 2.5, 0.12),
  ]);
  const br1Geo = new THREE.TubeGeometry(br1Curve, 24, 0.014, 6, false);
  {
    const c = new Float32Array(br1Geo.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) { c[i] = 0.2; c[i+1] = 0.38; c[i+2] = 0.15; }
    br1Geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const br1Mesh = new THREE.Mesh(br1Geo, stemMat);
  br1Mesh.castShadow = true;
  branchGroup.add(br1Mesh);

  const head3 = new THREE.Group();
  head3.add(createHip());
  const s3 = createSepals(0.6);
  s3.position.y = 0.33;
  head3.add(s3);
  const b3 = createBloom(0.6, 0.8);
  b3.position.y = 0.34;
  head3.add(b3);
  head3.position.copy(br1Curve.getPointAt(1));
  head3.quaternion.setFromUnitVectors(UP, br1Curve.getTangentAt(1));
  head3.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.3, -0.1)));
  head3.scale.setScalar(0.8);
  branchGroup.add(head3);

  const br1Leaf = makeCompoundLeaf(0.75, false);
  br1Leaf.position.copy(br1Curve.getPointAt(0.55));
  br1Leaf.rotation.set(0.3, 0.8, -0.4);
  br1Leaf.userData = { baseRot: br1Leaf.rotation.clone(), phase: 3.2, speed: 0.9 };
  branchGroup.add(br1Leaf);
  animLeaves.push(br1Leaf);

  // LATERAL BRANCH: Opening bud (Stage 2)
  const br2Curve = new THREE.CatmullRomCurve3([
    stemCurve.getPointAt(0.46),
    new THREE.Vector3(-0.3, 1.62, -0.08),
    new THREE.Vector3(-0.62, 1.9, -0.14),
    new THREE.Vector3(-0.82, 2.16, -0.1),
  ]);
  const br2Geo = new THREE.TubeGeometry(br2Curve, 24, 0.012, 6, false);
  {
    const c = new Float32Array(br2Geo.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) { c[i] = 0.2; c[i+1] = 0.38; c[i+2] = 0.15; }
    br2Geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const br2Mesh = new THREE.Mesh(br2Geo, stemMat);
  br2Mesh.castShadow = true;
  branchGroup.add(br2Mesh);

  const head2 = new THREE.Group();
  head2.add(createHip());
  const s2 = createSepals(0.28);
  s2.position.y = 0.33;
  head2.add(s2);
  const b2 = createBloom(0.28, 0.65);
  b2.position.y = 0.34;
  head2.add(b2);
  head2.position.copy(br2Curve.getPointAt(1));
  head2.quaternion.setFromUnitVectors(UP, br2Curve.getTangentAt(1));
  head2.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, -0.4, 0.2)));
  head2.scale.setScalar(0.65);
  branchGroup.add(head2);

  // LATERAL BRANCH: Tight bud (Stage 1)
  const br3Curve = new THREE.CatmullRomCurve3([
    stemCurve.getPointAt(0.78),
    new THREE.Vector3(-0.1, 2.45, 0.2),
    new THREE.Vector3(-0.32, 2.76, 0.26),
    new THREE.Vector3(-0.45, 2.98, 0.22),
  ]);
  const br3Geo = new THREE.TubeGeometry(br3Curve, 20, 0.01, 6, false);
  {
    const c = new Float32Array(br3Geo.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) { c[i] = 0.2; c[i+1] = 0.40; c[i+2] = 0.16; }
    br3Geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  branchGroup.add(new THREE.Mesh(br3Geo, stemMat));

  const head1 = new THREE.Group();
  head1.add(createHip());
  const s1 = createSepals(0.08);
  s1.position.y = 0.33;
  head1.add(s1);
  const b1 = createBloom(0.08, 0.5);
  b1.position.y = 0.34;
  head1.add(b1);
  head1.position.copy(br3Curve.getPointAt(1));
  head1.quaternion.setFromUnitVectors(UP, br3Curve.getTangentAt(1));
  head1.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, -0.2, 0.1)));
  head1.scale.setScalar(0.5);
  branchGroup.add(head1);

  const br3Leaf = makeCompoundLeaf(0.6, true);
  br3Leaf.position.copy(br3Curve.getPointAt(0.55));
  br3Leaf.rotation.set(0.1, -0.5, 0.2);
  br3Leaf.userData = { baseRot: br3Leaf.rotation.clone(), phase: 5.6, speed: 1.05 };
  branchGroup.add(br3Leaf);
  animLeaves.push(br3Leaf);

  /* ============================================================
     POT, SOIL, GROUND, MOTES
     ============================================================ */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: '#0f1c12', roughness: 0.98 })
  );
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
