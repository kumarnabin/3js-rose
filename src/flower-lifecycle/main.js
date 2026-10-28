import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './flower-lifecycle.css';
import { computePose, LAST_STAGE, LifecycleController, STAGES } from './lifecycle.js';
import { WIND_PRESETS, WindSimulation } from './wind.js';
import { createLilyMaterials } from './lily/materials.js';
import { Lily } from './lily/Lily.js';
import { GardenEnvironment, LIGHTING, PARTICLE_MODES } from './environment.js';
import { BACKGROUNDS, PETAL_PALETTES } from './textures.js';
import { createControls } from './ui.js';

/*
  /flower-lifecycle — a procedural lily from bud to seed, in an adjustable breeze.
  URL options (handy for sharing a view or testing):
    ?stage=bud|opening|bloom|wilting|seeds  ?t=0..4  ?paused  ?still  ?wind=calm|gentle|strong
    ?light=daylight|sunset  ?bg=garden|mist|night  ?palette=stargazer|blush|magenta|coral
    ?particles=none|pollen|petals  ?quality=low|medium|high  ?speed=0.5..3
*/

const stageEl = document.getElementById('fl-stage');
const loading = document.querySelector('.fl-loading');
const params = new URLSearchParams(location.search);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR_CAP = { low: 1, medium: 1.5, high: 2 };
const QUALITY_ORDER = ['low', 'medium', 'high'];

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

function showFallback(reason) {
  document.getElementById('fl-app').classList.add('is-fallback');
  const box = document.getElementById('fallback');
  box.hidden = false;
  if (reason) document.getElementById('fallback-reason').textContent = reason;
  loading?.remove();
}

function initialQuality() {
  if (DPR_CAP[params.get('quality')]) return params.get('quality');
  const cores = navigator.hardwareConcurrency || 4;
  if (matchMedia('(pointer: coarse)').matches && innerWidth < 900) return cores >= 8 ? 'medium' : 'low';
  return cores >= 6 ? 'high' : 'medium';
}

if (!webglAvailable()) {
  showFallback('This page renders a real-time 3D lily and needs WebGL 2. Enable hardware acceleration or try a current version of Chrome, Edge, Firefox or Safari.');
} else {
  try {
    start();
  } catch (error) {
    console.error(error);
    showFallback(`The 3D scene could not start (${error.message}). Try enabling hardware acceleration or another browser.`);
  }
}

function start() {
  let quality = initialQuality();
  let qualityManual = params.has('quality');

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, DPR_CAP[quality]));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive 3D lily. Drag to orbit the camera, scroll or pinch to zoom.');
  stageEl.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 30);
  // home view: the whole plant, soil to flower tip; the distance is fitted to the free screen area in layout()
  const HOME_TARGET = new THREE.Vector3(0.03, 0.235, 0);
  const HOME_DIR = new THREE.Vector3(0.06, 0.1, 1).normalize();
  const PLANT_VIEW = { height: 0.54, width: 0.42 };
  const HOME_POS = HOME_TARGET.clone().addScaledVector(HOME_DIR, 1.2);
  let cameraAtHome = true;
  let cameraTween = null;
  camera.position.copy(HOME_POS);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 0.3;
  controls.maxDistance = 2.1;
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = 1.6;
  controls.target.copy(HOME_TARGET);
  controls.update();
  controls.addEventListener('start', () => { cameraAtHome = false; cameraTween = null; });

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const materials = createLilyMaterials({ anisotropy });
  const lily = new Lily(materials, { quality });
  scene.add(lily.object);
  const env = new GardenEnvironment(scene, renderer, { anisotropy, petalMap: materials.textures.petalMap });
  env.setQuality(quality);

  const wind = new WindSimulation();
  const lifecycle = new LifecycleController({ playing: !reducedMotion && !params.has('paused') });
  const look = { lighting: 'sunset', background: 'garden', palette: 'stargazer', particles: reducedMotion ? 'none' : 'pollen', variation: 0.35 };

  // ---------------------------------------------------------------- URL options
  if (reducedMotion || params.has('still')) wind.enabled = false;
  if (WIND_PRESETS[params.get('wind')]) wind.applyPreset(params.get('wind'));
  if (LIGHTING[params.get('light')]) look.lighting = params.get('light');
  if (BACKGROUNDS[params.get('bg')]) look.background = params.get('bg');
  if (PETAL_PALETTES[params.get('palette')]) look.palette = params.get('palette');
  if (PARTICLE_MODES[params.get('particles')]) look.particles = params.get('particles');
  const stageParam = params.get('stage');
  const stageIndex = STAGES.findIndex((s) => s.id === stageParam);
  if (stageIndex >= 0) lifecycle.scrub(stageIndex);
  else if (reducedMotion) lifecycle.scrub(2); // show the bloom rather than a still bud
  if (params.has('t')) lifecycle.scrub(Number(params.get('t')) || 0);
  if (Number(params.get('speed')) > 0) lifecycle.speed = Number(params.get('speed'));

  env.setLighting(look.lighting);
  env.applyLighting(true);
  env.setBackground(look.background);
  env.setParticles(look.particles);
  materials.setPalette(look.palette);

  // ---------------------------------------------------------------- framing
  // Centre the projection on the screen area left free by the timeline (and, on phones, the panel row),
  // and move the home camera back far enough for the whole plant to fit inside it.
  const timelineEl = document.querySelector('.fl-timeline');
  const sideEl = document.querySelector('.fl-side');
  const TAN_HALF_FOV = Math.tan(THREE.MathUtils.degToRad(15));
  function layout() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, DPR_CAP[quality]));
    renderer.setSize(w, h, false);
    const timelineH = timelineEl.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--fl-timeline-h', `${Math.round(timelineH)}px`); // panels stop above it
    const top = w <= 720 ? sideEl.getBoundingClientRect().bottom : 0;
    const bottom = Math.max(top + h * 0.35, h - timelineH * 0.88); // the timeline's faded top edge may overlap
    const freeH = bottom - top;
    const shift = h / 2 - (top + bottom) / 2;
    const fullH = h + 2 * Math.abs(shift);
    camera.aspect = w / fullH;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(TAN_HALF_FOV * (fullH / h)));
    camera.setViewOffset(w, fullH, 0, shift > 0 ? 2 * shift : 0, w, h);
    camera.updateProjectionMatrix();

    const distance = Math.max(PLANT_VIEW.height / (2 * TAN_HALF_FOV * (freeH / h)), PLANT_VIEW.width / (2 * TAN_HALF_FOV * (w / h)));
    HOME_POS.copy(HOME_TARGET).addScaledVector(HOME_DIR, distance);
    controls.maxDistance = Math.max(2.1, distance * 1.3);
    if (cameraAtHome && !cameraTween) {
      camera.position.copy(HOME_POS);
      controls.target.copy(HOME_TARGET);
    }
  }
  new ResizeObserver(layout).observe(stageEl);
  new ResizeObserver(layout).observe(timelineEl);
  layout();

  // ---------------------------------------------------------------- stage thumbnails rendered from the real scene
  const pose = computePose(lifecycle.t);
  const stillWind = { amplitude: 0, force: new THREE.Vector2(), gustLevel: 0, turbulence: () => 0 };
  const THUMB_WIDTH = 200; // about 2× the largest card thumbnail
  const thumbCamera = new THREE.PerspectiveCamera(30, 4 / 5, 0.01, 30);
  const THUMB_VIEW = new THREE.Vector3(0.12, 0.2, 1).normalize();
  const THUMB_HALF_WIDTH = 0.17; // leaves and fallen petals
  const thumbTarget = new THREE.Vector3();
  // match the rendered frame to the card's shape, so object-fit never crops the plant
  const thumbAspect = () => {
    const box = document.querySelector('.fl-thumb')?.getBoundingClientRect();
    return box?.width && box?.height ? box.width / box.height : 4 / 5;
  };
  let renderedThumbAspect = 0;
  function renderThumbnails() {
    const motes = env.motes.visible, drift = env.drift.visible;
    env.motes.visible = env.drift.visible = false;
    const aspect = thumbAspect();
    renderedThumbAspect = aspect;
    thumbCamera.aspect = aspect;
    thumbCamera.updateProjectionMatrix();
    renderer.setPixelRatio(1);
    renderer.setSize(THUMB_WIDTH, Math.round(THUMB_WIDTH / aspect), false);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(thumbCamera.fov / 2));
    const urls = STAGES.map((_, i) => {
      lily.update(computePose(i, {}), stillWind, 0);
      // frame the whole plant, from the soil to the top of the flower head
      const head = lily.headPosition;
      const top = head.y + 0.075, bottom = -0.015;
      const halfHeight = ((top - bottom) / 2) * 1.1;
      const distance = Math.max(halfHeight / tanHalf, THUMB_HALF_WIDTH / (tanHalf * aspect));
      thumbTarget.set(head.x * 0.5, (top + bottom) / 2, head.z * 0.5);
      thumbCamera.position.copy(thumbTarget).addScaledVector(THUMB_VIEW, distance);
      thumbCamera.lookAt(thumbTarget);
      renderer.render(scene, thumbCamera);
      return canvas.toDataURL('image/webp', 0.82);
    });
    env.motes.visible = motes;
    env.drift.visible = drift;
    layout();
    lily.update(computePose(lifecycle.t, pose), wind, 0);
    renderer.render(scene, camera);
    return urls;
  }
  let thumbTimer = 0;
  const refreshThumbnails = () => {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(() => ui.setThumbnails(renderThumbnails()), 450);
  };
  // cards switch between 4:3 and 16:9 with the viewport; re-render when the shape changes
  new ResizeObserver(() => {
    if (renderedThumbAspect && Math.abs(thumbAspect() - renderedThumbAspect) > 0.05) refreshThumbnails();
  }).observe(timelineEl);

  // ---------------------------------------------------------------- camera reset
  function resetCamera() {
    if (reducedMotion) {
      camera.position.copy(HOME_POS);
      controls.target.copy(HOME_TARGET);
      controls.update();
      cameraAtHome = true;
      return;
    }
    cameraTween = { pos: camera.position.clone(), target: controls.target.clone(), t: 0 };
  }

  // ---------------------------------------------------------------- restart / loop with a short fade
  let fading = false;
  function fadeRestart() {
    if (fading) return;
    fading = true;
    stageEl.classList.add('is-fading');
    setTimeout(() => {
      lifecycle.restart();
      stageEl.classList.remove('is-fading');
      fading = false;
      ui.syncPlay();
    }, reducedMotion ? 0 : 380);
  }
  lifecycle.onLoop = fadeRestart;

  function setQuality(next, { manual = false, note = '' } = {}) {
    if (!DPR_CAP[next]) return;
    if (manual) qualityManual = true;
    quality = next;
    lily.setQuality(next);
    env.setQuality(next);
    layout();
    ui.setQuality(next, note);
  }

  const ui = createControls({
    lifecycle,
    wind,
    reducedMotion,
    actions: {
      goToStage: (i) => lifecycle.goToStage(i, { reducedMotion }),
      step: (d) => {
        const from = lifecycle.tween ? lifecycle.tween.to : lifecycle.stage;
        lifecycle.goToStage(Math.min(LAST_STAGE, Math.max(0, Math.round(from) + d)), { reducedMotion });
      },
      togglePlay: () => {
        if (!lifecycle.playing && lifecycle.playhead >= lifecycle.total) fadeRestart();
        else lifecycle.playing = !lifecycle.playing;
      },
      restart: fadeRestart,
      scrub: (t) => lifecycle.scrub(t),
      setLighting: (name) => { look.lighting = name; env.setLighting(name); refreshThumbnails(); },
      setBackground: (name) => { look.background = name; env.setBackground(name); refreshThumbnails(); },
      setPalette: (name) => { look.palette = name; materials.setPalette(name); refreshThumbnails(); },
      setVariation: (v) => { look.variation = v; lily.setPetalVariation(v); },
      setParticles: (mode) => { look.particles = mode; env.setParticles(mode); },
      setQuality: (q, opts) => setQuality(q, opts),
      resetCamera,
    },
  });
  ui.setLook(look);
  ui.setQuality(quality, qualityManual ? '' : '(auto)');
  ui.syncWind();
  if (params.get('speed')) document.getElementById('speed').value = String(lifecycle.speed);

  // ---------------------------------------------------------------- loop
  const clock = new THREE.Clock();
  const keyDir = new THREE.Vector3();
  let elapsed = 0, lastT = -1;
  let perfTime = 0, perfFrames = 0, perfWarmup = 3;

  function frame() {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    elapsed += dt;
    lifecycle.update(dt);
    wind.update(dt);
    computePose(lifecycle.t, pose);
    // skip rebuilding the plant when nothing can have moved
    if (lifecycle.t !== lastT || wind.amplitude > 1e-4 || !lily.isSettled()) lily.update(pose, wind, dt);
    lastT = lifecycle.t;
    env.update(dt, wind, elapsed);

    if (cameraTween) {
      cameraTween.t = Math.min(1, cameraTween.t + dt / 0.9);
      const e = 1 - Math.pow(1 - cameraTween.t, 3);
      camera.position.lerpVectors(cameraTween.pos, HOME_POS, e);
      controls.target.lerpVectors(cameraTween.target, HOME_TARGET, e);
      if (cameraTween.t >= 1) { cameraTween = null; cameraAtHome = true; }
    }
    controls.update();
    camera.updateMatrixWorld();
    keyDir.copy(env.key.position).sub(env.key.target.position).normalize().transformDirection(camera.matrixWorldInverse);
    materials.uniforms.uKeyDirView.value.copy(keyDir);
    materials.uniforms.uTransColor.value.copy(env.transColor);
    materials.uniforms.uTransStrength.value = env.transStrength;
    materials.leafUniforms.uTransStrength.value = env.transStrength * 0.4;

    renderer.render(scene, camera);
    ui.frame();

    // adaptive quality: step down once if frames are consistently slow (never overrides a manual choice)
    if (!qualityManual && quality !== 'low') {
      if (perfWarmup > 0) perfWarmup -= dt;
      else {
        perfTime += dt; perfFrames++;
        if (perfTime > 3) {
          if (perfTime / perfFrames > 1 / 28) setQuality(QUALITY_ORDER[QUALITY_ORDER.indexOf(quality) - 1], { note: '(lowered automatically)' });
          perfTime = 0; perfFrames = 0;
        }
      }
    }
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    renderer.setAnimationLoop(null);
    showFallback('The graphics context was lost (the GPU may have been reset). Reload the page to restore the scene.');
  });

  if (import.meta.env.DEV) window.__lily = { lifecycle, wind, lily, env, renderer, ui }; // dev-only hook for browser tests

  ui.setThumbnails(renderThumbnails());
  ui.frame();
  renderer.setAnimationLoop(frame);
  requestAnimationFrame(() => {
    loading.classList.add('is-done');
    setTimeout(() => loading.remove(), 900);
  });

  addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    controls.dispose();
    lily.dispose();
    env.dispose();
    materials.dispose();
    renderer.dispose();
  }, { once: true });
}
