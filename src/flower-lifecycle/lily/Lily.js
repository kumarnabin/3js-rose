import * as THREE from 'three';
import { clamp01, lerp, makeNoise1D, mulberry32, smoothstep, Spring } from '../utils.js';
import { createGrid, createTube, writeTube } from './geometry.js';

/*
  A procedural pink lily (Lilium, oriental type) that is posed every frame from two inputs:
    - pose:  lifecycle parameters from computePose(t)
    - wind:  WindSimulation (force + turbulence)

  Structure
    stem      tapered tube along a bendable spine, anchored at the ground; parallel-transport frames
    leaves    9 lanceolate leaves with parallel veins, spiralling up the stem, each with its own springs
    head      receptacle, 3 outer + 3 inner tepals, 6 stamens with versatile anthers, pistil
    capsule   the ovary, which grows after flowering into a 3-valved, 6-ribbed capsule that dries,
              splits from the top and sheds flat, papery seeds
  Wind bends the spine (base anchored, two springs so the top lags), leaves and petals respond
  through their own damped springs plus high-frequency flutter; nothing is rotated rigidly.
*/

export const QUALITY_RESOLUTION = {
  low: { petal: [10, 24], leaf: [4, 14], stem: [18, 8] },
  medium: { petal: [14, 34], leaf: [5, 20], stem: [26, 10] },
  high: { petal: [20, 46], leaf: [6, 26], stem: [34, 14] },
};

const STEM_LENGTH = 0.36;
const HEAD_DIR = new THREE.Vector2(0.26, 0.966).normalize(); // the bloom faces the default camera
const LEAF_COUNT = 13;
const CAPSULE_RADIUS = 0.0085;
const CAPSULE_HEIGHT = 0.038;

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _p3 = new THREE.Vector3(), _s = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const UNIT = new THREE.Vector3(1, 1, 1);

export class Lily {
  constructor(materials, { quality = 'high', seed = 20261028 } = {}) {
    this.materials = materials;
    this.object = new THREE.Group();
    this.object.name = 'lily';
    const rand = mulberry32(seed);
    this.rand = rand;

    // wind response: stem base + lagging top, per-petal and per-leaf springs
    this.stemBase = [new Spring(9, 3.4), new Spring(9, 3.4)];
    this.stemTop = [new Spring(5.5, 2.3), new Spring(5.5, 2.3)];

    this._createPetalSpecs(rand);
    this._createLeafSpecs(rand);

    this.head = new THREE.Group();
    this.head.matrixAutoUpdate = false;
    this.object.add(this.head);
    this._buildReceptacle();
    this._buildStamens(rand);
    this._buildPistil();
    this._buildCapsule(rand);

    this.headMatrix = new THREE.Matrix4();
    this.headPosition = new THREE.Vector3();
    this._lastLeafAge = -1;
    this._variation = 0.35;
    this.setQuality(quality);
  }

  // ---------------------------------------------------------------- specs

  _createPetalSpecs(rand) {
    this.petals = [];
    for (let i = 0; i < 6; i++) {
      const outer = i % 2 === 0;
      const noiseSeed = Math.floor(rand() * 1e6);
      this.petals.push({
        outer,
        az: (i * Math.PI) / 3 + (rand() - 0.5) * 0.06,
        length: (outer ? 0.088 : 0.085) * (1 + (rand() - 0.5) * 0.06),
        width: outer ? 0.0135 : 0.0178,
        r0: outer ? 0.0044 : 0.0036,
        y0: outer ? 0.003 : 0.0045,
        groove: outer ? 0.0011 : 0.0016,
        ruffle: outer ? 0.0006 : 0.0016,
        ruffleFreq: outer ? 16 : 21,
        reflex: (rand() - 0.5) * 0.18,
        phase: rand() * 10,
        edgeNoiseL: makeNoise1D(noiseSeed),
        edgeNoiseR: makeNoise1D(noiseSeed + 1),
        tint: rand() * 2 - 1,
        shade: rand() * 2 - 1,
        spring: new Spring(12, 2.6),
        // fall: delay within the fall window, landing spot and tumble
        fallDelay: rand() * 0.45,
        groundAngle: (i * Math.PI) / 3 + 0.5 + rand() * 0.6,
        groundRadius: 0.05 + rand() * 0.09,
        groundYaw: (rand() - 0.5) * 1.2,
        tumbleAxis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        tumble: 1.5 + rand() * 2,
        groundQuat: new THREE.Quaternion(),
        groundPos: new THREE.Vector3(),
        mesh: null,
      });
    }
  }

  _createLeafSpecs(rand) {
    this.leaves = [];
    for (let k = 0; k < LEAF_COUNT; k++) {
      const f = k / (LEAF_COUNT - 1);
      const length = lerp(0.145, 0.078, f) * (1 + (rand() - 0.5) * 0.12);
      this.leaves.push({
        index: k,
        s: 0.06 + 0.72 * Math.pow(f, 0.9),
        az: k * 2.39996 + 0.35, // golden angle
        length,
        width: length * (0.13 + rand() * 0.03),
        e0: lerp(0.78, 1.08, f) + (rand() - 0.5) * 0.12,
        arch: 1.1 + rand() * 0.45 - f * 0.25,
        fold: 0.26 + rand() * 0.1,
        phase: rand() * 10,
        tone: 1 + f * 0.08 + (rand() - 0.5) * 0.06,
        flap: new Spring(22 + rand() * 12, 3.2),
        roll: new Spring(28 + rand() * 10, 3.6),
        mesh: null,
        pivot: null,
      });
    }
  }

  // ---------------------------------------------------------------- static parts of the head

  _buildReceptacle() {
    const profile = [];
    for (let i = 0; i <= 10; i++) {
      const s = i / 10;
      profile.push(new THREE.Vector2(0.0034 + 0.003 * Math.sin(s * Math.PI * 0.9), -0.006 + s * 0.011));
    }
    const receptacle = new THREE.Mesh(new THREE.LatheGeometry(profile, 16), this.materials.stem);
    receptacle.castShadow = true;
    this.head.add(receptacle);
  }

  _buildStamens(rand) {
    this.stamenGroup = new THREE.Group();
    this.stamens = [];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.002, 0.004, 0),
      new THREE.Vector3(0.008, 0.025, 0),
      new THREE.Vector3(0.016, 0.048, 0),
      new THREE.Vector3(0.021, 0.066, 0),
      new THREE.Vector3(0.0225, 0.0715, 0),
    ]);
    const filamentGeo = new THREE.TubeGeometry(curve, 18, 0.00055, 6, false);
    const antherGeo = new THREE.CapsuleGeometry(0.0018, 0.0088, 4, 10);
    for (let i = 0; i < 6; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (i * Math.PI) / 3 + Math.PI / 6;
      const tilt = new THREE.Group();
      const filament = new THREE.Mesh(filamentGeo, this.materials.filament);
      const anther = new THREE.Mesh(antherGeo, this.materials.anther);
      anther.position.set(0.0232, 0.0728, 0);
      anther.rotation.set(Math.PI / 2, 0, (rand() - 0.5) * 0.5);
      filament.castShadow = anther.castShadow = true;
      tilt.add(filament, anther);
      pivot.add(tilt);
      this.stamenGroup.add(pivot);
      this.stamens.push({ tilt, phase: rand() * 10, lean: (rand() - 0.5) * 0.12 });
    }
    this.head.add(this.stamenGroup);
  }

  _buildPistil() {
    this.pistil = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.008, 0),
      new THREE.Vector3(0.002, 0.04, 0),
      new THREE.Vector3(0.0055, 0.072, 0),
      new THREE.Vector3(0.0068, 0.08, 0),
    ]);
    const style = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.00085, 6, false), this.materials.style);
    style.castShadow = true;
    this.pistil.add(style);
    const lobeGeo = new THREE.SphereGeometry(0.0017, 10, 8);
    for (let i = 0; i < 3; i++) {
      const lobe = new THREE.Mesh(lobeGeo, this.materials.stigma);
      const a = (i * Math.PI * 2) / 3;
      lobe.position.set(0.0068 + Math.cos(a) * 0.0011, 0.081, Math.sin(a) * 0.0011);
      lobe.scale.set(1, 0.75, 1);
      this.pistil.add(lobe);
    }
    this.head.add(this.pistil);
  }

  _buildCapsule(rand) {
    // Capsule-local: base at the origin, axis +Y. Three valves, each a 120-degree lobed shell.
    this.capsule = new THREE.Group();
    this.valves = [];
    const segU = 12, segV = 20;
    for (let k = 0; k < 3; k++) {
      const geo = createGrid(segU, segV, { flip: true });
      const pos = geo.attributes.position.array;
      const hingeY = CAPSULE_HEIGHT * 0.06;
      const hingeR = CAPSULE_RADIUS * 0.55;
      let n = 0;
      for (let j = 0; j <= segV; j++) {
        const s = j / segV;
        const psi = s * Math.PI;
        const y = (CAPSULE_HEIGHT * (1 - Math.cos(psi))) / 2;
        const radius = CAPSULE_RADIUS * Math.pow(Math.max(0, Math.sin(psi)), 0.42);
        for (let i = 0; i <= segU; i++) {
          const d = ((i / segU) * 2 - 1) * (Math.PI / 3);
          const lobe = 1 + 0.12 * Math.cos(d * 1.5) - 0.05 * Math.exp(-(d * d) / 0.015);
          const r = radius * lobe;
          // relative to the hinge so the valve can swing open about its base
          pos[n++] = r * Math.cos(d) - hingeR;
          pos[n++] = y - hingeY;
          pos[n++] = r * Math.sin(d);
        }
      }
      geo.computeVertexNormals();
      const valve = new THREE.Mesh(geo, this.materials.capsule);
      valve.castShadow = true;
      const pivot = new THREE.Group();
      pivot.rotation.y = (k * Math.PI * 2) / 3;
      const hinge = new THREE.Group();
      hinge.position.set(hingeR, hingeY, 0);
      hinge.add(valve);
      pivot.add(hinge);
      this.capsule.add(pivot);
      this.valves.push(hinge);
    }
    this.head.add(this.capsule);

    // seeds: flat, D-shaped, papery; stacked two per locule, released from the top when the capsule splits
    const seedGeo = new THREE.CircleGeometry(0.0034, 12);
    seedGeo.rotateX(-Math.PI / 2);
    seedGeo.scale(1, 1, 0.82);
    const colors = new Float32Array(seedGeo.attributes.position.count * 3);
    const dark = new THREE.Color('#4a2f1a'), light = new THREE.Color('#b8955f'), c = new THREE.Color();
    for (let i = 0; i < seedGeo.attributes.position.count; i++) {
      const x = seedGeo.attributes.position.getX(i), z = seedGeo.attributes.position.getZ(i);
      c.lerpColors(dark, light, Math.min(1, Math.hypot(x, z / 0.82) / 0.0034) ** 1.5);
      c.toArray(colors, i * 3);
    }
    seedGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.seedSpecs = [];
    for (let k = 0; k < 3; k++) {
      for (let m = 0; m < 2; m++) {
        for (let n = 0; n < 10; n++) {
          const released = n >= 6;
          this.seedSpecs.push({
            local: new THREE.Vector3().setFromCylindrical(
              new THREE.Cylindrical(CAPSULE_RADIUS * 0.48, (k * Math.PI * 2) / 3 + (m ? 0.3 : -0.3) + Math.PI / 2, 0.006 + (n / 9) * 0.026)
            ),
            tilt: new THREE.Euler((rand() - 0.5) * 0.4, rand() * Math.PI, (rand() - 0.5) * 0.4),
            released,
            delay: rand() * 0.5,
            groundAngle: -0.4 + (rand() - 0.5) * 2.4 + (rand() < 0.3 ? Math.PI : 0),
            groundRadius: 0.07 + rand() * 0.25,
            yaw: rand() * Math.PI * 2,
            phase: rand() * 10,
            tumbleAxis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
          });
        }
      }
    }
    this.seeds = new THREE.InstancedMesh(seedGeo, this.materials.seed, this.seedSpecs.length);
    this.seeds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.seeds.castShadow = true;
    this.seeds.frustumCulled = false;
    this._seedsHidden = false;
    this._hideSeeds();
    this.object.add(this.seeds);
  }

  // ---------------------------------------------------------------- quality-dependent dynamic meshes

  setQuality(quality) {
    const res = QUALITY_RESOLUTION[quality] ?? QUALITY_RESOLUTION.high;
    this.quality = quality;

    // stem + spine buffers
    if (this.stem) { this.object.remove(this.stem); this.stem.geometry.dispose(); }
    const [segments, radial] = res.stem;
    this.spineCount = segments + 1;
    this.spine = {
      points: new Float32Array(this.spineCount * 3),
      tangents: new Float32Array(this.spineCount * 3),
      normals: new Float32Array(this.spineCount * 3),
      binormals: new Float32Array(this.spineCount * 3),
    };
    this.stem = new THREE.Mesh(createTube(segments, radial), this.materials.stem);
    this.stem.castShadow = this.stem.receiveShadow = true;
    this.stem.frustumCulled = false;
    this.object.add(this.stem);

    for (const p of this.petals) {
      if (p.mesh) { this.object.remove(p.mesh); p.mesh.geometry.dispose(); }
      p.mesh = new THREE.Mesh(createGrid(res.petal[0], res.petal[1], { colors: true }), this.materials.petal);
      p.mesh.matrixAutoUpdate = false;
      p.mesh.castShadow = p.mesh.receiveShadow = true;
      p.mesh.frustumCulled = false;
      const rows = res.petal[1] + 1;
      p.cx = new Float32Array(rows); p.cy = new Float32Array(rows); p.th = new Float32Array(rows);
      this.object.add(p.mesh);
    }
    for (const leaf of this.leaves) {
      if (leaf.pivot) { this.object.remove(leaf.pivot); leaf.mesh.geometry.dispose(); }
      leaf.mesh = new THREE.Mesh(createGrid(res.leaf[0], res.leaf[1], { colors: true }), this.materials.leaf);
      leaf.mesh.castShadow = leaf.mesh.receiveShadow = true;
      leaf.mesh.frustumCulled = false;
      leaf.pivot = new THREE.Group();
      leaf.pivot.matrixAutoUpdate = false;
      leaf.pivot.add(leaf.mesh);
      this.object.add(leaf.pivot);
    }
    this._computeGroundPoses();
    this.setPetalVariation(this._variation);
    this._lastLeafAge = -1;
  }

  // Per-petal colour variation (vertex colours) plus baked occlusion at the petal base.
  setPetalVariation(amount) {
    this._variation = amount;
    for (const p of this.petals) {
      const geo = p.mesh.geometry;
      const col = geo.attributes.color.array;
      const { cols, rows } = geo.userData;
      const j = p.tint * amount;
      for (let r = 0; r < rows; r++) {
        const s = r / (rows - 1);
        const ao = 0.72 + 0.28 * smoothstep(0, 0.22, s);
        for (let i = 0; i < cols; i++) {
          const k = (r * cols + i) * 3;
          // warmer/cooler and lighter/darker per petal, as in a real bloom
          const light = 1 + 0.16 * p.shade * amount;
          col[k] = ao * (1 + 0.06 * j) * light;
          col[k + 1] = ao * (1 - 0.5 * j) * light;
          col[k + 2] = ao * (1 - 0.18 * j) * light;
        }
      }
      geo.attributes.color.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- per-frame update

  update(pose, wind, dt) {
    const amp = wind.amplitude;
    const fx = wind.force.x, fz = wind.force.y;

    // stem springs: the base responds first, the top lags and overshoots a little
    const sway = wind.turbulence(0.5, 0.55) * 0.035 * amp;
    this.stemBase[0].step(fx * 0.16 + sway, dt);
    this.stemBase[1].step(fz * 0.16 - sway * 0.6, dt);
    this.stemTop[0].step(fx * 0.12 + wind.turbulence(1.7, 0.9) * 0.05 * amp, dt);
    this.stemTop[1].step(fz * 0.12 + wind.turbulence(2.3, 0.8) * 0.05 * amp, dt);

    this._computeSpine(pose);
    const growthRadius = 0.85 + 0.15 * clamp01((pose.growth - 0.8) / 0.2);
    writeTube(this.stem.geometry, this.spine, (s) => lerp(0.0072, 0.0042, s) * growthRadius + 0.0012 * smoothstep(0.93, 1, s));

    // head frame at the end of the spine (X = N, Y = T, Z = B)
    const e = (this.spineCount - 1) * 3, S = this.spine;
    _a.fromArray(S.normals, e); _b.fromArray(S.tangents, e); _c.fromArray(S.binormals, e);
    this.headMatrix.makeBasis(_a, _b, _c).setPosition(_p.fromArray(S.points, e));
    this.headPosition.setFromMatrixPosition(this.headMatrix);
    this.head.matrix.copy(this.headMatrix);
    this.head.matrixWorldNeedsUpdate = true;

    this._updatePetals(pose, wind, dt);
    this._updateLeaves(pose, wind, dt);
    this._updateFlowerParts(pose, wind);
    this._updateSeeds(pose);

    this.materials.uniforms.uBud.value = pose.budTint;
    this.materials.uniforms.uFade.value = pose.fade;
    const age = pose.leafAge;
    this.materials.stem.color.setRGB(1 + 0.25 * age, 1 + 0.02 * age, 1 - 0.4 * age);
  }

  _computeSpine(pose) {
    const n = this.spineCount;
    const { points: P, tangents: T, normals: N, binormals: B } = this.spine;
    const ds = (STEM_LENGTH * pose.growth) / (n - 1);
    const bx0 = this.stemBase[0].x, bz0 = this.stemBase[1].x, bx1 = this.stemTop[0].x, bz1 = this.stemTop[1].x;
    let px = 0, py = 0, pz = 0;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      const top = Math.pow(smoothstep(0.35, 1, s), 2);
      const head = pose.headTilt * Math.pow(smoothstep(0.8, 1, s), 1.4) + pose.stemDroop * 0.55 * Math.pow(smoothstep(0.45, 1, s), 1.6);
      const tx = 0.05 * Math.sin(s * Math.PI * 1.1) + bx0 * Math.pow(s, 1.3) + bx1 * top + HEAD_DIR.x * head;
      const tz = 0.025 * Math.sin(s * Math.PI * 0.8 + 0.4) + bz0 * Math.pow(s, 1.3) + bz1 * top + HEAD_DIR.y * head;
      const mag = Math.hypot(tx, tz);
      const sm = mag > 1e-6 ? Math.sin(mag) / mag : 1;
      const o = i * 3;
      T[o] = tx * sm; T[o + 1] = Math.cos(mag); T[o + 2] = tz * sm;
      if (i > 0) {
        px += T[o - 3] * ds; py += T[o - 2] * ds; pz += T[o - 1] * ds;
      }
      P[o] = px; P[o + 1] = py; P[o + 2] = pz;
    }
    // parallel-transport frames so the flower and leaves never spin around the stem
    _b.fromArray(T, 0);
    _a.set(1, 0, 0).addScaledVector(_b, -_b.x).normalize();
    _a.toArray(N, 0);
    _c.crossVectors(_a, _b).toArray(B, 0);
    for (let i = 1; i < n; i++) {
      const o = i * 3;
      _p2.fromArray(T, o - 3);
      _p3.fromArray(T, o);
      _q.setFromUnitVectors(_p2, _p3);
      _a.fromArray(N, o - 3).applyQuaternion(_q);
      _a.addScaledVector(_p3, -_a.dot(_p3)).normalize();
      _a.toArray(N, o);
      _c.crossVectors(_a, _p3).toArray(B, o);
    }
  }

  // world matrix of the stem frame at arc parameter s (0 = ground, 1 = head)
  _frameAt(s, target) {
    const n = this.spineCount, S = this.spine;
    const x = s * (n - 1), i = Math.min(n - 2, Math.floor(x)), f = x - i, o = i * 3;
    _p.fromArray(S.points, o).lerp(_p2.fromArray(S.points, o + 3), f);
    _b.fromArray(S.tangents, o).lerp(_p2.fromArray(S.tangents, o + 3), f).normalize();
    _a.fromArray(S.normals, o).lerp(_p2.fromArray(S.normals, o + 3), f);
    _a.addScaledVector(_b, -_a.dot(_b)).normalize();
    _c.crossVectors(_a, _b);
    return target.makeBasis(_a, _b, _c).setPosition(_p);
  }

  // ---------------------------------------------------------------- petals

  _petalCenterline(p, pose, bend, flutter) {
    const rows = p.cx.length;
    const o = pose.open;
    const size = pose.petalSize;
    const limp = pose.droop;
    const th0 = lerp(p.outer ? 0.34 : 0.3, p.outer ? 0.56 : 0.5, o);
    let th1 = lerp(-0.42, (p.outer ? 2.45 : 2.25) + p.reflex, smoothstep(0, 1, o));
    th1 = lerp(th1, 1.3, limp); // a wilting tepal loses its spring and hangs instead of reflexing
    const pw = lerp(1.15, 1.85, o);
    const ds = (p.length * size) / (rows - 1);
    let cx = p.r0, cy = p.y0, prev = 0;
    for (let j = 0; j < rows; j++) {
      const s = j / (rows - 1);
      const th = th0 + (th1 - th0) * Math.pow(s, pw) + limp * (0.3 + 0.5 * s) + pose.curl * 0.9 * smoothstep(0.55, 1, s)
        + bend * Math.pow(s, 1.6) + flutter * smoothstep(0.55, 1, s);
      if (j > 0) { cx += Math.sin(prev) * ds; cy += Math.cos(prev) * ds; }
      p.cx[j] = cx; p.cy[j] = cy; p.th[j] = th;
      prev = th;
    }
  }

  _deformPetal(p, pose, bend, flutter, twist) {
    this._petalCenterline(p, pose, bend, flutter);
    const geo = p.mesh.geometry;
    const { cols, rows } = geo.userData;
    const pos = geo.attributes.position.array;
    const o = pose.open, curl = pose.curl;
    const W = p.width * pose.petalSize;
    const wrapK = Math.pow(1 - o, 1.5);
    const cup = lerp(0, 0.32, o) + curl * 0.9;
    let k = 0;
    for (let j = 0; j < rows; j++) {
      const s = j / (rows - 1);
      const cx = p.cx[j], cy = p.cy[j], th = p.th[j];
      const nx = Math.cos(th), ny = -Math.sin(th); // outer-face normal in the petal plane
      const shape = 0.12 * (1 - s) + Math.pow(Math.sin(Math.PI * Math.pow(s, 0.72)), 0.85) * (1 - 0.18 * s);
      const hwBase = W * shape * (1 - 0.35 * curl * smoothstep(0.3, 1, s));
      const edgeL = 1 + 0.05 * p.edgeNoiseL(s * 5.5), edgeR = 1 + 0.05 * p.edgeNoiseR(s * 5.5);
      const ruffleEnv = smoothstep(0.15, 0.4, s) * (1 - smoothstep(0.8, 1, s));
      const tw = twist * s, cTw = Math.cos(tw), sTw = Math.sin(tw);
      const groove = p.groove * Math.pow(1 - s, 1.5);
      const rho = Math.max(cx, 0.0015);
      for (let i = 0; i < cols; i++) {
        const u = (i / (cols - 1)) * 2 - 1, au = Math.abs(u);
        const l = u * hwBase * (u < 0 ? edgeL : edgeR);
        const off = -cup * u * u * hwBase
          + groove * Math.exp(-(u * u) / 0.05)
          + p.ruffle * au * au * au * Math.sin(s * p.ruffleFreq + p.phase + u * 1.3) * ruffleEnv
          + curl * 0.0006 * Math.sin(s * 16 + u * 2.2 + p.phase)
          + l * sTw;
        let x = cx + nx * off;
        const y = cy + ny * off;
        let z = l * cTw;
        if (wrapK > 0.001) {
          // bud: wrap the width around the flower axis so the tepals overlap and close
          const a = Math.max(-1.35, Math.min(1.35, z / rho));
          const x0 = x;
          x = lerp(x0, x0 * Math.cos(a), wrapK);
          z = lerp(z, x0 * Math.sin(a), wrapK);
        }
        pos[k++] = x; pos[k++] = y; pos[k++] = z;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }

  // Where each petal rests on the ground once fallen (computed from its wilted shape).
  _computeGroundPoses() {
    const wilted = { open: 1, petalSize: 0.93, droop: 1, curl: 1 };
    for (const p of this.petals) {
      this._petalCenterline(p, wilted, 0, 0);
      const last = p.cx.length - 1, mid = last >> 1;
      _a.set(p.cx[last] - p.cx[0], p.cy[last] - p.cy[0], 0).normalize();
      _b.set(Math.cos(p.th[mid]), -Math.sin(p.th[mid]), 0);
      _b.addScaledVector(_a, -_b.dot(_a)).normalize();
      _c.crossVectors(_a, _b);
      _m.makeBasis(_a, _b, _c).transpose();
      const R = _p.set(Math.cos(p.groundAngle), 0, Math.sin(p.groundAngle));
      const down = _p2.set(0, -1, 0);
      _p3.crossVectors(R, down);
      _m2.makeBasis(R, down, _p3);
      _m3.makeRotationY(p.groundYaw);
      _m2.premultiply(_m3).multiply(_m);
      p.groundQuat.setFromRotationMatrix(_m2);
      _s.set((p.cx[0] + p.cx[last]) / 2, (p.cy[0] + p.cy[last]) / 2, 0).applyQuaternion(p.groundQuat);
      p.groundPos.set(Math.cos(p.groundAngle) * p.groundRadius, 0.006, Math.sin(p.groundAngle) * p.groundRadius).sub(_s);
      p.groundPos.y = Math.max(p.groundPos.y, 0.004);
    }
  }

  _updatePetals(pose, wind, dt) {
    const amp = wind.amplitude;
    const flutterAmp = 0.15 * Math.pow(amp, 1.2);
    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i];
      // outward direction of this petal in world space
      _a.set(Math.cos(p.az), 0, -Math.sin(p.az)).transformDirection(this.headMatrix);
      const push = -(wind.force.x * _a.x + wind.force.y * _a.z);
      const bend = p.spring.step(push * 0.32 + wind.turbulence(p.phase, 0.9) * 0.07 * amp, dt);
      const flutter = wind.turbulence(p.phase + 3.1, 6.5) * flutterAmp;
      const twist = wind.turbulence(p.phase + 7.7, 1.4) * 0.16 * amp;
      this._deformPetal(p, pose, bend * (1 - pose.fall), flutter * (1 - pose.fall), twist);

      // attached pose
      _m.makeRotationY(p.az).premultiply(this.headMatrix);
      const fall = clamp01((pose.fall - p.fallDelay) / 0.55);
      if (fall <= 0) {
        p.mesh.matrix.copy(_m);
      } else {
        _m.decompose(_p, _q, _s);
        const f = smoothstep(0, 1, fall);
        _p.lerp(p.groundPos, Math.pow(f, 1.4));
        _p.y += 0.035 * Math.sin(Math.PI * f);
        _p.x += Math.cos(p.groundAngle + 1.3) * 0.025 * Math.sin(Math.PI * 2 * f);
        _p.z += Math.sin(p.groundAngle + 1.3) * 0.025 * Math.sin(Math.PI * 2 * f);
        _q.slerp(p.groundQuat, f);
        _q2.setFromAxisAngle(p.tumbleAxis, Math.sin(Math.PI * f) * p.tumble);
        _q.multiply(_q2);
        p.mesh.matrix.compose(_p, _q, UNIT);
      }
      p.mesh.matrixWorldNeedsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- leaves

  _updateLeaves(pose, wind, dt) {
    const amp = wind.amplitude;
    const youth = lerp(0.82, 1, clamp01((pose.growth - 0.8) / 0.2));
    const recolour = Math.abs(pose.leafAge - this._lastLeafAge) > 0.002;
    for (const leaf of this.leaves) {
      this._frameAt(leaf.s, _m3);
      _m.makeRotationY(leaf.az);
      _m2.makeTranslation(lerp(0.0072, 0.0042, leaf.s) * 0.9, 0, 0);
      leaf.pivot.matrix.copy(_m3).multiply(_m).multiply(_m2);
      leaf.pivot.matrixWorldNeedsUpdate = true;

      // wind relative to this leaf: along it flaps it, across it rolls it
      _a.set(Math.cos(leaf.az), 0, -Math.sin(leaf.az)).transformDirection(_m3);
      _b.set(Math.sin(leaf.az), 0, Math.cos(leaf.az)).transformDirection(_m3);
      const along = wind.force.x * _a.x + wind.force.y * _a.z;
      const across = wind.force.x * _b.x + wind.force.y * _b.z;
      const flap = leaf.flap.step(-along * 0.32 + wind.turbulence(leaf.phase, 2.2) * 0.12 * amp, dt);
      const roll = leaf.roll.step(across * 0.55 + wind.turbulence(leaf.phase + 4.2, 3.1) * 0.22 * amp, dt);
      this._deformLeaf(leaf, pose, youth, flap, roll);
      if (recolour) this._colourLeaf(leaf, pose.leafAge);
    }
    if (recolour) this._lastLeafAge = pose.leafAge;
  }

  _deformLeaf(leaf, pose, youth, flap, roll) {
    const geo = leaf.mesh.geometry;
    const { cols, rows } = geo.userData;
    const pos = geo.attributes.position.array;
    const L = leaf.length * youth, W = leaf.width * youth;
    const e0 = leaf.e0 - pose.leafDroop * 0.3;
    const arch = leaf.arch + pose.leafDroop * 0.85;
    const ds = L / (rows - 1);
    let cx = 0, cy = 0, prev = e0, k = 0;
    for (let j = 0; j < rows; j++) {
      const s = j / (rows - 1);
      const el = e0 - arch * Math.pow(s, 1.3) + flap * Math.pow(s, 1.5);
      if (j > 0) { cx += Math.cos(prev) * ds; cy += Math.sin(prev) * ds; }
      prev = el;
      const nx = -Math.sin(el), ny = Math.cos(el); // upper-surface normal in the leaf plane
      const hw = W * (0.1 * (1 - s) * (1 - s) + Math.pow(Math.sin(Math.PI * Math.pow(s, 0.68)), 0.8) * (1 - 0.12 * s));
      const r = roll * s, cR = Math.cos(r), sR = Math.sin(r);
      for (let i = 0; i < cols; i++) {
        const u = (i / (cols - 1)) * 2 - 1;
        const l = u * hw;
        const off = l * sR + leaf.fold * Math.abs(u) * hw * cR;
        pos[k++] = cx + nx * off;
        pos[k++] = cy + ny * off;
        pos[k++] = l * cR;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }

  _colourLeaf(leaf, age) {
    const geo = leaf.mesh.geometry;
    const col = geo.attributes.color.array;
    const { cols, rows } = geo.userData;
    // lower leaves yellow first; tips and margins before the midrib
    const local = clamp01(age * 1.5 - (leaf.index / (LEAF_COUNT - 1)) * 0.55);
    let k = 0;
    for (let j = 0; j < rows; j++) {
      const s = j / (rows - 1);
      for (let i = 0; i < cols; i++) {
        const u = (i / (cols - 1)) * 2 - 1;
        const a = clamp01(local * (0.55 + Math.pow(s, 0.8) * 0.7 + u * u * 0.3));
        const brown = smoothstep(0.7, 1, a);
        col[k++] = leaf.tone * lerp(lerp(1, 1.55, a), 1.05, brown);
        col[k++] = leaf.tone * lerp(lerp(1, 1.08, a), 0.72, brown);
        col[k++] = leaf.tone * lerp(lerp(1, 0.5, a), 0.42, brown);
      }
    }
    geo.attributes.color.needsUpdate = true;
  }

  // ---------------------------------------------------------------- stamens, pistil, capsule, seeds

  _updateFlowerParts(pose, wind) {
    const amp = wind.amplitude;
    const stamenScale = lerp(0.25, 1, pose.stamenExtend) * (1 - 0.3 * pose.stamenWither) * (1 - pose.stamenFall);
    this.stamenGroup.visible = stamenScale > 0.002;
    this.stamenGroup.scale.setScalar(Math.max(stamenScale, 1e-4));
    for (const st of this.stamens) {
      st.tilt.rotation.z = -pose.stamenWither * 0.75 + st.lean + wind.turbulence(st.phase, 3.3) * 0.07 * amp;
      st.tilt.rotation.x = wind.turbulence(st.phase + 2, 2.7) * 0.05 * amp;
    }
    const m = this.materials;
    m.anther.color.lerpColors(COLOURS.anther, COLOURS.antherDry, pose.stamenWither);
    m.filament.color.lerpColors(COLOURS.filament, COLOURS.filamentDry, pose.stamenWither);

    const styleScale = 1 - pose.styleWither * 0.92;
    this.pistil.visible = styleScale > 0.1;
    this.pistil.scale.set(1, Math.max(styleScale * lerp(0.3, 1, pose.stamenExtend), 1e-3), 1); // stays inside the bud
    m.style.color.lerpColors(COLOURS.style, COLOURS.styleDry, pose.styleWither);

    this.capsule.scale.setScalar(lerp(0.3, 1, pose.capsuleGrow));
    for (const hinge of this.valves) hinge.rotation.z = -pose.capsuleSplit * 0.48;
    m.capsule.color.lerpColors(COLOURS.capsule, COLOURS.capsuleTan, smoothstep(0, 0.6, pose.capsuleDry)).lerp(COLOURS.capsuleDry, smoothstep(0.5, 1, pose.capsuleDry));
    this.materials.capsule.roughness = lerp(0.45, 0.9, pose.capsuleDry);
  }

  _hideSeeds() {
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < this.seedSpecs.length; i++) this.seeds.setMatrixAt(i, _m);
    this.seeds.instanceMatrix.needsUpdate = true;
    this._seedsHidden = true;
  }

  _updateSeeds(pose) {
    if (pose.capsuleGrow < 0.9) {
      if (!this._seedsHidden) this._hideSeeds();
      return;
    }
    this._seedsHidden = false;
    this.capsule.updateMatrix();
    _m3.multiplyMatrices(this.headMatrix, this.capsule.matrix); // capsule-local -> world
    _m3.decompose(_p, _capsuleQuat, _s); // rotation only: the capsule group is scaled
    _p3.set(0, CAPSULE_HEIGHT * 1.2, 0).applyMatrix4(_m3); // just above the opening
    for (let i = 0; i < this.seedSpecs.length; i++) {
      const sd = this.seedSpecs[i];
      _p.copy(sd.local).applyMatrix4(_m3);
      _q.copy(_capsuleQuat).multiply(_q2.setFromEuler(sd.tilt));
      const f = sd.released ? clamp01((pose.seedRelease - sd.delay) / 0.5) : 0;
      if (f > 0) {
        // rise out of the opened top, then flutter down to the soil
        const exit = Math.min(1, f / 0.18);
        const g = smoothstep(0.18, 1, f);
        _p2.copy(_p).lerp(_p3, exit);
        const gx = Math.cos(sd.groundAngle) * sd.groundRadius, gz = Math.sin(sd.groundAngle) * sd.groundRadius;
        _p.set(lerp(_p2.x, gx, g), lerp(_p2.y, 0.002, g * g), lerp(_p2.z, gz, g));
        _p.y += 0.03 * Math.sin(Math.PI * g) * (1 - g);
        _p.x += Math.sin(g * Math.PI * 5 + sd.phase) * 0.012 * (1 - g);
        _p.z += Math.cos(g * Math.PI * 4 + sd.phase) * 0.01 * (1 - g);
        _q2.setFromAxisAngle(sd.tumbleAxis, g * Math.PI * 3 * (1 - g));
        _q3.setFromAxisAngle(Y_AXIS, sd.yaw);
        _q.slerp(_q3, g).multiply(_q2);
      }
      this.seeds.setMatrixAt(i, _m.compose(_p, _q, UNIT));
    }
    this.seeds.instanceMatrix.needsUpdate = true;
  }

  // true when every spring has come to rest, so a frame without wind or lifecycle change can be skipped
  isSettled() {
    this._springs ??= [...this.stemBase, ...this.stemTop, ...this.petals.map((p) => p.spring), ...this.leaves.flatMap((l) => [l.flap, l.roll])];
    return this._springs.every((s) => s.resting && Math.abs(s.x) < 1e-4);
  }

  dispose() {
    this.object.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.seeds.dispose();
  }
}

const _capsuleQuat = new THREE.Quaternion();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const COLOURS = {
  anther: new THREE.Color('#8e3a17'), antherDry: new THREE.Color('#4f3622'),
  filament: new THREE.Color('#e7ecd0'), filamentDry: new THREE.Color('#a08c62'),
  style: new THREE.Color('#dbe7b9'), styleDry: new THREE.Color('#8c7a52'),
  capsule: new THREE.Color('#7c9a3c'), capsuleTan: new THREE.Color('#a8875a'), capsuleDry: new THREE.Color('#6f5134'),
};
