import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './style.css';

/*
  Senior Botanical 3D Artist & Three.js Implementation:
  Photorealistic Living Rose (Hybrid Tea Rose - Rosa x hybrida)

  1. Naturally curved, double-cupped petals with reflexed margins and apical beaks.
  2. Botanical Fibonacci phyllotaxis across 5 concentric morphological whorls.
  3. Soft velvety papillae shading: restrained specularity, zero plastic shine, physical velvet sheen.
  4. True 3D quilted, serrated compound leaves: sunken midrib, raised interveinal cushions, zero chrome/metallic sheen.
  5. Tapered organic stems, hooked prickles, swollen receptacles (hips), and pinnatifid green sepals.
  6. Closed and opening rosebuds with tightly wrapped spiral cones.
  7. Outdoor botanical sunlight & soft hemisphere illumination (no dark void).
  8. Natural compound breeze animation with hierarchical stiffness and phase offsets.
*/

const app = document.querySelector('#app');
const errorBox = document.querySelector('#error');
const loading = document.querySelector('.loading');
const toastEl = document.querySelector('#toast');

function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// -------------------------------------------------------------
//  Math & Botanical Utilities
// -------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261024);
const rr = (a, b) => a + (b - a) * rand();
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const UP = new THREE.Vector3(0, 1, 0);

function hex(h) {
  const c = new THREE.Color(h);
  return [c.r, c.g, c.b];
}
function mix(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function basisQuat(x, y, z) {
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// -------------------------------------------------------------
//  Botanical Color Palettes (Soft Natural Rose Pigments)
// -------------------------------------------------------------
const PALETTES = {
  crimson: {
    name: 'Classic Velvet Crimson',
    claw: '#2a0308',
    shadow: '#5e0716',
    mid: '#8f0a24',
    body: '#b50d2e',
    rim: '#d1153a',
    highlight: '#e32448',
    sheen: '#ff2d55',
    emissive: '#38020a',
    roughness: 0.68
  },
  burgundy: {
    name: 'Royal Black Baccara',
    claw: '#140004',
    shadow: '#30010a',
    mid: '#4e0312',
    body: '#690518',
    rim: '#840820',
    highlight: '#a8102b',
    sheen: '#b81232',
    emissive: '#1e0106',
    roughness: 0.70
  },
  pink: {
    name: 'Blush Heritage Pink',
    claw: '#3a121e',
    shadow: '#78263e',
    mid: '#b03d5c',
    body: '#d85e7e',
    rim: '#ee839f',
    highlight: '#ffb5c7',
    sheen: '#ff8ca8',
    emissive: '#380c18',
    roughness: 0.65
  },
  ivory: {
    name: 'Cream Garden Ivory',
    claw: '#362f22',
    shadow: '#6b5e48',
    mid: '#a39376',
    body: '#cfc3ab',
    rim: '#ede4d5',
    highlight: '#fdfaf2',
    sheen: '#fffcf5',
    emissive: '#2b2318',
    roughness: 0.68
  },
  peach: {
    name: 'Sunset Coral Peach',
    claw: '#380e04',
    shadow: '#782210',
    mid: '#b84222',
    body: '#e0653d',
    rim: '#f58b68',
    highlight: '#ffb699',
    sheen: '#ff8a6b',
    emissive: '#380f05',
    roughness: 0.66
  },
  yellow: {
    name: 'Golden Sun Amber',
    claw: '#362000',
    shadow: '#6e4400',
    mid: '#a87000',
    body: '#d69400',
    rim: '#f2b516',
    highlight: '#ffdf66',
    sheen: '#ffd447',
    emissive: '#3b2500',
    roughness: 0.67
  },
  lavender: {
    name: 'Royal Lilac Rose',
    claw: '#220a2e',
    shadow: '#44195c',
    mid: '#6f328f',
    body: '#9b4fc4',
    rim: '#bd72ea',
    highlight: '#e2aaff',
    sheen: '#ca80f8',
    emissive: '#240833',
    roughness: 0.65
  },
  black: {
    name: 'Midnight Velvet',
    claw: '#0c070b',
    shadow: '#180e16',
    mid: '#271723',
    body: '#362231',
    rim: '#4a3244',
    highlight: '#6b4e64',
    sheen: '#734b67',
    emissive: '#0e070c',
    roughness: 0.72
  }
};

let currentPalette = PALETTES.crimson;

try {
  // -----------------------------------------------------------
  //  Three.js Setup: Outdoor Botanical Scene & Composition
  // -----------------------------------------------------------
  const scene = new THREE.Scene();
  // Natural garden environment background: soft out-of-focus garden foliage (no dark void!)
  scene.background = new THREE.Color('#142417');
  scene.fog = new THREE.FogExp2('#142417', 0.024);

  const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.2, 100);
  const CAM_PRESETS = {
    hero: { pos: new THREE.Vector3(0.55, 2.7, 4.6), target: new THREE.Vector3(0.08, 2.38, 0.0) },
    closeup: { pos: new THREE.Vector3(0.26, 2.78, 1.95), target: new THREE.Vector3(0.1, 2.68, 0.04) },
    top: { pos: new THREE.Vector3(0.06, 5.0, 0.8), target: new THREE.Vector3(0.1, 2.55, 0.0) },
    full: { pos: new THREE.Vector3(0.7, 2.1, 7.6), target: new THREE.Vector3(0.08, 1.6, 0.0) }
  };
  camera.position.copy(CAM_PRESETS.hero.pos);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  app.prepend(renderer.domElement);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 1.1;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI * 0.84;
  controls.target.copy(CAM_PRESETS.hero.target);
  controls.update();

  // -----------------------------------------------------------
  //  Outdoor Botanical Lighting Setup
  //  Soft natural sunlight, sky hemisphere, leafy ground bounce (zero harsh chrome/plastic reflections)
  // -----------------------------------------------------------
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35; // subtle natural ambient reflections only

  // Natural Sky & Earth Hemisphere Light
  const hemiLight = new THREE.HemisphereLight('#dbeefc', '#2c3a23', 0.85);
  scene.add(hemiLight);

  // Soft Warm Natural Sunlight (Directional Light with soft PCF penumbra)
  const sunLight = new THREE.DirectionalLight('#fff5e3', 2.8);
  sunLight.position.set(-3.6, 7.8, 4.4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunLight.shadow.camera, { left: -3.2, right: 3.2, top: 4.4, bottom: -3.2, near: 1, far: 24 });
  sunLight.shadow.bias = -0.0003;
  sunLight.shadow.normalBias = 0.015;
  sunLight.shadow.radius = 2.8;
  scene.add(sunLight);

  // Soft Sky Backlight (Subtle rim light picking up translucent petal margins)
  const skyRimLight = new THREE.DirectionalLight('#b8d6f8', 1.2);
  skyRimLight.position.set(4.2, 4.6, -4.2);
  scene.add(skyRimLight);

  // Warm leafy under-canopy bounce
  const leafBounce = new THREE.PointLight('#426b34', 0.9, 8);
  leafBounce.position.set(-0.4, 0.6, 0.8);
  scene.add(leafBounce);

  // Warm floral self-fill light (illuminates inner petal hollows softly)
  const petalFill = new THREE.PointLight('#ff705a', 0.8, 7);
  petalFill.position.set(0.9, 3.2, 2.2);
  scene.add(petalFill);

  // -----------------------------------------------------------
  //  Procedural Textures: Velvet Petal & Botanical Leaf
  // -----------------------------------------------------------

  // 1. Petal Diffuse Map (Organic Velvet Gradient & Fine Micro-Veins)
  const petalCanvas = document.createElement('canvas');
  petalCanvas.width = 1024;
  petalCanvas.height = 2048;
  const petalCtx = petalCanvas.getContext('2d');
  const petalMap = new THREE.CanvasTexture(petalCanvas);
  petalMap.colorSpace = THREE.SRGBColorSpace;
  petalMap.anisotropy = maxAniso;

  function renderPetalCanvas(pal) {
    const w = 1024, h = 2048;
    // Deep botanical crimson gradient
    const g = petalCtx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0.0, pal.claw);
    g.addColorStop(0.09, pal.shadow);
    g.addColorStop(0.28, pal.mid);
    g.addColorStop(0.62, pal.body);
    g.addColorStop(0.88, pal.rim);
    g.addColorStop(1.0, pal.highlight);
    petalCtx.fillStyle = g;
    petalCtx.fillRect(0, 0, w, h);

    // Soft velvety edge translucency (slightly lighter pinkish-crimson margin)
    const eg = petalCtx.createLinearGradient(0, 0, w, 0);
    eg.addColorStop(0.0, 'rgba(255, 140, 160, 0.16)');
    eg.addColorStop(0.12, 'rgba(255, 140, 160, 0)');
    eg.addColorStop(0.88, 'rgba(255, 140, 160, 0)');
    eg.addColorStop(1.0, 'rgba(255, 140, 160, 0.16)');
    petalCtx.fillStyle = eg;
    petalCtx.fillRect(0, 0, w, h);

    // Micro-pigment papillae (breaks specular shine and gives true organic depth)
    for (let i = 0; i < 2800; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 8 + Math.random() * 38;
      const rg = petalCtx.createRadialGradient(x, y, 0, x, y, r);
      const isDark = Math.random() < 0.52;
      rg.addColorStop(0, isDark ? 'rgba(20, 0, 8, 0.04)' : 'rgba(255, 180, 190, 0.035)');
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      petalCtx.fillStyle = rg;
      petalCtx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Radiating organic petal veins
    petalCtx.lineCap = 'round';
    const veinCount = 68;
    for (let k = 0; k < veinCount; k++) {
      const t = k / (veinCount - 1);
      const x2 = w * (0.04 + 0.92 * t);
      const bend = (t - 0.5) * w * 0.32;
      petalCtx.beginPath();
      petalCtx.moveTo(w * (0.5 + (t - 0.5) * 0.14), h);
      petalCtx.bezierCurveTo(
        w * 0.5 + bend * 0.2,
        h * 0.72,
        w * 0.5 + (x2 - w * 0.5) * 0.7,
        h * 0.36,
        x2,
        h * (0.02 + Math.random() * 0.08)
      );
      petalCtx.strokeStyle = 'rgba(20, 0, 8, 0.065)';
      petalCtx.lineWidth = 1.0 + Math.random() * 1.8;
      petalCtx.stroke();
    }

    // Velvet micro-fuzz stippling
    for (let i = 0; i < 40000; i++) {
      petalCtx.fillStyle = Math.random() < 0.5 ? 'rgba(255, 200, 210, 0.028)' : 'rgba(10, 0, 5, 0.03)';
      petalCtx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }

    petalMap.needsUpdate = true;
  }

  // 2. Petal Bump Map (fine radial velvety furrows)
  const petalBumpCanvas = document.createElement('canvas');
  petalBumpCanvas.width = 1024;
  petalBumpCanvas.height = 2048;
  const pbCtx = petalBumpCanvas.getContext('2d');
  pbCtx.fillStyle = '#808080';
  pbCtx.fillRect(0, 0, 1024, 2048);
  pbCtx.lineCap = 'round';
  for (let k = 0; k < 68; k++) {
    const t = k / 67;
    const x2 = 1024 * (0.04 + 0.92 * t);
    pbCtx.beginPath();
    pbCtx.moveTo(1024 * (0.5 + (t - 0.5) * 0.14), 2048);
    pbCtx.bezierCurveTo(512 + (t - 0.5) * 50, 1450, 512 + (x2 - 512) * 0.7, 720, x2, 80 + Math.random() * 100);
    pbCtx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    pbCtx.lineWidth = 2.2 + Math.random() * 2.5;
    pbCtx.stroke();
  }
  for (let i = 0; i < 35000; i++) {
    const v = 128 + (Math.random() - 0.5) * 45;
    pbCtx.fillStyle = `rgb(${v},${v},${v})`;
    pbCtx.globalAlpha = 0.3;
    pbCtx.fillRect(Math.random() * 1024, Math.random() * 2048, 2, 2);
  }
  pbCtx.globalAlpha = 1.0;
  const petalBumpMap = new THREE.CanvasTexture(petalBumpCanvas);
  petalBumpMap.anisotropy = maxAniso;

  // 3. Botanical Leaf Diffuse Map (NO white veins, NO chrome reflections!)
  const leafCanvas = document.createElement('canvas');
  leafCanvas.width = 1024;
  leafCanvas.height = 2048;
  const lfCtx = leafCanvas.getContext('2d');
  // Rich chlorophyll botanical green gradient
  const lg = lfCtx.createLinearGradient(0, 2048, 0, 0);
  lg.addColorStop(0.0, '#1c3e1e');
  lg.addColorStop(0.5, '#224a25');
  lg.addColorStop(1.0, '#2b572e');
  lfCtx.fillStyle = lg;
  lfCtx.fillRect(0, 0, 1024, 2048);

  // Soft interveinal cushions (subtle natural variation in chlorophyll density)
  const veinPairs = 12;
  for (let k = 0; k < veinPairs; k++) {
    const y = 2048 * (0.94 - (k / veinPairs) * 0.86);
    for (const side of [-1, 1]) {
      const cx = 512 + side * 170;
      const cy = y - 55;
      const crg = lfCtx.createRadialGradient(cx, cy, 0, cx, cy, 140);
      crg.addColorStop(0, 'rgba(48, 102, 45, 0.22)');
      crg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lfCtx.fillStyle = crg;
      lfCtx.fillRect(cx - 150, cy - 150, 300, 300);
    }
  }

  // Midrib vein: delicate sap-green (NOT bright white!)
  lfCtx.lineCap = 'round';
  lfCtx.strokeStyle = 'rgba(75, 125, 60, 0.45)';
  lfCtx.lineWidth = 8;
  lfCtx.beginPath();
  lfCtx.moveTo(512, 2048);
  lfCtx.lineTo(512, 40);
  lfCtx.stroke();

  // Secondary lateral pinnate veins: subtle translucent olive green
  lfCtx.strokeStyle = 'rgba(65, 110, 52, 0.32)';
  lfCtx.lineWidth = 2.8;
  for (let k = 0; k < veinPairs; k++) {
    const y = 2048 * (0.94 - (k / veinPairs) * 0.86);
    for (const side of [-1, 1]) {
      lfCtx.beginPath();
      lfCtx.moveTo(512, y);
      lfCtx.quadraticCurveTo(512 + side * 200, y - 60, 512 + side * 460, y - 240);
      lfCtx.stroke();
    }
  }
  // Delicate reddish-bronze perimeter margin on young growth
  const leg = lfCtx.createLinearGradient(0, 0, 1024, 0);
  leg.addColorStop(0, 'rgba(130, 42, 28, 0.22)');
  leg.addColorStop(0.06, 'rgba(130, 42, 28, 0)');
  leg.addColorStop(0.94, 'rgba(130, 42, 28, 0)');
  leg.addColorStop(1.0, 'rgba(130, 42, 28, 0.22)');
  lfCtx.fillStyle = leg;
  lfCtx.fillRect(0, 0, 1024, 2048);

  const leafMap = new THREE.CanvasTexture(leafCanvas);
  leafMap.colorSpace = THREE.SRGBColorSpace;
  leafMap.anisotropy = maxAniso;

  // 4. Leaf Bump Map (Gentle organic porosity and soft vein grooves)
  const leafBumpCanvas = document.createElement('canvas');
  leafBumpCanvas.width = 1024;
  leafBumpCanvas.height = 2048;
  const lfbCtx = leafBumpCanvas.getContext('2d');
  lfbCtx.fillStyle = '#808080';
  lfbCtx.fillRect(0, 0, 1024, 2048);

  // Soft sunken midrib
  lfbCtx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  lfbCtx.lineWidth = 10;
  lfbCtx.beginPath();
  lfbCtx.moveTo(512, 2048);
  lfbCtx.lineTo(512, 40);
  lfbCtx.stroke();

  // Soft secondary vein troughs
  lfbCtx.lineWidth = 4;
  for (let k = 0; k < veinPairs; k++) {
    const y = 2048 * (0.94 - (k / veinPairs) * 0.86);
    for (const side of [-1, 1]) {
      lfbCtx.beginPath();
      lfbCtx.moveTo(512, y);
      lfbCtx.quadraticCurveTo(512 + side * 200, y - 60, 512 + side * 460, y - 240);
      lfbCtx.stroke();
    }
  }
  const leafBumpMap = new THREE.CanvasTexture(leafBumpCanvas);
  leafBumpMap.anisotropy = maxAniso;

  // Render initial default Velvet Crimson
  renderPetalCanvas(currentPalette);

  // -----------------------------------------------------------
  //  Botanical Materials (Physically Based, Natural Satin Sheen)
  // -----------------------------------------------------------
  const petalMat = new THREE.MeshPhysicalMaterial({
    map: petalMap,
    bumpMap: petalBumpMap,
    bumpScale: 0.35,
    vertexColors: true,
    roughness: currentPalette.roughness, // 0.68: soft velvety matte, zero plastic shine!
    sheen: 0.95,
    sheenRoughness: 0.42,
    sheenColor: new THREE.Color(currentPalette.sheen),
    clearcoat: 0.0,                      // NO shiny car-paint clearcoat on petals!
    metalness: 0.0,
    emissive: new THREE.Color(currentPalette.emissive),
    emissiveIntensity: 0.28,             // Simulates subsurface scattering through thin petals
    side: THREE.DoubleSide
  });

  // Natural Botanical Leaf Material (Soft Satin Green, ZERO Chrome/Metallic Sheen!)
  const leafMat = new THREE.MeshStandardMaterial({
    map: leafMap,
    bumpMap: leafBumpMap,
    bumpScale: 0.28,                     // restrained natural relief, no jagged silver reflections
    vertexColors: true,
    roughness: 0.62,                     // soft botanical satin sheen (not a plastic mirror)
    metalness: 0.0,                      // strictly zero metalness
    side: THREE.DoubleSide
  });

  const stemMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.58,
    metalness: 0.0
  });

  const prickleMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.52,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  const sepalMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.64,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  // Glistening Morning Dewdrops
  const dewMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.02,
    metalness: 0.0,
    transmission: 1.0,
    ior: 1.333,
    thickness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.8,
    specularIntensity: 1.0
  });

  function updateRoseColor(pal) {
    currentPalette = pal;
    renderPetalCanvas(pal);
    petalMat.sheenColor.set(pal.sheen);
    petalMat.emissive.set(pal.emissive);
    petalMat.roughness = pal.roughness;
    petalMat.needsUpdate = true;
  }

  // -----------------------------------------------------------
  //  Tapered Organic Stem & Prickle (Thorn) Builders
  // -----------------------------------------------------------
  function makeTube(curve, segs, radial, radiusFn, colorFn) {
    const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const P = curve.getPointAt(t);
      const r = radiusFn(t);
      const col = colorFn(t);
      for (let j = 0; j <= radial; j++) {
        const idx = i * (radial + 1) + j;
        c.fromBufferAttribute(pos, idx).sub(P).multiplyScalar(r).add(P);
        pos.setXYZ(idx, c.x, c.y, c.z);
        colors[idx * 3] = col[0];
        colors[idx * 3 + 1] = col[1];
        colors[idx * 3 + 2] = col[2];
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }

  function makePrickle(size) {
    const positions = [], uvs = [], colors = [], indices = [];
    const rows = 12, cols = 6;
    for (let i = 0; i <= rows; i++) {
      const u = i / rows;
      const w = size * 0.36 * Math.pow(1 - u, 0.9) + 0.002;
      const cy = u * size;
      const hookShift = -size * 0.58 * u * u;
      for (let j = 0; j <= cols; j++) {
        const v = (j / cols) * 2 - 1;
        const x = v * w;
        const zc = 0.18 * w * (1 - v * v) * (1 - u);
        positions.push(x, cy, zc + hookShift);
        uvs.push((v + 1) / 2, u);
        const c = mix(hex('#462618'), hex('#6a271e'), u);
        colors.push(c[0], c[1], c[2]);
      }
    }
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const a = i * (cols + 1) + j, b = a + cols + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, prickleMat);
  }

  // -----------------------------------------------------------
  //  Botanical Compound Leaf Builder (Serrated, Quilted, Natural Foliage)
  // -----------------------------------------------------------
  function makeRealisticLeaflet(len, young) {
    const rows = 48, cols = 24;
    const positions = [], uvs = [], colors = [], indices = [];
    const W = len * 0.34;
    const tint = young
      ? [rr(1.15, 1.28), rr(0.9, 0.98), rr(0.85, 0.94)]
      : [rr(0.94, 1.04), rr(0.95, 1.05), rr(0.92, 1.0)];

    for (let i = 0; i <= rows; i++) {
      const u = i / rows;
      // Elliptical-ovate leaflet outline
      const baseCurve = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.75);
      const saw = 1.0 - 0.065 + 0.065 * ((u * 16) % 1); // fine serrations
      const curW = W * baseCurve * (u > 0.07 && u < 0.93 ? saw : 1.0);

      // Midrib arch: rises slightly then curves gracefully down
      const cy = len * u;
      const midArch = 0.12 * Math.sin(u * 2.2) - 0.46 * Math.pow(u, 1.85);

      for (let j = 0; j <= cols; j++) {
        const v = (j / cols) * 2 - 1;
        const x = v * curW;

        // V-shaped dihedral keel along midrib
        const keel = Math.abs(x) * 0.34;

        // Sunken central midrib channel
        const midribGroove = -0.0055 * Math.exp(-28 * v * v) * smoothstep(0.05, 0.9, u);

        // Raised quilted interveinal cushions (true 3D surface relief!)
        const veinWave = Math.sin(u * 24 * Math.PI - Math.abs(v) * 3.6);
        const cushion = 0.0045 * Math.max(0, veinWave) * (1 - v * v) * Math.sin(Math.PI * u);

        const z = midArch + keel + midribGroove + cushion;
        positions.push(x, cy, z);
        uvs.push((v + 1) / 2, u);

        // Baked ambient occlusion (soft shadowing in keel & base)
        const ao = lerp(0.84, 1.0, smoothstep(0, 0.35, u)) * (1.0 - 0.06 * v * v);
        colors.push(ao * tint[0], ao * tint[1], ao * tint[2]);
      }
    }

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const a = i * (cols + 1) + j, b = a + cols + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const m = new THREE.Mesh(geo, leafMat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function makeCompoundLeaf(scale, young) {
    const g = new THREE.Group();
    const rachis = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.18, 0.08, 0),
      new THREE.Vector3(0.44, 0.12, 0),
      new THREE.Vector3(0.68, 0.08, 0),
      new THREE.Vector3(0.88, 0.0, 0)
    ]);
    const rachisGeo = makeTube(
      rachis, 22, 6,
      (t) => 0.011 * (1 - 0.58 * t),
      (t) => mix(hex('#32632b'), hex(young ? '#743726' : '#3f7032'), 0.3 + 0.2 * t)
    );
    const rm = new THREE.Mesh(rachisGeo, stemMat);
    rm.castShadow = true;
    g.add(rm);

    const specs = [
      { t: 0.52, side: 1, len: 0.35 },
      { t: 0.52, side: -1, len: 0.35 },
      { t: 0.77, side: 1, len: 0.42 },
      { t: 0.77, side: -1, len: 0.42 },
      { t: 1.0, side: 0, len: 0.54 }
    ];
    specs.forEach((sp) => {
      const P = rachis.getPointAt(sp.t);
      const T = rachis.getTangentAt(sp.t);
      const yAx = T.clone().applyAxisAngle(UP, sp.side * 0.9).normalize();
      const base = P.clone().addScaledVector(yAx, 0.015).add(new THREE.Vector3(0, 0.005, 0));
      const zHint = UP.clone().addScaledVector(yAx, -UP.dot(yAx));
      zHint.applyAxisAngle(yAx, -sp.side * 0.12).normalize();
      const xAx = new THREE.Vector3().crossVectors(yAx, zHint).normalize();

      const leaflet = makeRealisticLeaflet(sp.len, young);
      leaflet.position.copy(base);
      leaflet.quaternion.copy(basisQuat(xAx, yAx, zHint));
      g.add(leaflet);
    });

    g.scale.setScalar(scale);
    return g;
  }

  // -----------------------------------------------------------
  //  Botanical Petal Geometry Builder
  //  Double-curved bowl, reflexed margin lip, pointed apical beak, central notch
  // -----------------------------------------------------------
  function buildAuthenticPetalMesh({ s, whorlIndex, bloomStage }) {
    const rows = 40, cols = 24;
    const positions = [], uvs = [], colors = [], indices = [];

    const isCore = whorlIndex === 0;
    const isInner = whorlIndex === 1;
    const isMid = whorlIndex === 2;

    // Proportional dimensions across whorls
    const L = lerp(0.32, 0.78, Math.pow(s, 0.75)) * lerp(0.55, 1.0, bloomStage);
    const W = lerp(0.12, 0.44, Math.pow(s, 0.85)) * lerp(0.5, 1.0, bloomStage);

    // Cross-section wrap (tight spiral core vs open outer petals)
    const wrap = lerp(3.6, 1.15, Math.pow(s, 0.65));

    // Lengthwise inward vs outward bending
    const bendTotal = lerp(0.82, -0.44, Math.pow(s, 0.8) * bloomStage);

    // Reflex roll (backward curl along upper margin)
    const roll = isCore ? 0.0 : isInner ? 0.035 : isMid ? 0.11 : 0.15;

    // Pointed apical beak (classic high-tea rose reflex point)
    const pointReflex = isCore ? 0.0 : isInner ? 0.025 : 0.065;

    // Organic wavy ripple along margin
    const ripple = lerp(0.002, 0.022, s * bloomStage);
    const rf = rr(10, 14), ph = rr(0, 6.28);
    const inner = 1.0 - s;
    const tint = [rr(0.96, 1.04), rr(0.92, 1.08), rr(0.92, 1.08)];

    // Heart-shaped broad petal outline
    const petalOutline = (u) => {
      const u0 = 0.55;
      if (u < u0) {
        const t = u / u0;
        return 0.14 + 0.86 * (1.0 - Math.pow(1.0 - t, 2.2));
      }
      const t = (u - u0) / (1.0 - u0);
      return Math.pow(Math.max(0, 1.0 - Math.pow(t, 2.5)), 1.0 / 2.5);
    };

    const ds = L / rows;
    let cy = 0, cz = 0;

    for (let i = 0; i <= rows; i++) {
      const u = i / rows;
      if (i > 0) {
        const bm = bendTotal * Math.pow((i - 0.5) / rows, 1.45);
        cy += Math.cos(bm) * ds;
        cz += Math.sin(bm) * ds;
      }
      const b = bendTotal * Math.pow(u, 1.45);
      const sb = Math.sin(b), cb = Math.cos(b);
      const curW = Math.max(petalOutline(u) * W, 0.001);

      for (let j = 0; j <= cols; j++) {
        const v = (j / cols) * 2 - 1;

        // Double-curved bowl wrap
        const wr = wrap * (0.85 + 0.15 * smoothstep(0, 0.45, u));
        const a = (v * wr) / 2;
        const x = (curW * Math.sin(a)) / (wr / 2);
        let zc = (curW / (wr / 2)) * (1.0 - Math.cos(a));

        // Margin ripple
        const edge = Math.pow(Math.abs(v), 2.4);
        zc += ripple * edge * smoothstep(0.3, 1.0, u) * Math.sin(u * rf + ph + v * 1.8);

        // Soft reflexed upper rim
        zc -= roll * Math.pow(smoothstep(0.55, 1.0, u), 1.6) * (0.35 + 0.65 * Math.pow(Math.abs(v), 1.3));

        // Pointed apical beak
        zc -= pointReflex * Math.pow(u, 4) * Math.exp(-v * v * 7.0);

        // Subtle notch at apex
        const notch = -L * 0.042 * Math.pow(u, 8) * Math.exp(-v * v * 5.5);

        positions.push(x, cy + notch - sb * zc, cz + cb * zc);
        uvs.push((v + 1) / 2, u);

        // Baked ambient occlusion in folds
        const depth = lerp(0.3, 0.95, 1.0 - inner * 0.9);
        const ao = lerp(depth * 0.52, 1.0, smoothstep(0.0, 0.85, u));
        const edgeLift = 1.0 + 0.1 * Math.pow(Math.abs(v), 3) * smoothstep(0.4, 1.0, u);
        const c = ao * edgeLift;
        colors.push(c * tint[0], c * tint[1], c * tint[2]);
      }
    }

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const a = i * (cols + 1) + j, b = a + cols + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, petalMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // -----------------------------------------------------------
  //  Flower Head Generator (All Flowering Stages)
  //  5 Whorls of petals arranged on Fibonacci phyllotaxis
  // -----------------------------------------------------------
  const GOLDEN = (137.508 * Math.PI) / 180;
  const dewDropGeo = new THREE.SphereGeometry(1, 16, 12);
  const allPetalNodes = [];
  const dewDropMeshes = [];

  function createFlowerHead({ stage = 1.0, scale = 1.0, isHero = false }) {
    const headGroup = new THREE.Group();
    headGroup.userData = { stage, baseScale: scale, isHero };

    // 1. Swollen Rose Hip / Receptacle
    const hipRadiusScale = lerp(0.65, 1.0, stage);
    const hipProfile = [
      [0.026 * hipRadiusScale, 0],
      [0.048 * hipRadiusScale, 0.035],
      [0.088 * hipRadiusScale, 0.09],
      [0.13 * hipRadiusScale, 0.16],
      [0.15 * hipRadiusScale, 0.23],
      [0.136 * hipRadiusScale, 0.29],
      [0.095 * hipRadiusScale, 0.33],
      [0.045 * hipRadiusScale, 0.345],
      [0.0, 0.35]
    ].map(([x, y]) => new THREE.Vector2(x, y));

    const hipGeo = new THREE.LatheGeometry(hipProfile, 24);
    const hp = hipGeo.attributes.position, hcol = new Float32Array(hp.count * 3);
    for (let i = 0; i < hp.count; i++) {
      const c = mix(hex('#366329'), hex('#642d20'), smoothstep(0.1, 0.34, hp.getY(i)) * 0.5);
      hcol.set(c, i * 3);
    }
    hipGeo.setAttribute('color', new THREE.BufferAttribute(hcol, 3));
    hipGeo.computeVertexNormals();

    const hip = new THREE.Mesh(hipGeo, stemMat);
    hip.castShadow = true;
    hip.receiveShadow = true;
    headGroup.add(hip);

    const bloom = new THREE.Group();
    bloom.position.y = 0.335;
    headGroup.add(bloom);

    // 2. Pointed Green Sepals (2 with pinnatifid lateral appendages, as in real roses)
    const sepalCount = 5;
    for (let i = 0; i < sepalCount; i++) {
      const az = i * ((Math.PI * 2) / sepalCount) + 0.32;
      const len = lerp(0.34, 0.5, Math.min(1, stage * 1.2));
      const isPinnatifid = i < 2; // 2 of 5 sepals have lateral appendages
      const reflexAmount = lerp(-0.35, 0.85, Math.pow(stage, 0.75));

      const positions = [], uvs = [], colors = [], indices = [];
      const rows = 28, cols = 6;
      for (let ri = 0; ri <= rows; ri++) {
        const u = ri / rows;
        let w = 0.058 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.5)), 0.75) * (1 - 0.32 * u);
        if (isPinnatifid && u > 0.18 && u < 0.75) w *= 1 + 0.48 * Math.max(0, Math.sin(u * 45));
        const cy = len * u;
        const cz = -0.15 * u + reflexAmount * u * u;
        for (let cj = 0; cj <= cols; cj++) {
          const v = (cj / cols) * 2 - 1;
          const x = v * w;
          const zc = Math.abs(x) * 1.05;
          positions.push(x, cy, cz + zc);
          uvs.push((v + 1) / 2, u);
          const c = mix(hex('#254d22'), hex('#477432'), u);
          colors.push(c[0], c[1], c[2]);
        }
      }
      for (let ri = 0; ri < rows; ri++) {
        for (let cj = 0; cj < cols; cj++) {
          const a = ri * (cols + 1) + cj, b = a + cols + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
      const sgeo = new THREE.BufferGeometry();
      sgeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      sgeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      sgeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      sgeo.setIndex(indices);
      sgeo.computeVertexNormals();

      const sm = new THREE.Mesh(sgeo, sepalMat);
      const phi = lerp(0.35, 2.15, Math.pow(stage, 0.85));
      const r = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
      const yw = new THREE.Vector3(0, Math.cos(phi), 0).addScaledVector(r, Math.sin(phi));
      const zw = r.clone().multiplyScalar(-Math.cos(phi));
      zw.y += Math.sin(phi);
      const xw = new THREE.Vector3().crossVectors(yw, zw);

      sm.quaternion.copy(basisQuat(xw, yw, zw));
      sm.position.copy(r).multiplyScalar(0.11 * hipRadiusScale);
      sm.position.y = -0.065;
      sm.castShadow = true;
      sm.receiveShadow = true;
      bloom.add(sm);
    }

    // 3. Petals Across 5 Whorls (Golden Angle Phyllotaxis)
    const maxPetals = stage > 0.8 ? 50 : stage > 0.4 ? 36 : stage > 0.18 ? 22 : 12;
    const myPetalNodes = [];

    for (let i = 0; i < maxPetals; i++) {
      const s = i / (maxPetals - 1 || 1);
      const whorlIndex = Math.min(4, Math.floor(s * 5));
      const ang = i * GOLDEN + rr(-0.03, 0.03);

      const r0 = (0.009 + 0.108 * Math.pow(s, 0.95)) * lerp(0.32, 1.0, stage);
      const y0 = (0.02 * (1.0 - s) - 0.066 * s * s) * stage;

      const phi = Math.max(
        0.02,
        (0.04 + 1.06 * Math.pow(s, 1.7)) * lerp(0.2, 1.05, Math.pow(stage, 0.75)) + rr(-0.03, 0.03) * s
      );

      const rhat = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
      const yw = new THREE.Vector3(0, Math.cos(phi), 0).addScaledVector(rhat, Math.sin(phi));
      const zw = rhat.clone().multiplyScalar(-Math.cos(phi));
      zw.y += Math.sin(phi);
      const xw = new THREE.Vector3().crossVectors(yw, zw);

      const pivot = new THREE.Group();
      pivot.position.set(rhat.x * r0, y0, rhat.z * r0);
      pivot.quaternion.copy(basisQuat(xw, yw, zw));
      pivot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rr(-0.05, 0.05)));

      const mesh = buildAuthenticPetalMesh({ s, whorlIndex, bloomStage: stage });
      pivot.add(mesh);

      pivot.userData = {
        base: pivot.quaternion.clone(),
        basePos: pivot.position.clone(),
        phase: ang * 1.8 + i,
        amp: 0.004 + 0.015 * s,
        s,
        stage
      };

      bloom.add(pivot);
      myPetalNodes.push({ pivot, mesh, s, stage });
      allPetalNodes.push({ pivot, mesh, s, headGroup });
    }

    // 4. Subtle Sparkling Morning Dewdrops
    if (stage > 0.3) {
      const dropCount = Math.floor(lerp(6, isHero ? 75 : 24, Math.pow(stage, 0.8)));
      const placed = [];
      let attempts = 0;
      while (placed.length < dropCount && attempts++ < 700) {
        const node = myPetalNodes[Math.floor(rr(myPetalNodes.length * 0.4, myPetalNodes.length))];
        if (!node) continue;
        const posAttr = node.mesh.geometry.attributes.position;
        const norAttr = node.mesh.geometry.attributes.normal;
        const row = Math.floor(rr(14, 38)), col = Math.floor(rr(6, 20));
        const idx = row * 25 + col;
        if (idx >= posAttr.count) continue;

        const p = new THREE.Vector3().fromBufferAttribute(posAttr, idx);
        const n = new THREE.Vector3().fromBufferAttribute(norAttr, idx);

        if (placed.some((q) => q.distanceTo(p) < 0.045)) continue;
        placed.push(p.clone());

        const radius = rr(0.009, isHero ? 0.026 : 0.016);
        const drop = new THREE.Mesh(dewDropGeo, dewMat);
        drop.position.copy(p).addScaledVector(n, radius * 0.55);
        drop.quaternion.setFromUnitVectors(UP, n);
        drop.scale.set(radius * 1.15, radius * 0.58, radius * 1.15);
        drop.castShadow = true;
        node.mesh.add(drop);
        dewDropMeshes.push(drop);
      }
    }

    headGroup.scale.setScalar(scale);
    return { headGroup, bloom, myPetalNodes };
  }

  // -----------------------------------------------------------
  //  Multi-Stage Branching Plant Construction
  // -----------------------------------------------------------
  const plantMasterGroup = new THREE.Group();
  scene.add(plantMasterGroup);

  const mainStemGroup = new THREE.Group();
  plantMasterGroup.add(mainStemGroup);

  const lateralBranchesGroup = new THREE.Group();
  plantMasterGroup.add(lateralBranchesGroup);

  // Main Central Cane
  const mainStemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.04, 0.55, 0.03),
    new THREE.Vector3(0.01, 1.25, -0.02),
    new THREE.Vector3(0.08, 1.95, 0.015),
    new THREE.Vector3(0.12, 2.45, 0.03),
    new THREE.Vector3(0.14, 2.75, 0.0)
  ]);
  const stemBase = hex('#3d3c1c'), stemTop = hex('#2b582b'), stemRed = hex('#52271b');

  const mainStemGeo = makeTube(
    mainStemCurve, 90, 12,
    (t) => lerp(0.052, 0.026, Math.pow(t, 0.8)),
    (t) => {
      const c = mix(stemBase, stemTop, smoothstep(0.0, 0.42, t));
      return mix(c, stemRed, 0.18 * (1 - t));
    }
  );
  const mainStemMesh = new THREE.Mesh(mainStemGeo, stemMat);
  mainStemMesh.castShadow = true;
  mainStemMesh.receiveShadow = true;
  mainStemGroup.add(mainStemMesh);

  // Thorns along main stem
  const prickleTs = [0.08, 0.14, 0.21, 0.28, 0.36, 0.44, 0.52, 0.6, 0.69, 0.77];
  prickleTs.forEach((t, i) => {
    const P = mainStemCurve.getPointAt(t);
    const T = mainStemCurve.getTangentAt(t);
    const az = i * 2.4 + 0.5;
    const radial = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    radial.addScaledVector(T, -radial.dot(T)).normalize();
    const mesh = makePrickle(lerp(0.14, 0.075, t) * rr(0.85, 1.15));
    const r = lerp(0.052, 0.026, Math.pow(t, 0.8)) * 0.76;
    mesh.position.copy(P).addScaledVector(radial, r);
    const xAx = T.clone();
    const zAx = new THREE.Vector3().crossVectors(xAx, radial).normalize();
    mesh.quaternion.copy(basisQuat(xAx, radial, zAx));
    mesh.castShadow = true;
    mainStemGroup.add(mesh);
  });

  // Main Foliage (Compound Leaves)
  const animatedLeaves = [];
  const leafNodes = [
    { t: 0.18, scale: 1.12 },
    { t: 0.35, scale: 1.05 },
    { t: 0.52, scale: 0.96 },
    { t: 0.68, scale: 0.86 },
    { t: 0.82, scale: 0.74 }
  ];
  leafNodes.forEach((n, i) => {
    const P = mainStemCurve.getPointAt(n.t);
    const az = i * 2.513 + 0.4;
    const leaf = makeCompoundLeaf(n.scale, i >= 3);
    leaf.position.copy(P).add(new THREE.Vector3(Math.cos(az), 0, Math.sin(az)).multiplyScalar(0.03));
    leaf.rotation.order = 'YZX';
    leaf.rotation.set(0, -az, 0.52 - i * 0.04);
    leaf.userData = { base: leaf.rotation.clone(), phase: i * 1.9, speed: 0.85 };
    mainStemGroup.add(leaf);
    animatedLeaves.push(leaf);

    // Glistening dewdrops on foliage
    for (let d = 0; d < 5; d++) {
      const drop = new THREE.Mesh(dewDropGeo, dewMat);
      const rad = rr(0.008, 0.016);
      drop.scale.set(rad * 1.2, rad * 0.55, rad * 1.2);
      drop.position.set(rr(0.1, 0.6) * n.scale, rr(0.02, 0.08) * n.scale, rr(-0.1, 0.1) * n.scale);
      leaf.add(drop);
      dewDropMeshes.push(drop);
    }
  });

  // Stage 4: Hero Full Splendor Bloom at Apex
  const heroFlower = createFlowerHead({ stage: 1.0, scale: 1.0, isHero: true });
  heroFlower.headGroup.position.copy(mainStemCurve.getPointAt(1));
  heroFlower.headGroup.quaternion.setFromUnitVectors(UP, mainStemCurve.getTangentAt(1));
  heroFlower.headGroup.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, -0.06)));
  mainStemGroup.add(heroFlower.headGroup);

  // Stage 3 (Right Branch): Half-Bloom Rose
  const branch1Curve = new THREE.CatmullRomCurve3([
    mainStemCurve.getPointAt(0.62),
    new THREE.Vector3(0.38, 2.05, 0.12),
    new THREE.Vector3(0.72, 2.32, 0.18),
    new THREE.Vector3(0.96, 2.52, 0.14)
  ]);
  const branch1Geo = makeTube(branch1Curve, 42, 8, (t) => lerp(0.024, 0.016, t), () => hex('#32642c'));
  const branch1Mesh = new THREE.Mesh(branch1Geo, stemMat);
  branch1Mesh.castShadow = true;
  lateralBranchesGroup.add(branch1Mesh);

  const flowerStage3 = createFlowerHead({ stage: 0.62, scale: 0.82 });
  flowerStage3.headGroup.position.copy(branch1Curve.getPointAt(1));
  flowerStage3.headGroup.quaternion.setFromUnitVectors(UP, branch1Curve.getTangentAt(1));
  flowerStage3.headGroup.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.3, -0.15)));
  lateralBranchesGroup.add(flowerStage3.headGroup);

  const b1Leaf = makeCompoundLeaf(0.78, false);
  b1Leaf.position.copy(branch1Curve.getPointAt(0.55));
  b1Leaf.rotation.set(0.3, 0.8, -0.4);
  b1Leaf.userData = { base: b1Leaf.rotation.clone(), phase: 3.2, speed: 0.9 };
  lateralBranchesGroup.add(b1Leaf);
  animatedLeaves.push(b1Leaf);

  // Stage 2 (Left Lower Branch): Pointed Opening Bud
  const branch2Curve = new THREE.CatmullRomCurve3([
    mainStemCurve.getPointAt(0.46),
    new THREE.Vector3(-0.32, 1.62, -0.1),
    new THREE.Vector3(-0.65, 1.92, -0.16),
    new THREE.Vector3(-0.85, 2.18, -0.12)
  ]);
  const branch2Geo = makeTube(branch2Curve, 42, 8, (t) => lerp(0.025, 0.015, t), () => hex('#33662d'));
  const branch2Mesh = new THREE.Mesh(branch2Geo, stemMat);
  branch2Mesh.castShadow = true;
  lateralBranchesGroup.add(branch2Mesh);

  const flowerStage2 = createFlowerHead({ stage: 0.28, scale: 0.68 });
  flowerStage2.headGroup.position.copy(branch2Curve.getPointAt(1));
  flowerStage2.headGroup.quaternion.setFromUnitVectors(UP, branch2Curve.getTangentAt(1));
  flowerStage2.headGroup.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, -0.4, 0.2)));
  lateralBranchesGroup.add(flowerStage2.headGroup);

  const b2Leaf = makeCompoundLeaf(0.72, false);
  b2Leaf.position.copy(branch2Curve.getPointAt(0.52));
  b2Leaf.rotation.set(-0.2, -0.9, 0.35);
  b2Leaf.userData = { base: b2Leaf.rotation.clone(), phase: 4.8, speed: 0.95 };
  lateralBranchesGroup.add(b2Leaf);
  animatedLeaves.push(b2Leaf);

  // Stage 1 (Left Upper Branch): Closed Immature Green Bud
  const branch3Curve = new THREE.CatmullRomCurve3([
    mainStemCurve.getPointAt(0.78),
    new THREE.Vector3(-0.12, 2.45, 0.22),
    new THREE.Vector3(-0.35, 2.78, 0.28),
    new THREE.Vector3(-0.48, 3.02, 0.24)
  ]);
  const branch3Geo = makeTube(branch3Curve, 36, 8, (t) => lerp(0.02, 0.012, t), () => hex('#376c30'));
  const branch3Mesh = new THREE.Mesh(branch3Geo, stemMat);
  branch3Mesh.castShadow = true;
  lateralBranchesGroup.add(branch3Mesh);

  const flowerStage1 = createFlowerHead({ stage: 0.08, scale: 0.52 });
  flowerStage1.headGroup.position.copy(branch3Curve.getPointAt(1));
  flowerStage1.headGroup.quaternion.setFromUnitVectors(UP, branch3Curve.getTangentAt(1));
  flowerStage1.headGroup.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, -0.2, 0.1)));
  lateralBranchesGroup.add(flowerStage1.headGroup);

  const b3Leaf = makeCompoundLeaf(0.62, true);
  b3Leaf.position.copy(branch3Curve.getPointAt(0.58));
  b3Leaf.rotation.set(0.1, -0.5, 0.2);
  b3Leaf.userData = { base: b3Leaf.rotation.clone(), phase: 5.6, speed: 1.1 };
  lateralBranchesGroup.add(b3Leaf);
  animatedLeaves.push(b3Leaf);

  // -----------------------------------------------------------
  //  Sparkle Dew Splash Particle System
  // -----------------------------------------------------------
  const splashParticleCount = 90;
  const splashGeo = new THREE.BufferGeometry();
  const splashPositions = new Float32Array(splashParticleCount * 3);
  const splashVelocities = [];
  const splashLifes = new Float32Array(splashParticleCount);

  for (let i = 0; i < splashParticleCount; i++) {
    splashPositions[i * 3] = 0;
    splashPositions[i * 3 + 1] = -10;
    splashPositions[i * 3 + 2] = 0;
    splashVelocities.push(new THREE.Vector3());
    splashLifes[i] = 0;
  }
  splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));
  const splashMat = new THREE.PointsMaterial({
    color: '#ebf8ff',
    size: 0.038,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const splashPoints = new THREE.Points(splashGeo, splashMat);
  scene.add(splashPoints);

  function triggerParticleBurst(origin, count = 28, speed = 1.6) {
    let spawned = 0;
    for (let i = 0; i < splashParticleCount && spawned < count; i++) {
      if (splashLifes[i] <= 0) {
        splashPositions[i * 3] = origin.x + (Math.random() - 0.5) * 0.08;
        splashPositions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.08;
        splashPositions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.08;

        const dir = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random() * 1.8 + 0.4,
          (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(speed * (0.6 + Math.random() * 0.8));

        splashVelocities[i].copy(dir);
        splashLifes[i] = 1.0;
        spawned++;
      }
    }
    splashGeo.attributes.position.needsUpdate = true;
  }

  // -----------------------------------------------------------
  //  Pot, Soil & Floating Pollen Motes
  // -----------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: '#101d12', roughness: 0.96 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  scene.add(ground);

  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.32, 0.68, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: '#3d3228', roughness: 0.78, side: THREE.DoubleSide })
  );
  pot.position.set(0, -0.38, 0);
  pot.castShadow = true;
  pot.receiveShadow = true;
  scene.add(pot);

  const potRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.045, 12, 48),
    new THREE.MeshStandardMaterial({ color: '#594838', roughness: 0.68 })
  );
  potRim.rotation.x = Math.PI / 2;
  potRim.position.y = -0.05;
  scene.add(potRim);

  const soil = new THREE.Mesh(
    new THREE.CircleGeometry(0.405, 48),
    new THREE.MeshStandardMaterial({ color: '#1a1612', roughness: 1.0 })
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = -0.045;
  soil.receiveShadow = true;
  scene.add(soil);

  // Atmospheric Garden Motes
  const moteCount = 100;
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePositions[i * 3] = (Math.random() - 0.5) * 7;
    motePositions[i * 3 + 1] = Math.random() * 5.2;
    motePositions[i * 3 + 2] = (Math.random() - 0.5) * 4;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({
      color: '#f6e4b8',
      size: 0.018,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  scene.add(motes);

  // -----------------------------------------------------------
  //  Physical Spring & Dynamics Simulation State
  // -----------------------------------------------------------
  const physics = {
    windSpeed: 1.0,
    gravity: 1.0,
    bloomStageSlider: 1.0,
    dewdropsVisible: true,
    plantMode: 'multi',

    tiltX: 0,
    tiltZ: 0,
    velX: 0,
    velZ: 0,
    kSpring: 38.0,
    kDamping: 4.2,

    shakeEnergy: 0,
    shakeFreq: 24.0,

    isDraggingPlant: false,
    dragStartPointer: new THREE.Vector2()
  };

  // -----------------------------------------------------------
  //  User Interaction: Click, Pull, Push, Raycasting
  // -----------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let pointerDownPos = new THREE.Vector2();
  let isPointerDown = false;
  let pointerDownTime = 0;
  let draggedDistance = 0;

  function onPointerDown(e) {
    if (e.target !== renderer.domElement) return;
    isPointerDown = true;
    pointerDownTime = performance.now();
    pointerDownPos.set(e.clientX, e.clientY);
    draggedDistance = 0;

    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects([plantMasterGroup], true);
    if (intersects.length > 0) {
      physics.isDraggingPlant = true;
      controls.enabled = false;
      renderer.domElement.classList.add('grabbing');
      physics.dragStartPointer.set(e.clientX, e.clientY);
    }
  }

  function onPointerMove(e) {
    if (!isPointerDown) return;
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    draggedDistance = Math.hypot(dx, dy);

    if (physics.isDraggingPlant) {
      const bendScale = 0.0035;
      physics.velX += dy * bendScale;
      physics.velZ += dx * bendScale;
      physics.tiltX = clamp01((physics.tiltX + dy * bendScale * 0.2 + 1) / 2) * 2 - 1;
      physics.tiltZ = clamp01((physics.tiltZ + dx * bendScale * 0.2 + 1) / 2) * 2 - 1;
      pointerDownPos.set(e.clientX, e.clientY);
    }
  }

  function onPointerUp(e) {
    isPointerDown = false;
    const clickDuration = performance.now() - pointerDownTime;
    renderer.domElement.classList.remove('grabbing');

    if (physics.isDraggingPlant) {
      physics.isDraggingPlant = false;
      controls.enabled = true;
      physics.velX *= 1.8;
      physics.velZ *= 1.8;
      showToast('Released: Elastic spring oscillation');
    }

    // Direct Click Effect
    if (draggedDistance < 6 && clickDuration < 350) {
      mouse.x = (e.clientX / innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects([plantMasterGroup], true);

      if (hits.length > 0) {
        const hit = hits[0];
        const impulseX = (Math.random() - 0.5) * 1.8;
        const impulseZ = (Math.random() - 0.5) * 1.8;
        physics.velX += impulseX;
        physics.velZ += impulseZ;

        triggerParticleBurst(hit.point, 24, 1.4);
        showToast('✨ Petal plucked: tactile vibration & dewdrop scatter');
      }
    }
  }

  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  // Shake Action
  function triggerShake(intensity = 1.0) {
    physics.shakeEnergy = Math.min(2.5, physics.shakeEnergy + 1.2 * intensity);
    physics.velX += (Math.random() - 0.5) * 2.5 * intensity;
    physics.velZ += (Math.random() - 0.5) * 2.5 * intensity;

    const heroPos = new THREE.Vector3();
    heroFlower.headGroup.getWorldPosition(heroPos);
    triggerParticleBurst(heroPos, 45, 2.2);
    showToast('🌪️ Rose shaken: natural elastic response');
  }

  // -----------------------------------------------------------
  //  UI Controls Binding
  // -----------------------------------------------------------
  const btnModeMulti = document.querySelector('#mode-multi');
  const btnModeSingle = document.querySelector('#mode-single');
  const titleText = document.querySelector('#title-text');

  function setPlantMode(mode) {
    physics.plantMode = mode;
    if (mode === 'multi') {
      btnModeMulti.classList.add('active');
      btnModeSingle.classList.remove('active');
      titleText.textContent = 'A Living Rose Bush';
      lateralBranchesGroup.visible = true;
      showToast('Displaying all 4 flower growth stages on branching plant');
    } else {
      btnModeSingle.classList.add('active');
      btnModeMulti.classList.remove('active');
      titleText.textContent = 'A Single Living Rose';
      lateralBranchesGroup.visible = false;
      showToast('Focusing on single hero bloom');
    }
  }

  btnModeMulti.addEventListener('click', () => setPlantMode('multi'));
  btnModeSingle.addEventListener('click', () => setPlantMode('single'));

  // Color Palette Selector & Custom Color
  const colorChips = document.querySelectorAll('.color-chip');
  colorChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      colorChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const key = chip.dataset.color;
      const pal = PALETTES[key];
      updateRoseColor(pal);
      showToast(`Palette changed to: ${pal.name}`);
    });
  });

  const customColorInput = document.querySelector('#custom-color-input');
  customColorInput.addEventListener('input', (e) => {
    colorChips.forEach((c) => c.classList.remove('active'));
    const hexVal = e.target.value;
    const baseCol = new THREE.Color(hexVal);
    const hsl = {};
    baseCol.getHSL(hsl);

    const clawCol = new THREE.Color().setHSL(hsl.h, hsl.s * 0.9, hsl.l * 0.2);
    const shadowCol = new THREE.Color().setHSL(hsl.h, hsl.s * 0.92, hsl.l * 0.38);
    const midCol = new THREE.Color().setHSL(hsl.h, hsl.s * 0.95, hsl.l * 0.58);
    const rimCol = new THREE.Color().setHSL(hsl.h, hsl.s * 0.9, Math.min(1, hsl.l * 1.25));
    const highCol = new THREE.Color().setHSL(hsl.h, hsl.s * 0.7, Math.min(1, hsl.l * 1.55));
    const sheenCol = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.1), Math.min(1, hsl.l * 1.3));
    const emissiveCol = new THREE.Color().setHSL(hsl.h, hsl.s * 0.9, hsl.l * 0.18);

    const customPal = {
      name: 'Custom Tone',
      claw: '#' + clawCol.getHexString(),
      shadow: '#' + shadowCol.getHexString(),
      mid: '#' + midCol.getHexString(),
      body: hexVal,
      rim: '#' + rimCol.getHexString(),
      highlight: '#' + highCol.getHexString(),
      sheen: '#' + sheenCol.getHexString(),
      emissive: '#' + emissiveCol.getHexString(),
      roughness: 0.68
    };
    updateRoseColor(customPal);
  });

  // Wind Speed Slider
  const windSlider = document.querySelector('#wind-slider');
  const windValBadge = document.querySelector('#wind-val');
  windSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    physics.windSpeed = val;
    let label = 'Gentle breeze';
    if (val === 0) label = 'Still air';
    else if (val < 0.6) label = 'Soft whisper';
    else if (val < 1.6) label = 'Gentle breeze';
    else if (val < 2.8) label = 'Brisk gust';
    else label = 'Gale wind';
    windValBadge.textContent = `${val.toFixed(1)} · ${label}`;
  });

  // Gravity Slider
  const gravitySlider = document.querySelector('#gravity-slider');
  const gravityValBadge = document.querySelector('#gravity-val');
  gravitySlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    physics.gravity = val;
    let label = 'Earth';
    if (val === 0) label = 'Weightless (Zero-G)';
    else if (val < 0.5) label = 'Moon gravity';
    else if (val <= 1.2) label = 'Earth gravity';
    else label = 'Heavy gravity';
    gravityValBadge.textContent = `${val.toFixed(1)}g · ${label}`;
  });

  document.querySelectorAll('.slider-ticks span').forEach((tick) => {
    tick.addEventListener('click', () => {
      const v = parseFloat(tick.dataset.val);
      gravitySlider.value = v;
      gravitySlider.dispatchEvent(new Event('input'));
    });
  });

  // Bloom Stage Slider
  const bloomSlider = document.querySelector('#bloom-slider');
  const bloomValBadge = document.querySelector('#bloom-val');
  bloomSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    physics.bloomStageSlider = val;
    bloomValBadge.textContent = `${Math.round(val * 100)}% · ${val > 0.85 ? 'Full Bloom' : val > 0.5 ? 'Half-Open' : 'Tight Bud'}`;

    for (const node of allPetalNodes) {
      const d = node.pivot.userData;
      const targetQuat = d.base.clone();
      node.pivot.quaternion.slerp(targetQuat, 0.5);
    }
  });

  // Shake Button
  document.querySelector('#btn-shake').addEventListener('click', () => triggerShake(1.2));

  // Dewdrops Toggle
  const dewBtn = document.querySelector('#btn-dew');
  dewBtn.addEventListener('click', () => {
    physics.dewdropsVisible = !physics.dewdropsVisible;
    dewDropMeshes.forEach((m) => (m.visible = physics.dewdropsVisible));
    dewBtn.textContent = physics.dewdropsVisible ? '💧 Dewdrops: On' : '💧 Dewdrops: Off';
    dewBtn.classList.toggle('active', physics.dewdropsVisible);
    showToast(physics.dewdropsVisible ? 'Morning dewdrops visible' : 'Dewdrops hidden');
  });

  // Panel Collapse / Expand
  const panel = document.querySelector('#control-panel');
  const panelToggle = document.querySelector('#panel-toggle');
  panelToggle.addEventListener('click', () => {
    const isCollapsed = panel.classList.toggle('collapsed');
    panelToggle.textContent = isCollapsed ? '+' : '—';
    panelToggle.setAttribute('aria-expanded', String(!isCollapsed));
  });

  // Camera Perspectives
  const camButtons = document.querySelectorAll('.cam-btn');
  let targetCamPos = CAM_PRESETS.hero.pos.clone();
  let targetCamTarget = CAM_PRESETS.hero.target.clone();

  camButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      camButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const viewKey = btn.dataset.view;
      if (CAM_PRESETS[viewKey]) {
        targetCamPos.copy(CAM_PRESETS[viewKey].pos);
        targetCamTarget.copy(CAM_PRESETS[viewKey].target);
        showToast(`Camera view: ${btn.textContent}`);
      }
    });
  });

  // -----------------------------------------------------------
  //  Animation & Real-Time Physics Loop
  //  Subtle, smooth, frame-rate independent breeze movement
  // -----------------------------------------------------------
  const clock = new THREE.Clock();
  const tmpE = new THREE.Euler(), tmpQ = new THREE.Quaternion();
  let rafId = 0;

  function animate() {
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsedTime();

    // Smooth Camera Transition
    camera.position.lerp(targetCamPos, 0.06);
    controls.target.lerp(targetCamTarget, 0.06);

    // Spring-Damper Simulation for Elastic Stem Deflection
    const F_spring_x = -physics.kSpring * physics.tiltX;
    const F_spring_z = -physics.kSpring * physics.tiltZ;
    const F_damp_x = -physics.kDamping * physics.velX;
    const F_damp_z = -physics.kDamping * physics.velZ;

    physics.velX += (F_spring_x + F_damp_x) * dt;
    physics.velZ += (F_spring_z + F_damp_z) * dt;
    physics.tiltX += physics.velX * dt;
    physics.tiltZ += physics.velZ * dt;

    if (physics.shakeEnergy > 0.001) {
      physics.shakeEnergy = Math.max(0, physics.shakeEnergy - dt * 1.8);
    }
    const shakeOffset = Math.sin(t * physics.shakeFreq) * physics.shakeEnergy * 0.08;

    // Gravity Sag Effect
    const gravitySagX = (physics.gravity - 1.0) * 0.055;
    const gravityDroop = (physics.gravity - 1.0) * 0.04;

    // Natural Subtle Breeze: Low-frequency harmonic movement (main stem relatively stable)
    const w = physics.windSpeed;
    const breezeSway1 = Math.sin(t * 0.65) * 0.016 + Math.sin(t * 1.25 + 1.1) * 0.007;
    const breezeSway2 = Math.sin(t * 0.52) * 0.012 + Math.cos(t * 0.95) * 0.005;

    plantMasterGroup.rotation.z = physics.tiltZ + w * breezeSway1 + shakeOffset;
    plantMasterGroup.rotation.x = physics.tiltX + w * breezeSway2 + gravitySagX;

    // Flower heads nodding naturally with bloom weight & breeze
    heroFlower.bloom.rotation.z = w * Math.sin(t * 0.82 + 0.5) * 0.012 + shakeOffset * 1.1;
    heroFlower.bloom.rotation.x = w * Math.sin(t * 0.64) * 0.009 + gravityDroop;

    flowerStage3.bloom.rotation.z = w * Math.sin(t * 0.95 + 1.2) * 0.015;
    flowerStage2.bloom.rotation.z = w * Math.sin(t * 1.1 + 1.8) * 0.018;
    flowerStage1.bloom.rotation.z = w * Math.sin(t * 1.25 + 2.5) * 0.02;

    // Petal Micro-Flutter (subtle organic breathing)
    for (const { pivot } of allPetalNodes) {
      const d = pivot.userData;
      const flutterAmp = d.amp * (1.0 + w * 0.7 + physics.shakeEnergy * 2.2);
      tmpE.set(
        Math.sin(t * 1.1 + d.phase) * flutterAmp,
        0,
        Math.sin(t * 1.35 + d.phase) * flutterAmp * 0.75
      );
      pivot.quaternion.copy(d.base).multiply(tmpQ.setFromEuler(tmpE));
    }

    // Foliage Gentle Breeze Sway & Gravity Sag
    for (const leaf of animatedLeaves) {
      const b = leaf.userData.base;
      const ph = leaf.userData.phase;
      const sp = leaf.userData.speed;
      leaf.rotation.set(
        b.x + w * Math.sin(t * 0.82 * sp + ph) * 0.022 + gravityDroop * 0.5,
        b.y + w * Math.sin(t * 0.68 * sp + ph) * 0.028,
        b.z + w * Math.sin(t * 0.98 * sp + ph) * 0.038 + shakeOffset * 1.3
      );
    }

    // Floating Atmospheric Motes
    const motesPos = motes.geometry.attributes.position;
    for (let i = 0; i < moteCount; i++) {
      let mx = motesPos.getX(i) + w * 0.0022 + 0.0005;
      let my = motesPos.getY(i) + 0.001 * Math.sin(t * 0.7 + i);
      if (mx > 3.5) mx = -3.5;
      if (my > 5.2) my = 0;
      motesPos.setXYZ(i, mx, my, motesPos.getZ(i));
    }
    motesPos.needsUpdate = true;

    // Splash Particles
    let activeParticles = 0;
    for (let i = 0; i < splashParticleCount; i++) {
      if (splashLifes[i] > 0) {
        splashLifes[i] -= dt * 1.2;
        const py = splashPositions[i * 3 + 1];
        const vel = splashVelocities[i];

        vel.y -= 9.8 * 0.4 * physics.gravity * dt;
        splashPositions[i * 3] += vel.x * dt;
        splashPositions[i * 3 + 1] += vel.y * dt;
        splashPositions[i * 3 + 2] += vel.z * dt;

        if (py < -0.05) {
          splashPositions[i * 3 + 1] = -0.05;
          vel.y *= -0.3;
          vel.x *= 0.6;
          vel.z *= 0.6;
        }
        activeParticles++;
      } else {
        splashPositions[i * 3 + 1] = -20;
      }
    }
    if (activeParticles > 0) {
      splashGeo.attributes.position.needsUpdate = true;
    }

    controls.update();
    renderer.render(scene, camera);
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  }
  addEventListener('resize', onResize);

  animate();
  setTimeout(() => loading.classList.add('done'), 500);
  setTimeout(() => loading.remove(), 1400);

  addEventListener('pagehide', () => {
    cancelAnimationFrame(rafId);
    renderer.dispose();
  }, { once: true });

} catch (err) {
  console.error(err);
  errorBox.style.display = 'block';
  errorBox.textContent = `WebGL initialization error: ${err.message}.`;
  loading.classList.add('done');
}
