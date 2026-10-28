import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { WindSimulation } from './flower-lifecycle/wind.js';
import { Spring } from './flower-lifecycle/utils.js';
import './style.css';

/*
  A botanically structured procedural rose.

  Structure (outside -> in), following a real garden / hybrid-tea rose:
    - stem with prickles (hooked, flattened), tapered and colour-graded
    - compound leaves: petiole + rachis + 5 serrated, veined leaflets, stipules
    - receptacle ("hip") with 5 reflexed, tapering sepals
    - ~44 petals laid out on a golden-angle spiral (137.5 deg), exactly like phyllotaxis in a real bloom:
        outer petals  -> broad, open, rim rolled back and rippled
        middle petals -> cupped, leaning inward
        inner petals  -> tightly wrapped (convolute) around the centre
    - every petal: claw base, broad rounded tip with a small notch, cross-section wrap,
      lengthwise bend, painted vein texture + bump, baked ambient occlusion in vertex colours
    - dew droplets (transmissive glass) on the upper petals
*/

const app = document.querySelector('#app');
const errorBox = document.querySelector('#error');
const loading = document.querySelector('.loading');

// ---------- small helpers ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261024); // seeded: the rose is identical on every load
const rr = (a, b) => a + (b - a) * rand();
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const UP = new THREE.Vector3(0, 1, 0);

try {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c9d2bd');
  scene.fog = new THREE.FogExp2('#c9d2bd', 0.03);

  const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.3, 100);
  const HOME_POS = new THREE.Vector3(0.45, 2.85, 5.0);
  const HOME_TARGET = new THREE.Vector3(0.1, 2.52, 0);
  camera.position.copy(HOME_POS);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  app.prepend(renderer.domElement);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 1.6;
  controls.maxDistance = 12;
  controls.maxPolarAngle = Math.PI * 0.82;
  controls.target.copy(HOME_TARGET);
  controls.update();

  // ---------- lighting: soft studio environment + sun-like key ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;

  scene.add(new THREE.HemisphereLight('#dfe9cb', '#33241c', 0.6));
  const key = new THREE.DirectionalLight('#ffe2c4', 3.0);
  key.position.set(-3.2, 6.8, 4.2);
  key.target.position.set(0.1, 2.6, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2.6, right: 2.6, top: 3.4, bottom: -2.6, near: 1, far: 20 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 3;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#b4c9ff', 1.3);
  rim.position.set(4, 4.5, -4);
  scene.add(rim);
  const warmFill = new THREE.PointLight('#e8806a', 1.1, 8);
  warmFill.position.set(0.9, 3.1, 2.4);
  scene.add(warmFill);

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
  }

  const leafMap = canvasTexture(512, 1024, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, '#1d4220'); g.addColorStop(0.6, '#21491f'); g.addColorStop(1, '#2a5426');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = rand() * w, y = rand() * h, r = rr(10, 50);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, rand() < 0.5 ? 'rgba(10,40,10,0.06)' : 'rgba(150,190,90,0.05)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
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
    roughness: 0.62,
    sheen: 0.8,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#b3203f'),
    emissive: new THREE.Color('#40040f'),   // cheap stand-in for light scattering through thin petals
    emissiveIntensity: 0.22,
    side: THREE.DoubleSide,
    envMapIntensity: 0.45
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
    color: '#ffffff', roughness: 0.02, metalness: 0, transmission: 1, ior: 1.33,
    thickness: 0.05, transparent: false, envMapIntensity: 1.6, specularIntensity: 1
  });

  // ---------- generic parametric blade ----------
  // A blade grows along +y from its base, its surface normal is +z.
  //  halfWidth(u)   -> half the width at u in [0,1]
  //  bend(u)        -> angle (rad) the centre line has turned by u; positive curls toward +z
  //  section(u,v,w) -> [x, zOffset] cross-section for v in [-1,1] (default flat)
  //  yMod(u,v)      -> small extra displacement along y (used for the petal notch)
  //  shiftX(u)      -> sideways drift (used for hooked prickles)
  //  shade(u,v)     -> [r,g,b] vertex-colour multiplier (baked AO / tint)
  function makeBlade({ length, rows = 32, cols = 16, halfWidth, bend = () => 0, section, yMod, shiftX, shade }) {
    const positions = [], uvs = [], colors = [], indices = [];
    const ds = length / rows;
    let cy = 0, cz = 0;
    for (let i = 0; i <= rows; i++) {
      const u = i / rows;
      if (i > 0) {
        const bm = bend((i - 0.5) / rows);
        cy += Math.cos(bm) * ds;
        cz += Math.sin(bm) * ds;
      }
      const b = bend(u), sb = Math.sin(b), cb = Math.cos(b);
      const w = Math.max(halfWidth(u), 0.0004);
      for (let j = 0; j <= cols; j++) {
        const v = (j / cols) * 2 - 1;
        const [x0, zc] = section ? section(u, v, w) : [v * w, 0];
        const dy = yMod ? yMod(u, v) : 0;
        const dx = shiftX ? shiftX(u) : 0;
        positions.push(x0 + dx, cy + dy - sb * zc, cz + cb * zc);
        uvs.push((v + 1) / 2, u);
        const c = shade ? shade(u, v) : [1, 1, 1];
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
    return geo;
  }

  function basisQuat(x, y, z) {
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }

  // Tube with a varying radius + vertex colours (built from TubeGeometry then re-scaled per ring).
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
        colors[idx * 3] = col[0]; colors[idx * 3 + 1] = col[1]; colors[idx * 3 + 2] = col[2];
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
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
  const prickleNodes = [];
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
    mesh.userData.home = mesh.position.clone();
    mesh.userData.homeQ = mesh.quaternion.clone();
    plant.add(mesh);
    prickleNodes.push(mesh);
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
    leaf.userData.targetScale = n.scale;
    leaf.userData.leafDelay = i * 0.055;
    leaf.userData.home = leaf.position.clone();
    leaf.userData.relDir = new THREE.Vector3(Math.cos(az) * rr(0.12, 0.4), 0, Math.sin(az) * rr(0.12, 0.4));
    leaf.userData.rise = rr(0.2, 0.5);
    leaf.userData.spin = rr(0.8, 2.4) * (rand() < 0.5 ? -1 : 1);
    leaf.userData.spin2 = rr(0.6, 2.0) * (rand() < 0.5 ? -1 : 1);
    leaf.userData.relDelay = rr(0, 1.1);
    leaf.userData.az = az;
    leaf.userData.lift = new Spring(12, 3.0);
    leaf.userData.swing = new Spring(10, 2.8);
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
  const sepalNodes = [];
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
    const openQ = basisQuat(xw, yw, zw);

    // bud state: sepals wrapped up around the closed flower
    const phiC = 0.32;
    const ywC = new THREE.Vector3(0, Math.cos(phiC), 0).addScaledVector(r, Math.sin(phiC));
    const zwC = r.clone().multiplyScalar(-Math.cos(phiC)); zwC.y += Math.sin(phiC);
    const xwC = new THREE.Vector3().crossVectors(ywC, zwC);
    const closedQ = basisQuat(xwC, ywC, zwC);

    m.quaternion.copy(openQ);
    m.position.copy(r).multiplyScalar(0.115); m.position.y = -0.075;
    m.castShadow = true; m.receiveShadow = true;
    m.userData = { open: openQ, closed: closedQ, delay: 0.05 + i * 0.03 };
    bloom.add(m);
    sepalNodes.push(m);
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
    const openQ = basisQuat(xw, yw, zw);

    // bud state: every petal stands nearly upright, wrapped around the flower axis
    const phiC = 0.03 + 0.045 * s;
    const ywC = new THREE.Vector3(0, Math.cos(phiC), 0).addScaledVector(rhat, Math.sin(phiC));
    const zwC = rhat.clone().multiplyScalar(-Math.cos(phiC)); zwC.y += Math.sin(phiC);
    const xwC = new THREE.Vector3().crossVectors(ywC, zwC);
    const closedQ = basisQuat(xwC, ywC, zwC);

    const twist = new THREE.Quaternion().setFromAxisAngle(UP, rr(-0.07, 0.07));  // small twist
    const pivot = new THREE.Group();
    pivot.position.set(rhat.x * r0, y0, rhat.z * r0);
    pivot.quaternion.copy(openQ).multiply(twist);
    closedQ.multiply(twist);
    const mesh = createPetal(s);
    pivot.add(mesh);
    pivot.userData = {
      base: openQ.clone().multiply(twist),
      closed: closedQ,
      phase: ang * 1.7 + i,
      amp: 0.006 + 0.02 * s,
      delay: (1 - s) * 0.42,           // outer petals peel back first
      home: pivot.position.clone(),
      relDir: new THREE.Vector3(rhat.x * rr(0.1, 0.42), 0, rhat.z * rr(0.1, 0.42)),
      rise: rr(0.45, 0.85),
      spinAxis: new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize(),
      spinSpeed: rr(1.8, 5.5) * (rand() < 0.5 ? -1 : 1),
      relDelay: rr(0, 0.9)
    };
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
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#7c8a68', roughness: 0.96 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  scene.add(ground);

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.31, 0.65, 48, 1, true), new THREE.MeshStandardMaterial({ color: '#493c31', roughness: 0.78, side: THREE.DoubleSide }));
  pot.position.set(0, -0.37, 0);
  pot.castShadow = true; pot.receiveShadow = true;
  scene.add(pot);
  const potRim = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.045, 12, 48), new THREE.MeshStandardMaterial({ color: '#6a5744', roughness: 0.68 }));
  potRim.rotation.x = Math.PI / 2; potRim.position.y = -0.05;
  scene.add(potRim);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.385, 48), new THREE.MeshStandardMaterial({ color: '#211c16', roughness: 1 }));
  soil.rotation.x = -Math.PI / 2; soil.position.y = -0.045;
  scene.add(soil);

  const moteCount = 90;
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePositions[i * 3] = (Math.random() - 0.5) * 6;
    motePositions[i * 3 + 1] = Math.random() * 4.8;
    motePositions[i * 3 + 2] = (Math.random() - 0.5) * 3;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: '#f4dfb2', size: 0.018, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(motes);

  // =========================================================
  //  UI + ANIMATION
  // =========================================================
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const canvas = renderer.domElement;
  const tmpE = new THREE.Euler(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
  const DOWN = new THREE.Vector3(0, -1, 0);

  // ----- wind: a smooth, gusting field (shared with the lily page) that eases in and out -----
  const wind = new WindSimulation();
  wind.directionDeg = 15;
  wind.enabled = !reducedMotion && !params.has('still');
  const windButton = document.querySelector('#wind-toggle');
  const windLabel = document.querySelector('#wind-label');
  const syncWind = () => {
    windButton.textContent = wind.enabled ? 'Ⅱ  Pause breeze' : '▶  Resume breeze';
    windLabel.textContent = wind.enabled ? 'Gentle breeze' : 'Still air';
  };
  windButton.addEventListener('click', () => { wind.enabled = !wind.enabled; syncWind(); });
  syncWind();

  // ----- stem bending: the stem deflects like a cantilever under a tip load, anchored at the soil.
  // Prickles, leaves and the flower head ride on the bent stem; the head and leaves add their own lag.
  const STEM_H = stemCurve.points[stemCurve.points.length - 1].y;
  const WIND_BEND = 0.2;                                  // stem-tip deflection per unit of wind force
  const tipX = new Spring(6, 2.6), tipZ = new Spring(6, 2.6);
  const headNod = new Spring(10, 3.2);
  const bend = new THREE.Vector3(), lastBend = new THREE.Vector3(1, 1, 1);
  const bendShape = (y) => { const q = clamp01(y / STEM_H); return 0.5 * q * q * (3 - q); };
  const bendSlope = (y) => { const q = clamp01(y / STEM_H); return (1.5 / STEM_H) * q * (2 - q); };
  const tiltAxis = new THREE.Vector3();
  function tiltAt(y, extra, out) {
    const m = Math.hypot(bend.x, bend.z);
    if (m < 1e-7) return out.identity();
    tiltAxis.set(bend.z / m, 0, -bend.x / m);
    return out.setFromAxisAngle(tiltAxis, Math.atan(m * bendSlope(y)) + extra);
  }
  const stemRest = stemGeo.attributes.position.array.slice();
  function bendStem() {
    const p = stemGeo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const s = bendShape(stemRest[i + 1]);
      p[i] = stemRest[i] + bend.x * s;
      p[i + 2] = stemRest[i + 2] + bend.z * s;
    }
    stemGeo.attributes.position.needsUpdate = true;
    stemGeo.computeVertexNormals();
  }
  const headHome = head.position.clone(), headHomeQ = head.quaternion.clone();

  // ----- camera -----
  let viewTween = null;
  controls.addEventListener('start', () => { viewTween = null; });
  document.querySelector('#reset-view').addEventListener('click', () => {
    if (reducedMotion) {
      camera.position.copy(HOME_POS);
      controls.target.copy(HOME_TARGET);
      controls.update();
      return;
    }
    controls.enableDamping = false;                        // flush leftover drag momentum so it cannot fight the tween
    controls.update();
    controls.enableDamping = true;
    viewTween = { pos: camera.position.clone(), target: controls.target.clone(), t: 0 };
  });

  // ----- lifecycle: seedling -> leafing stem -> tight bud -> open bloom -> petals and leaves fall -> fade, repeat -----
  const GROW_DURATION = 7.4;
  const HOLD_DURATION = 2.6;
  const RELEASE_DURATION = 8.0;
  const BARE_DURATION = 0.8;
  const CYCLE_DURATION = GROW_DURATION + HOLD_DURATION + RELEASE_DURATION + BARE_DURATION;
  const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
  let lifeTime = reducedMotion ? GROW_DURATION : 0;      // reduced motion opens on the finished bloom
  let lifePlaying = !reducedMotion;
  let loopFading = false;

  // Detached petals and leaves fall through the air: drag pulls them toward the wind and a terminal
  // fall speed, they tumble, then settle flat on the soil, the pot rim or the ground.
  const fallers = [];
  for (const node of petalNodes) {
    const d = node.pivot.userData;
    fallers.push({ obj: node.pivot, home: bloom, at: (1 - node.s) * 2.6 + d.relDelay * 0.6, terminal: 0.85, drag: 2.8, axis: new THREE.Vector3(0, 0, 1), drift: d.relDir, spinAxis: d.spinAxis, spin: d.spinSpeed * 0.6, phase: d.phase });
  }
  for (const leaf of leafAnimated) {
    const u = leaf.userData;
    u.faller = { obj: leaf, home: plant, at: 2.4 + u.relDelay * 1.2, terminal: 1.1, drag: 2.2, axis: new THREE.Vector3(0, 1, 0), drift: u.relDir, spinAxis: new THREE.Vector3(1, 0.3, 0.2).normalize(), spin: u.spin * 0.5, phase: u.phase };
    fallers.push(u.faller);
  }
  for (const f of fallers) Object.assign(f, { falling: false, landed: false, landT: 0, vel: new THREE.Vector3(), fromQ: new THREE.Quaternion(), landQ: new THREE.Quaternion() });
  const fallAxis = new THREE.Vector3();
  function detach(f) {
    f.obj.updateWorldMatrix(true, false);
    plant.updateWorldMatrix(true, false);
    plant.attach(f.obj);                                   // keeps its current pose, now in plant space
    f.falling = true;
    f.vel.set(0, 0, 0);
  }
  function updateFaller(f, dt) {
    const o = f.obj;
    if (f.landed) {
      if (f.landT < 1) {
        f.landT = Math.min(1, f.landT + dt / 0.45);
        o.quaternion.slerpQuaternions(f.fromQ, f.landQ, easeOutCubic(f.landT));
      }
      return;
    }
    const k = 1 - Math.exp(-dt * f.drag);
    const flutter = wind.turbulence(f.phase, 1.7);
    f.vel.x += (wind.force.x * 0.9 + f.drift.x + flutter * 0.12 - f.vel.x) * k;
    f.vel.z += (wind.force.y * 0.9 + f.drift.z + wind.turbulence(f.phase + 9, 1.5) * 0.12 - f.vel.z) * k;
    f.vel.y += (-f.terminal * (1 + 0.35 * flutter) - f.vel.y) * k;
    o.position.addScaledVector(f.vel, dt);
    tmpQ2.setFromAxisAngle(f.spinAxis, f.spin * dt * (0.55 + 0.45 * Math.abs(flutter)));
    o.quaternion.multiply(tmpQ2);
    const r = Math.hypot(o.position.x, o.position.z);
    const floor = r < 0.385 ? -0.035 : r < 0.46 ? 0.005 : -0.05;   // soil, pot rim, ground
    if (o.position.y <= floor) {
      o.position.y = floor;
      f.landed = true;
      f.landT = 0;
      f.fromQ.copy(o.quaternion);
      fallAxis.copy(f.axis).applyQuaternion(o.quaternion);
      tmpQ.setFromUnitVectors(fallAxis, fallAxis.y < 0 ? DOWN : UP);   // settle flat on whichever face is lower
      f.landQ.copy(tmpQ).multiply(o.quaternion);
    }
  }
  function resetLifecycle() {
    lifeTime = 0;
    for (const f of fallers) {
      if (f.falling) f.home.add(f.obj);                    // its pose is rewritten on the next frame
      f.falling = f.landed = false;
    }
  }

  const growthButton = document.querySelector('#growth-replay');
  const lifeButton = document.querySelector('#life-toggle');
  const syncLife = () => { lifeButton.textContent = lifePlaying ? 'Ⅱ  Pause lifecycle' : '▶  Play lifecycle'; };
  growthButton.addEventListener('click', () => { resetLifecycle(); lifePlaying = true; syncLife(); });
  lifeButton.addEventListener('click', () => { lifePlaying = !lifePlaying; syncLife(); });
  syncLife();

  // optional camera presets via URL: ?view=top | side | close | full  (add &still to pause the breeze)
  const view = params.get('view');
  if (view) {
    const presets = {
      top: [[0.1, 5.6, 1.1], [0.12, 2.9, 0.0]],
      side: [[4.4, 3.0, 0.1], [0.12, 2.9, 0.0]],
      close: [[0.9, 3.3, 2.5], [0.1, 3.0, 0]],
      full: [[0.5, 2.3, 9.5], [0.1, 1.9, 0]]
    };
    if (presets[view]) { camera.position.set(...presets[view][0]); controls.target.set(...presets[view][1]); controls.update(); }
  }


  const clock = new THREE.Clock();
  let rafId = 0, growthDimmed = null;

  function animate() {
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // lifecycle clock: grow, hold the bloom, release petals/leaves, bare pause, fade and repeat
    if (lifePlaying && !loopFading) lifeTime = Math.min(CYCLE_DURATION, lifeTime + dt);
    if (lifeTime >= CYCLE_DURATION && !loopFading) {
      if (reducedMotion) resetLifecycle();
      else {
        loopFading = true;
        canvas.classList.add('is-fading');
        setTimeout(() => { resetLifecycle(); canvas.classList.remove('is-fading'); loopFading = false; }, 450);
      }
    }
    const growth = clamp01(lifeTime / GROW_DURATION);
    const releaseTime = Math.max(0, lifeTime - GROW_DURATION - HOLD_DURATION);
    const plantEase = easeOutCubic(smoothstep(0.0, 0.62, growth));
    const flowerOpen = smoothstep(0.46, 0.95, growth);
    plant.scale.setScalar(lerp(0.14, 1, plantEase));
    const dimmed = growth < 0.999;
    if (dimmed !== growthDimmed) { growthButton.style.opacity = dimmed ? '0.55' : '1'; growthDimmed = dimmed; }

    // wind response: stem tip springs toward the wind force, the head nods a little further and later
    wind.update(dt);
    bend.set(tipX.step(wind.force.x * WIND_BEND, dt), 0, tipZ.step(wind.force.y * WIND_BEND, dt));
    headNod.step(wind.speed * 0.05 + wind.turbulence(3.1, 0.7) * wind.amplitude * 0.035, dt);
    if (bend.distanceToSquared(lastBend) > 1e-12) { bendStem(); lastBend.copy(bend); }
    for (const p of prickleNodes) {
      const u = p.userData;
      p.position.copy(u.home).addScaledVector(bend, bendShape(u.home.y));
      p.quaternion.copy(tiltAt(u.home.y, 0, tmpQ)).multiply(u.homeQ);
    }
    head.position.copy(headHome).addScaledVector(bend, bendShape(headHome.y));
    head.quaternion.copy(tiltAt(headHome.y, headNod.x, tmpQ)).multiply(headHomeQ);

    for (const f of fallers) {
      if (!f.falling && releaseTime > f.at) detach(f);
      if (f.falling) updateFaller(f, dt);
    }

    const flutterK = wind.speed * 2.2;                   // petal flutter grows with the wind and its gusts
    for (const { pivot, mesh } of petalNodes) {
      const d = pivot.userData;
      if (pivot.parent !== bloom) continue;
      const local = easeOutCubic(clamp01((flowerOpen - d.delay) / (1 - d.delay)));
      tmpQ.copy(d.closed).slerp(d.base, local);
      mesh.scale.setScalar(lerp(0.42, 1, local));
      tmpE.set(wind.turbulence(d.phase, 0.9) * d.amp * flutterK * 1.6, 0, wind.turbulence(d.phase + 7, 1.3) * d.amp * flutterK);
      tmpQ2.setFromEuler(tmpE);
      pivot.position.copy(d.home);
      pivot.quaternion.copy(tmpQ).multiply(tmpQ2);
    }
    for (const sepal of sepalNodes) {
      const d = sepal.userData;
      const local = easeOutCubic(clamp01((flowerOpen - d.delay) / (1 - d.delay)));
      tmpQ.copy(d.closed).slerp(d.open, local);
      sepal.quaternion.copy(tmpQ);
    }
    const windX = wind.speed > 1e-6 ? wind.force.x / wind.speed : 0, windZ = wind.speed > 1e-6 ? wind.force.y / wind.speed : 0;
    for (const leaf of leafAnimated) {
      const b = leaf.userData.base, ph = leaf.userData.phase, u = leaf.userData;
      if (u.faller.falling) continue;
      // a leaf pointing into the wind is pushed back and up, a side-on leaf swings downwind
      const along = windX * Math.cos(u.az) + windZ * Math.sin(u.az);
      const across = windX * Math.sin(u.az) - windZ * Math.cos(u.az);
      const gusty = 0.75 + 0.25 * wind.turbulence(ph, 0.8);
      const lift = u.lift.step(-along * wind.speed * 0.28 * gusty, dt);
      const swing = u.swing.step(across * wind.speed * 0.32 * gusty, dt);
      const flutter = wind.turbulence(ph + 5, 2.6) * (0.015 + wind.gustLevel * 0.06) * wind.amplitude;
      const lp = easeOutCubic(clamp01((growth - 0.08 - u.leafDelay) / 0.42));
      leaf.position.copy(u.home).addScaledVector(bend, bendShape(u.home.y));
      leaf.scale.setScalar(u.targetScale * lerp(0.06, 1, lp));
      leaf.rotation.set(b.x + flutter, b.y + swing, b.z + lift);
      leaf.quaternion.premultiply(tiltAt(u.home.y, 0, tmpQ));
    }

    // pollen motes drift downwind; speeds are per second, so any refresh rate looks the same
    const pos = motes.geometry.attributes.position;
    const driftX = (0.03 + wind.force.x * 0.25) * dt, driftZ = wind.force.y * 0.1 * dt;
    for (let i = 0; i < moteCount; i++) {
      let x = pos.getX(i) + driftX;
      let y = pos.getY(i) + 0.06 * Math.sin(t * 0.6 + i) * dt;
      let z = pos.getZ(i) + driftZ;
      if (x > 3) x = -3;
      if (y > 5) y = 0;
      if (z > 1.5) z = -1.5;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;

    if (viewTween) {
      viewTween.t = Math.min(1, viewTween.t + dt / 0.9);
      const e = easeOutCubic(viewTween.t);
      camera.position.lerpVectors(viewTween.pos, HOME_POS, e);
      controls.target.lerpVectors(viewTween.target, HOME_TARGET, e);
      if (viewTween.t >= 1) viewTween = null;
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
  if (import.meta.env.DEV) {
    window.__rose = {
      wind, bend, fallers, camera, controls, HOME_POS,
      get lifeTime() { return lifeTime; }, set lifeTime(v) { lifeTime = v; },
      get lifePlaying() { return lifePlaying; },
      CYCLE: { GROW_DURATION, HOLD_DURATION, RELEASE_DURATION, CYCLE_DURATION },
      stemTipX: () => stemGeo.attributes.position.array[stemGeo.attributes.position.array.length - 3],
    };
  }
  animate();
  setTimeout(() => loading.classList.add('done'), 550);
  setTimeout(() => loading.remove(), 1500);

  addEventListener('pagehide', () => {
    cancelAnimationFrame(rafId);
    renderer.dispose();
  }, { once: true });
} catch (error) {
  console.error(error);
  errorBox.style.display = 'block';
  errorBox.textContent = `Could not start WebGL: ${error.message}. Try updating your browser or enabling hardware acceleration.`;
  loading.classList.add('done');
}
