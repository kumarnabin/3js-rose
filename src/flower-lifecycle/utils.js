// Small shared helpers for the lily lifecycle page (same conventions as src/main.js).

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// Smooth 1D gradient noise in roughly [-1, 1]; deterministic for a given seed.
export function makeNoise1D(seed) {
  const grad = (i) => {
    let h = Math.imul(i ^ seed, 0x27d4eb2d);
    h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
    return ((h >>> 0) / 4294967295) * 2 - 1;
  };
  return (x) => {
    const i = Math.floor(x), f = x - i;
    const u = f * f * (3 - 2 * f);
    return lerp(grad(i) * f, grad(i + 1) * (f - 1), u) * 2;
  };
}

// Damped spring integrated in fixed 1/120 s sub-steps, so motion is identical at any frame rate.
export class Spring {
  constructor(stiffness, damping) {
    this.k = stiffness;
    this.c = damping;
    this.x = 0;
    this.v = 0;
  }
  step(target, dt) {
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(1 / 120, left);
      this.v += (this.k * (target - this.x) - this.c * this.v) * h;
      this.x += this.v * h;
      left -= h;
    }
    return this.x;
  }
  get resting() {
    return Math.abs(this.v) < 1e-4;
  }
}
