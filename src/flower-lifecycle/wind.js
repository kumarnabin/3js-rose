import * as THREE from 'three';
import { makeNoise1D } from './utils.js';

// Wind configuration and a smooth, gusting wind field. The plant reads `force` (x/z, world units)
// and `turbulence()`; its own springs give the delayed, damped response.

export const WIND_PRESETS = {
  calm: { label: 'Calm', strength: 0.12, gust: 0.1 },
  gentle: { label: 'Gentle breeze', strength: 0.4, gust: 0.35 },
  strong: { label: 'Strong breeze', strength: 0.85, gust: 0.75 },
};

export class WindSimulation {
  constructor() {
    this.enabled = true;
    this.strength = WIND_PRESETS.gentle.strength; // 0..1
    this.gust = WIND_PRESETS.gentle.gust; // 0..1
    this.directionDeg = 20; // 0 = towards screen right, 90 = towards the viewer
    this.time = 0;
    this.amplitude = 0; // eased strength: fades in/out instead of snapping
    this.gustLevel = 0;
    this.force = new THREE.Vector2();
    this.base = makeNoise1D(11);
    this.gusts = makeNoise1D(23);
    this.swirl = makeNoise1D(37);
    this.flutter = makeNoise1D(51);
  }

  applyPreset(name) {
    const preset = WIND_PRESETS[name];
    if (!preset) return;
    this.strength = preset.strength;
    this.gust = preset.gust;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const target = this.enabled ? this.strength : 0;
    this.amplitude += (target - this.amplitude) * (1 - Math.exp(-dt * 1.3));
    const steady = 0.78 + 0.22 * this.base(t * 0.31);
    const envelope = Math.max(0, this.gusts(t * 0.16) * 1.5 - 0.25); // occasional swells
    this.gustLevel = this.gust * envelope * envelope * 1.8;
    const speed = this.amplitude * (steady + this.gustLevel);
    const angle = THREE.MathUtils.degToRad(this.directionDeg) + this.swirl(t * 0.09) * (0.18 + this.gust * 0.3);
    this.force.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  // Fast, per-organ variation in [-1, 1]. Scaled by the caller.
  turbulence(phase, frequency) {
    return this.flutter(this.time * frequency + phase * 17.31);
  }

  get speed() {
    return this.force.length();
  }
}
