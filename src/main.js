import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
  scene.background = new THREE.Color('#18251a');
  scene.fog = new THREE.FogExp2('#18251a', 0.035);

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
    for (let i = 0; i < 260; i++) {
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
    bumpScale: 0.8,
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
  const leafMat = new THREE.MeshPhysicalMaterial({
    map: leafMap,
    bumpMap: leafBump,
    bumpScale: 1.6,
    vertexColors: true,
    roughness: 0.5,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
    sheen: 0.15,
    sheenColor: new THREE.Color('#7fa85a'),
    envMapIntensity: 0.5,
    side: THREE.DoubleSide
  });
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
      shade: (u) => mix(hex('#4a2c1e'), hex('#6a2820'), u)
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
    const mesh = makePrickle(lerp(0.15, 0.08, t) * rr(0.85, 1.15));
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
    const W = len * 0.31;
    const tint = young
      ? [rr(1.22, 1.38), rr(0.86, 0.96), rr(0.8, 0.92)]    // bronze-red new growth
      : [rr(0.9, 1.05), rr(0.92, 1.08), rr(0.88, 1.0)];
    const geo = makeBlade({
      length: len, rows: 56, cols: 14,
      halfWidth: (u) => {
        const base = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.78)), 0.72);
        const saw = 1 - 0.07 + 0.07 * ((u * 14) % 1);                // serrated margin
        return W * base * (u > 0.08 && u < 0.95 ? saw : 1);
      },
      bend: (u) => 0.12 * Math.sin(u * 2.4) - 0.5 * Math.pow(u, 1.9),   // arch, then tip droops
      section: (u, v, w) => {
        const x = v * w;
        const fold = Math.abs(x) * 0.42;                                // V-shaped fold along the midrib
        const pucker = 0.006 * Math.sin(u * 30 + v * 2.4) * Math.abs(v) * Math.min(1, w * 12);
        return [x, fold + pucker];
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

  function makeCompoundLeaf(scale, young) {
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

    const specs = [
      { t: 0.52, side: 1, len: 0.38 }, { t: 0.52, side: -1, len: 0.38 },
      { t: 0.77, side: 1, len: 0.44 }, { t: 0.77, side: -1, len: 0.44 },
      { t: 1.0, side: 0, len: 0.56 }
    ];
    specs.forEach((sp) => {
      const P = rachis.getPointAt(sp.t);
      const T = rachis.getTangentAt(sp.t);
      const yAx = T.clone().applyAxisAngle(UP, sp.side * 0.9).normalize();
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
    { t: 0.17, scale: 1.1 }, { t: 0.34, scale: 1.02 }, { t: 0.5, scale: 0.94 },
    { t: 0.66, scale: 0.84 }, { t: 0.8, scale: 0.72 }
  ];
  leafNodes.forEach((n, i) => {
    const P = stemCurve.getPointAt(n.t);
    const az = i * 2.513 + 0.4;       // 144 deg: 2/5 phyllotaxis, as on real rose stems
    const leaf = makeCompoundLeaf(n.scale, i >= 3);
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
    const roll = lerp(0.0, 0.1, smoothstep(0.35, 1, s));                 // rim rolled back (outer petals)
    const ripple = lerp(0.004, 0.022, s);
    const rf = rr(9, 14), ph = rr(0, 6.28);
    const inner = 1 - s;
    const tint = [rr(0.93, 1.07), rr(0.88, 1.12), rr(0.88, 1.12)];
    const geo = makeBlade({
      length: L, rows: 44, cols: 28,
      halfWidth: (u) => petalOutline(u) * W,
      bend: (u) => bendTotal * Math.pow(u, 1.45),
      section: (u, v, w) => {
        const wr = wrap * (0.82 + 0.18 * smoothstep(0, 0.45, u));
        const a = (v * wr) / 2;
        const x = (w * Math.sin(a)) / (wr / 2);
        let zc = (w / (wr / 2)) * (1 - Math.cos(a));
        const edge = Math.pow(Math.abs(v), 2.6);
        zc += ripple * edge * smoothstep(0.3, 1, u) * Math.sin(u * rf + ph + v * 1.8);
        zc -= roll * Math.pow(smoothstep(0.58, 1.0, u), 1.6) * (0.3 + 0.7 * Math.pow(Math.abs(v), 1.4));
        return [x, zc];
      },
      yMod: (u, v) => -L * 0.045 * Math.pow(u, 9) * Math.exp(-v * v * 5),     // small notch in the tip
      shade: (u, v) => {
        // baked ambient occlusion: deep inside the bloom and near the claw it is darker
        const depth = lerp(0.3, 0.9, 1 - inner * 0.9);
        const ao = lerp(depth * 0.55, 1, smoothstep(0.0, 0.85, u));
        const edgeLift = 1 + 0.1 * Math.pow(Math.abs(v), 3) * smoothstep(0.4, 1, u);
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
      const row = Math.floor(rr(14, 36)), col = Math.floor(rr(8, 20));
      const idx = row * 29 + col;
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
  let breezeEnabled = true;
  const windButton = document.querySelector('#wind-toggle');
  windButton.addEventListener('click', () => {
    breezeEnabled = !breezeEnabled;
    windButton.textContent = breezeEnabled ? 'Ⅱ  Pause breeze' : '▶  Resume breeze';
    windButton.setAttribute('aria-pressed', String(breezeEnabled));
    document.querySelector('#wind-label').textContent = breezeEnabled ? 'Gentle breeze' : 'Still air';
  });
  document.querySelector('#reset-view').addEventListener('click', () => {
    camera.position.copy(HOME_POS);
    controls.target.copy(HOME_TARGET);
    controls.update();
  });

  // optional camera presets via URL: ?view=top | side | close | full  (add &still to pause the breeze)
  const params = new URLSearchParams(location.search);
  const view = params.get('view');
  if (view) {
    const presets = {
      top: [[0.1, 5.6, 1.1], [0.12, 2.9, 0.0]],
      side: [[4.4, 3.0, 0.1], [0.12, 2.9, 0.0]],
      close: [[0.9, 3.3, 2.5], [0.1, 3.0, 0]],
      full: [[0.5, 2.3, 9.5], [0.1, 1.9, 0]]
    };
    if (presets[view]) { camera.position.set(...presets[view][0]); controls.target.set(...presets[view][1]); controls.update(); }
    if (params.has('still')) breezeEnabled = false;
  }


  const clock = new THREE.Clock();
  const tmpE = new THREE.Euler(), tmpQ = new THREE.Quaternion();
  let rafId = 0;

  function animate() {
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    const wind = breezeEnabled ? 1 : 0;

    plant.rotation.z = wind * (Math.sin(t * 0.72) * 0.016 + Math.sin(t * 1.23 + 1.4) * 0.006);
    plant.rotation.x = wind * Math.sin(t * 0.56) * 0.008;
    bloom.rotation.z = wind * Math.sin(t * 0.92 + 0.7) * 0.012;
    bloom.rotation.x = wind * Math.sin(t * 0.68) * 0.008;

    for (const { pivot } of petalNodes) {
      const d = pivot.userData;
      tmpE.set(wind * Math.sin(t * 0.84 + d.phase) * d.amp, 0, wind * Math.sin(t * 1.1 + d.phase) * d.amp * 0.7);
      pivot.quaternion.copy(d.base).multiply(tmpQ.setFromEuler(tmpE));
    }
    for (const leaf of leafAnimated) {
      const b = leaf.userData.base, ph = leaf.userData.phase;
      leaf.rotation.set(b.x + wind * Math.sin(t * 0.9 + ph) * 0.02, b.y + wind * Math.sin(t * 0.7 + ph) * 0.03, b.z + wind * Math.sin(t * 1.05 + ph) * 0.045);
    }

    const pos = motes.geometry.attributes.position;
    for (let i = 0; i < moteCount; i++) {
      let x = pos.getX(i) + wind * 0.0018;
      let y = pos.getY(i) + 0.001 * Math.sin(t + i);
      if (x > 3) x = -3;
      if (y > 5) y = 0;
      pos.setXYZ(i, x, y, pos.getZ(i));
    }
    pos.needsUpdate = true;

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
