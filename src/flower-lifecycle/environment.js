import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { canvasTexture, drawBackdrop, drawGlow, drawSoil } from './textures.js';
import { mulberry32 } from './utils.js';

// Lighting presets, painted garden backdrop, soil + grass, and optional ambient particles.

export const LIGHTING = {
  daylight: {
    label: 'Daylight',
    key: { color: '#fff1df', intensity: 3.1, position: [-0.9, 1.6, 1.15] },
    fill: { color: '#d6e5ff', intensity: 0.55, position: [1.2, 0.6, 1.4] },
    rim: { color: '#ffffff', intensity: 0.9, position: [0.8, 0.9, -1.2] },
    hemi: { sky: '#dcecff', ground: '#3d4a2a', intensity: 0.85 },
    env: 0.55, exposure: 1.0, trans: { color: '#ffe1e8', strength: 0.35 }, sun: { color: '#ffffff', opacity: 0.0 },
    fog: { garden: '#2c4a2a', mist: '#c1cfba', night: '#0c1014' },
  },
  sunset: {
    label: 'Warm sunset',
    key: { color: '#ffb066', intensity: 4.2, position: [-1.25, 0.95, -0.9] },
    fill: { color: '#93a9ff', intensity: 0.5, position: [1.0, 0.5, 1.5] },
    rim: { color: '#ffcf9d', intensity: 0.75, position: [-0.6, 0.5, 1.25] },
    hemi: { sky: '#ffd3a3', ground: '#2a2216', intensity: 0.55 },
    env: 0.35, exposure: 1.05, trans: { color: '#ffad7e', strength: 0.9 }, sun: { color: '#ffc27a', opacity: 0.95 },
    fog: { garden: '#17241a', mist: '#c9c2a2', night: '#120f0d' },
  },
};

export const PARTICLE_MODES = { none: 'None', pollen: 'Pollen motes', petals: 'Drifting petals' };

const QUALITY = {
  low: { shadow: 0, grass: 600, motes: 70, petals: 10 },
  medium: { shadow: 1024, grass: 1400, motes: 160, petals: 22 },
  high: { shadow: 2048, grass: 2600, motes: 320, petals: 40 },
};

export class GardenEnvironment {
  constructor(scene, renderer, { anisotropy = 4, petalMap } = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.lighting = 'sunset';
    this.background = 'garden';
    this.particles = 'pollen';
    this.blend = 1; // 0 = daylight, 1 = sunset (animated)
    this.blendTarget = 1;

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = this.envTexture;

    this.hemi = new THREE.HemisphereLight();
    this.key = new THREE.DirectionalLight();
    this.key.castShadow = true;
    this.key.target.position.set(0, 0.22, 0);
    Object.assign(this.key.shadow.camera, { left: -0.45, right: 0.45, top: 0.6, bottom: -0.3, near: 0.1, far: 6 });
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.004;
    this.key.shadow.radius = 4;
    this.fill = new THREE.DirectionalLight();
    this.rim = new THREE.DirectionalLight();
    scene.add(this.hemi, this.key, this.key.target, this.fill, this.rim);

    // painted, out-of-focus garden wrapped around the scene
    this.backdropTexture = canvasTexture(2048, 1024, drawBackdrop, { anisotropy });
    this.backdrop = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.4, 5, 72, 1, true),
      new THREE.MeshBasicMaterial({ map: this.backdropTexture, side: THREE.BackSide, fog: false, toneMapped: false, depthWrite: false })
    );
    this.backdrop.position.y = 1.4;
    this.backdrop.renderOrder = -1;
    scene.add(this.backdrop);

    this.glowTexture = canvasTexture(128, 128, drawGlow);
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, transparent: true }));
    this.sun.scale.setScalar(1.8);
    scene.add(this.sun);

    scene.fog = new THREE.FogExp2('#17241a', 0.22);
    this._buildGround(anisotropy);
    this._buildGrass();
    this._buildParticles(petalMap);
    this.applyLighting(true);
  }

  _buildGround(anisotropy) {
    const soil = canvasTexture(1024, 1024, drawSoil, { anisotropy, repeat: 5 });
    const fade = canvasTexture(256, 256, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, '#ffffff');
      g.addColorStop(1, '#000000');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }, { srgb: false });
    this.groundTextures = [soil, fade];
    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: soil, alphaMap: fade, transparent: true, roughness: 0.95, color: '#8f8170' })
    );
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    // a low mound of soil around the stem
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.18, 1),
      new THREE.MeshStandardMaterial({ map: soil, roughness: 1, color: '#b4a28c' })
    );
    mound.receiveShadow = true;
    this.scene.add(mound);
    this.mound = mound;
  }

  _buildGrass() {
    const blade = new THREE.PlaneGeometry(0.004, 0.07, 1, 4);
    blade.translate(0, 0.035, 0);
    const p = blade.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const h = p.getY(i) / 0.07;
      p.setX(i, p.getX(i) * (1 - h * 0.92) + 0.012 * h * h);
    }
    blade.computeVertexNormals();
    this.grassUniforms = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2() } };
    const material = new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.grassUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec2 uWind;')
        .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
          float bladeH = clamp(position.y / 0.07, 0.0, 1.0);
          vec4 root = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sway = 0.65 + 0.35 * sin(uTime * 1.9 + root.x * 9.0 + root.z * 7.0);
          vec3 push = transpose(mat3(instanceMatrix)) * vec3(uWind.x, 0.0, uWind.y);
          transformed += push * bladeH * bladeH * 0.03 * sway;`);
    };
    material.customProgramCacheKey = () => 'lily-grass';
    const max = QUALITY.high.grass;
    this.grass = new THREE.InstancedMesh(blade, material, max);
    const rand = mulberry32(99);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < max; i++) {
      const r = 0.05 + Math.pow(rand(), 0.75) * 1.1; // denser near the plant
      const a = rand() * Math.PI * 2;
      pos.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3));
      const h = 0.35 + rand() * 0.6;
      s.set(0.8 + rand() * 0.6, h, 1);
      this.grass.setMatrixAt(i, m.compose(pos, q, s));
      this.grass.setColorAt(i, c.setHSL(0.22 + rand() * 0.07, 0.35 + rand() * 0.2, 0.08 + rand() * 0.1));
    }
    this.grass.receiveShadow = true;
    this.scene.add(this.grass);
  }

  _buildParticles(petalMap) {
    const max = QUALITY.high.motes;
    const rand = mulberry32(7);
    this.motePositions = new Float32Array(max * 3);
    this.motePhases = new Float32Array(max);
    for (let i = 0; i < max; i++) {
      this.motePositions[i * 3] = (rand() - 0.5) * 1.4;
      this.motePositions[i * 3 + 1] = 0.05 + rand() * 0.8;
      this.motePositions[i * 3 + 2] = (rand() - 0.5) * 1.1 - 0.05;
      this.motePhases[i] = rand() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.motePositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({
      map: this.glowTexture, color: '#ffe2a8', size: 0.007, transparent: true, opacity: 0.75,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);

    // small curved petal pieces carried by the wind (from other flowers in the garden)
    const piece = new THREE.PlaneGeometry(0.022, 0.034, 3, 4);
    const pp = piece.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i) / 0.011, y = pp.getY(i) / 0.017;
      pp.setX(i, pp.getX(i) * (1 - 0.55 * Math.abs(y) ** 1.5));
      pp.setZ(i, 0.004 * x * x + 0.003 * y * y);
    }
    piece.computeVertexNormals();
    const pmax = QUALITY.high.petals;
    this.drift = new THREE.InstancedMesh(piece, new THREE.MeshStandardMaterial({ map: petalMap, side: THREE.DoubleSide, roughness: 0.55 }), pmax);
    this.drift.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.drift.frustumCulled = false;
    this.driftState = [];
    for (let i = 0; i < pmax; i++) {
      this.driftState.push({
        p: new THREE.Vector3((rand() - 0.5) * 2.4, 0.1 + rand() * 0.8, -0.7 + rand() * 1.0),
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6)),
        axis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        spin: 1.5 + rand() * 3,
        phase: rand() * 10,
        fall: 0.02 + rand() * 0.03,
      });
    }
    this.scene.add(this.drift);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._one = new THREE.Vector3(1, 1, 1);
  }

  setQuality(quality) {
    const q = QUALITY[quality] ?? QUALITY.high;
    this.quality = quality;
    this.key.castShadow = q.shadow > 0;
    if (q.shadow && this.key.shadow.mapSize.x !== q.shadow) {
      this.key.shadow.mapSize.set(q.shadow, q.shadow);
      this.key.shadow.map?.dispose();
      this.key.shadow.map = null;
    }
    this.grass.count = q.grass;
    this.motes.geometry.setDrawRange(0, q.motes);
    this.drift.count = q.petals;
  }

  setLighting(name) {
    if (!LIGHTING[name]) return;
    this.lighting = name;
    this.blendTarget = name === 'sunset' ? 1 : 0;
    this._repaintBackdrop();
  }

  setBackground(name) {
    this.background = name;
    this._repaintBackdrop();
    this.applyLighting(false);
  }

  setParticles(mode) {
    this.particles = mode;
    this.motes.visible = mode === 'pollen';
    this.drift.visible = mode === 'petals';
  }

  _repaintBackdrop() {
    this.backdropTexture.userData.redraw(this.background, this.lighting);
  }

  // Interpolate every light between the two presets by `blend`.
  applyLighting(snap) {
    if (snap) this.blend = this.blendTarget;
    const a = LIGHTING.daylight, b = LIGHTING.sunset, t = this.blend;
    const mixLight = (light, pa, pb) => {
      light.color.set(pa.color).lerp(_c.set(pb.color), t);
      light.intensity = pa.intensity + (pb.intensity - pa.intensity) * t;
      light.position.set(...pa.position).lerp(_v.set(...pb.position), t);
    };
    mixLight(this.key, a.key, b.key);
    mixLight(this.fill, a.fill, b.fill);
    mixLight(this.rim, a.rim, b.rim);
    this.hemi.color.set(a.hemi.sky).lerp(_c.set(b.hemi.sky), t);
    this.hemi.groundColor.set(a.hemi.ground).lerp(_c.set(b.hemi.ground), t);
    this.hemi.intensity = a.hemi.intensity + (b.hemi.intensity - a.hemi.intensity) * t;
    this.scene.environmentIntensity = a.env + (b.env - a.env) * t;
    this.renderer.toneMappingExposure = a.exposure + (b.exposure - a.exposure) * t;
    this.scene.fog.color.set(a.fog[this.background]).lerp(_c.set(b.fog[this.background]), t);
    this.transColor = _tc.set(a.trans.color).lerp(_c.set(b.trans.color), t);
    this.transStrength = a.trans.strength + (b.trans.strength - a.trans.strength) * t;
    this.sun.material.color.set(a.sun.color).lerp(_c.set(b.sun.color), t);
    this.sun.material.opacity = a.sun.opacity + (b.sun.opacity - a.sun.opacity) * t;
    this.sun.visible = this.sun.material.opacity > 0.01;
    this.sun.position.copy(this.key.position).normalize().multiplyScalar(2.9);
  }

  update(dt, wind, time) {
    if (Math.abs(this.blend - this.blendTarget) > 1e-4) {
      this.blend += (this.blendTarget - this.blend) * (1 - Math.exp(-dt * 3));
      if (Math.abs(this.blend - this.blendTarget) < 1e-3) this.blend = this.blendTarget;
      this.applyLighting(false);
    }
    this.grassUniforms.uTime.value = time;
    this.grassUniforms.uWind.value.copy(wind.force);

    const fx = wind.force.x, fz = wind.force.y;
    if (this.motes.visible) {
      const n = this.motes.geometry.drawRange.count;
      const P = this.motePositions;
      for (let i = 0; i < Math.min(n, this.motePhases.length); i++) {
        const o = i * 3, ph = this.motePhases[i];
        P[o] += (fx * 0.06 + Math.sin(time * 0.4 + ph) * 0.006) * dt;
        P[o + 1] += (Math.sin(time * 0.7 + ph * 1.3) * 0.008 + 0.002) * dt;
        P[o + 2] += (fz * 0.06 + Math.cos(time * 0.35 + ph) * 0.006) * dt;
        if (P[o] > 0.7) P[o] -= 1.4; else if (P[o] < -0.7) P[o] += 1.4;
        if (P[o + 2] > 0.5) P[o + 2] -= 1.1; else if (P[o + 2] < -0.6) P[o + 2] += 1.1;
        if (P[o + 1] > 0.85) P[o + 1] = 0.05;
      }
      this.motes.geometry.attributes.position.needsUpdate = true;
    }
    if (this.drift.visible) {
      for (let i = 0; i < this.drift.count; i++) {
        const d = this.driftState[i];
        d.p.x += (fx * 0.45 + 0.03 + Math.sin(time * 1.3 + d.phase) * 0.03) * dt;
        d.p.z += (fz * 0.45 + Math.cos(time * 1.1 + d.phase) * 0.03) * dt;
        d.p.y += (-d.fall + Math.sin(time * 2.1 + d.phase) * 0.02 + wind.gustLevel * 0.02) * dt;
        if (d.p.x > 1.3) d.p.x = -1.3; else if (d.p.x < -1.3) d.p.x = 1.3;
        if (d.p.z > 0.4) d.p.z = -0.8; else if (d.p.z < -0.8) d.p.z = 0.4;
        if (d.p.y < 0.02) d.p.y = 0.9;
        d.q.multiply(this._q.setFromAxisAngle(d.axis, d.spin * dt * (0.4 + wind.amplitude)));
        this.drift.setMatrixAt(i, this._m.compose(d.p, d.q, this._one));
      }
      this.drift.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.envTexture.dispose();
    this.backdropTexture.dispose();
    this.glowTexture.dispose();
    for (const t of this.groundTextures) t.dispose();
    for (const o of [this.backdrop, this.sun, this.ground, this.mound, this.grass, this.motes, this.drift]) {
      o.geometry?.dispose();
      o.material?.dispose();
    }
    this.grass.dispose();
    this.drift.dispose();
  }
}

const _c = new THREE.Color(), _tc = new THREE.Color();
const _v = new THREE.Vector3();
