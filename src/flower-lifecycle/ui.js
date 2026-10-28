import { LAST_STAGE, STAGES } from './lifecycle.js';
import { WIND_PRESETS } from './wind.js';
import { LIGHTING } from './environment.js';
import { BACKGROUNDS } from './textures.js';

// DOM bindings for the control panels and the lifecycle timeline. Per-frame work is limited to
// the progress bar and the active-stage marker, written only when they change.

const $ = (id) => document.getElementById(id);

export function createControls({ lifecycle, wind, actions, reducedMotion }) {
  const announcer = $('announcer');
  const stagesList = $('stages');
  const scrub = $('scrub');
  const play = $('play');

  // ---------------------------------------------------------------- stage cards
  const cards = STAGES.map((stage, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <button type="button" class="fl-stage-card" aria-pressed="false" data-stage="${i}">
        <span class="fl-thumb"><img alt="" width="200" height="250" decoding="async" hidden /></span>
        <span class="fl-stage-head"><span class="fl-stage-num" aria-hidden="true">${i + 1}</span><span class="fl-stage-name">${stage.name}</span></span>
        <span class="fl-stage-desc">${stage.description}</span>
        <span class="fl-stage-bar" aria-hidden="true"><span></span></span>
      </button>`;
    const button = li.querySelector('button');
    button.setAttribute('aria-label', `Stage ${i + 1} of ${STAGES.length}: ${stage.name}`);
    button.addEventListener('click', () => actions.goToStage(i));
    stagesList.append(li);
    return { button, img: li.querySelector('img'), bar: li.querySelector('.fl-stage-bar > span') };
  });

  // ---------------------------------------------------------------- transport
  const syncPlay = () => {
    const playing = lifecycle.playing && !lifecycle.waitingForLoop;
    play.setAttribute('aria-pressed', String(lifecycle.playing));
    play.setAttribute('aria-label', lifecycle.playing ? 'Pause' : 'Play');
    play.classList.toggle('is-paused', !lifecycle.playing);
    return playing;
  };
  play.addEventListener('click', () => { actions.togglePlay(); syncPlay(); });
  $('prev-stage').addEventListener('click', () => actions.step(-1));
  $('next-stage').addEventListener('click', () => actions.step(1));
  $('restart').addEventListener('click', () => { actions.restart(); syncPlay(); });
  $('speed').addEventListener('change', (e) => { lifecycle.speed = Number(e.target.value); });
  const loop = $('loop');
  loop.addEventListener('click', () => {
    lifecycle.loop = !lifecycle.loop;
    loop.setAttribute('aria-pressed', String(lifecycle.loop));
  });
  scrub.addEventListener('input', () => {
    lifecycle.playing = false;
    syncPlay();
    actions.scrub((Number(scrub.value) / 1000) * LAST_STAGE);
  });

  // ---------------------------------------------------------------- wind
  const windPanel = $('wind-panel');
  const windToggle = $('wind-toggle');
  const strength = $('wind-strength'), gust = $('wind-gust'), direction = $('wind-direction');
  const arrow = $('wind-arrow');
  const describeDirection = (deg) => {
    const names = ['right', 'right and towards you', 'towards you', 'left and towards you', 'left', 'left and away', 'away from you', 'right and away'];
    return names[Math.round(deg / 45) % 8];
  };
  const syncWind = () => {
    windToggle.setAttribute('aria-checked', String(wind.enabled));
    strength.value = Math.round(wind.strength * 100);
    gust.value = Math.round(wind.gust * 100);
    direction.value = Math.round(wind.directionDeg);
    $('wind-strength-out').value = `${strength.value}%`;
    $('wind-gust-out').value = `${gust.value}%`;
    $('wind-direction-out').value = `${direction.value}°`;
    direction.setAttribute('aria-valuetext', `${direction.value} degrees, blowing ${describeDirection(wind.directionDeg)}`);
    arrow.setAttribute('transform', `rotate(${wind.directionDeg} 20 20)`);
    const preset = Object.entries(WIND_PRESETS).find(([, p]) => Math.abs(p.strength - wind.strength) < 0.005 && Math.abs(p.gust - wind.gust) < 0.005);
    for (const input of document.querySelectorAll('input[name="wind-preset"]')) input.checked = preset?.[0] === input.value;
    $('wind-summary').textContent = wind.enabled ? `${preset ? preset[1].label : 'Custom'} · ${strength.value}%` : 'Still air';
    windPanel.classList.toggle('is-off', !wind.enabled);
  };
  windToggle.addEventListener('click', () => { wind.enabled = !wind.enabled; syncWind(); });
  for (const input of document.querySelectorAll('input[name="wind-preset"]')) {
    input.addEventListener('change', () => { wind.applyPreset(input.value); wind.enabled = true; syncWind(); });
  }
  strength.addEventListener('input', () => { wind.strength = strength.value / 100; syncWind(); });
  gust.addEventListener('input', () => { wind.gust = gust.value / 100; syncWind(); });
  direction.addEventListener('input', () => { wind.directionDeg = Number(direction.value); syncWind(); });

  // ---------------------------------------------------------------- appearance
  const syncLook = (state) => {
    $('look-summary').textContent = `${LIGHTING[state.lighting].label} · ${BACKGROUNDS[state.background].label}`;
  };
  const look = { lighting: 'sunset', background: 'garden' };
  for (const input of document.querySelectorAll('input[name="lighting"]')) {
    input.addEventListener('change', () => { look.lighting = input.value; actions.setLighting(input.value); syncLook(look); });
  }
  $('background').addEventListener('change', (e) => { look.background = e.target.value; actions.setBackground(e.target.value); syncLook(look); });
  $('palette').addEventListener('change', (e) => actions.setPalette(e.target.value));
  const variation = $('variation');
  variation.addEventListener('input', () => {
    $('variation-out').value = `${variation.value}%`;
    actions.setVariation(variation.value / 100);
  });
  $('particles').addEventListener('change', (e) => actions.setParticles(e.target.value));
  for (const input of document.querySelectorAll('input[name="quality"]')) {
    input.addEventListener('change', () => { $('quality-note').textContent = ''; actions.setQuality(input.value, { manual: true }); });
  }
  $('reset-camera').addEventListener('click', () => actions.resetCamera());

  // ---------------------------------------------------------------- keyboard shortcuts
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return; // the control owns the keys
    if (e.key === ' ' && (tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'A')) return; // native activation
    if (e.key === ' ') { e.preventDefault(); actions.togglePlay(); syncPlay(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); actions.step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); actions.step(-1); }
  });

  // below desktop widths the panels start collapsed so the flower stays visible
  if (matchMedia('(max-width: 1100px)').matches) windPanel.open = false;
  if (reducedMotion) $('motion-note').hidden = false;

  // ---------------------------------------------------------------- per-frame sync (cheap)
  let lastStage = -1, lastScrub = -1, lastPlaying = null;
  const frame = () => {
    const t = lifecycle.t;
    const stage = lifecycle.stage;
    const v = Math.round((t / LAST_STAGE) * 1000);
    if (v !== lastScrub && document.activeElement !== scrub) {
      scrub.value = v;
      scrub.setAttribute('aria-valuetext', `${STAGES[stage].name}, ${Math.round((t / LAST_STAGE) * 100)}% through the lifecycle`);
      lastScrub = v;
      for (let i = 0; i < cards.length; i++) {
        const fill = Math.max(0, Math.min(1, 1 - Math.abs(t - i)));
        cards[i].bar.style.transform = `scaleX(${fill.toFixed(3)})`;
      }
    }
    if (stage !== lastStage) {
      cards.forEach((c, i) => {
        c.button.setAttribute('aria-pressed', String(i === stage));
        c.button.classList.toggle('is-active', i === stage);
      });
      if (lastStage !== -1) announcer.textContent = `Stage ${stage + 1} of ${STAGES.length}: ${STAGES[stage].name}`;
      lastStage = stage;
    }
    if (lifecycle.playing !== lastPlaying) { syncPlay(); lastPlaying = lifecycle.playing; }
  };

  syncWind();
  syncLook(look);

  return {
    frame,
    syncWind,
    setThumbnails(urls) {
      urls.forEach((url, i) => {
        if (!url) return;
        cards[i].img.src = url;
        cards[i].img.hidden = false;
      });
    },
    setQuality(quality, note = '') {
      for (const input of document.querySelectorAll('input[name="quality"]')) input.checked = input.value === quality;
      $('quality-note').textContent = note;
    },
    setLook({ lighting, background, palette, particles, variation: v }) {
      if (lighting) { look.lighting = lighting; for (const i of document.querySelectorAll('input[name="lighting"]')) i.checked = i.value === lighting; }
      if (background) { look.background = background; $('background').value = background; }
      if (palette) $('palette').value = palette;
      if (particles) $('particles').value = particles;
      if (v !== undefined) { variation.value = Math.round(v * 100); $('variation-out').value = `${variation.value}%`; }
      syncLook(look);
    },
    syncPlay,
  };
}
