import { clamp01, easeInOutCubic, lerp, smoothstep } from './utils.js';

/*
  The lifecycle is a single continuous value t in [0, 4]:
    0 = bud, 1 = opening, 2 = bloom, 3 = wilting, 4 = seeds.
  Every visual parameter is a pure function of t (computePose), so any stage can be reached
  from any other in either direction without accumulating state in the geometry.
*/

export const STAGES = [
  { id: 'bud', name: 'Bud', description: 'A closed, green-blushed bud swells at the top of the stem.' },
  { id: 'opening', name: 'Opening', description: 'The six tepals part and unfold, one layer after the other.' },
  { id: 'bloom', name: 'Bloom', description: 'Full bloom: reflexed petals, a spotted throat and pollen-laden anthers.' },
  { id: 'wilting', name: 'Wilting', description: 'Colour fades, petals droop and curl, the leaves begin to tire.' },
  { id: 'seeds', name: 'Seeds', description: 'The ovary swells into a three-part capsule that dries and splits to shed flat, papery seeds.' },
];
export const LAST_STAGE = STAGES.length - 1;

const HOLD = 2.8; // seconds resting on each stage
const MOVE = [4.5, 4.5, 6, 11]; // seconds for each transition (the seed stage has the most to show)

// Ease between integer keyframes: values[i] at t = i.
function keys(values, t) {
  const i = Math.min(values.length - 2, Math.max(0, Math.floor(t)));
  const f = clamp01(t - i);
  return lerp(values[i], values[i + 1], f * f * (3 - 2 * f));
}

export function computePose(t, out = {}) {
  t = Math.min(LAST_STAGE, Math.max(0, t));
  out.t = t;
  out.growth = lerp(0.8, 1, smoothstep(0, 2, t));
  out.open = smoothstep(0.05, 2, t);
  out.petalSize = lerp(0.74, 1, smoothstep(0, 2, t)) * (1 - 0.07 * smoothstep(2.5, 3.4, t));
  out.budTint = 1 - smoothstep(0.25, 1.7, t);
  out.droop = smoothstep(2.2, 3.05, t);
  out.curl = smoothstep(2.4, 3.3, t);
  out.fade = smoothstep(2.2, 3.1, t);
  out.fall = smoothstep(3.02, 3.5, t);
  out.stamenExtend = smoothstep(0.6, 1.9, t);
  out.stamenWither = smoothstep(2.3, 3.15, t);
  out.stamenFall = smoothstep(2.75, 3.2, t);
  out.styleWither = smoothstep(2.9, 3.5, t);
  out.capsuleGrow = smoothstep(3.1, 3.5, t);
  out.capsuleDry = smoothstep(3.45, 3.7, t);
  out.capsuleSplit = smoothstep(3.66, 3.82, t);
  out.seedRelease = smoothstep(3.78, 4, t);
  out.leafDroop = smoothstep(2.3, 3.2, t) * (1 - 0.25 * smoothstep(3.5, 4, t));
  out.leafAge = smoothstep(2.4, 3.9, t);
  out.headTilt = t < 3 ? keys([0.16, 0.6, 1.0, 1.95], t) : lerp(1.95, 0.14, smoothstep(3.1, 3.55, t)); // wilting nods down
  out.stemDroop = smoothstep(2.3, 3.0, t) * (1 - smoothstep(3.1, 3.6, t));
  return out;
}

export class LifecycleController {
  constructor({ speed = 1, loop = true, playing = true } = {}) {
    this.speed = speed;
    this.loop = loop;
    this.playing = playing;
    this.segments = [];
    let start = 0;
    for (let i = 0; i <= LAST_STAGE; i++) {
      this.segments.push({ type: 'hold', stage: i, start, duration: HOLD });
      start += HOLD;
      if (i < LAST_STAGE) {
        this.segments.push({ type: 'move', from: i, start, duration: MOVE[i] });
        start += MOVE[i];
      }
    }
    this.total = start;
    this.playhead = 0;
    this.t = 0;
    this.tween = null;
    this.waitingForLoop = false;
    this.onLoop = null; // set by the page: fade, then call restart()
  }

  get stage() {
    return Math.min(LAST_STAGE, Math.max(0, Math.round(this.t)));
  }

  tAt(playhead) {
    for (const seg of this.segments) {
      if (playhead < seg.start + seg.duration) {
        return seg.type === 'hold' ? seg.stage : seg.from + clamp01((playhead - seg.start) / seg.duration);
      }
    }
    return LAST_STAGE;
  }

  playheadAt(t) {
    const i = Math.floor(t);
    const f = t - i;
    if (f < 1e-6 || i >= LAST_STAGE) return this.segments.find((s) => s.type === 'hold' && s.stage === Math.min(i, LAST_STAGE)).start;
    const move = this.segments.find((s) => s.type === 'move' && s.from === i);
    return move.start + f * move.duration;
  }

  update(dt) {
    if (this.tween) {
      const tw = this.tween;
      tw.elapsed += dt;
      const f = tw.duration > 0 ? clamp01(tw.elapsed / tw.duration) : 1;
      this.t = lerp(tw.from, tw.to, easeInOutCubic(f));
      if (f >= 1) {
        this.t = tw.to;
        this.playhead = this.playheadAt(tw.to);
        this.tween = null;
      }
      return;
    }
    if (!this.playing || this.waitingForLoop) return;
    this.playhead += dt * this.speed;
    if (this.playhead >= this.total) {
      this.playhead = this.total;
      if (this.loop && this.onLoop) {
        this.waitingForLoop = true;
        this.onLoop();
      } else {
        this.playing = false;
      }
    }
    this.t = this.tAt(this.playhead);
  }

  // Animate to a stage. Distance-based duration; reduced motion makes it near-instant.
  goToStage(index, { reducedMotion = false } = {}) {
    const to = Math.min(LAST_STAGE, Math.max(0, index));
    const distance = Math.abs(to - this.t);
    if (distance < 1e-4) return;
    this.waitingForLoop = false;
    this.tween = { from: this.t, to, elapsed: 0, duration: reducedMotion ? 0.15 : Math.min(3.6, 0.7 + distance * 0.9) / Math.max(0.5, this.speed) };
  }

  scrub(t) {
    this.tween = null;
    this.waitingForLoop = false;
    this.t = Math.min(LAST_STAGE, Math.max(0, t));
    this.playhead = this.playheadAt(this.t);
  }

  restart() {
    this.tween = null;
    this.waitingForLoop = false;
    this.playhead = 0;
    this.t = 0;
    this.playing = true;
  }
}
