# Three.js — A Rose, in the Breeze

A complete Vite + Three.js scene that builds a botanically structured procedural rose directly in code. No external 3D model is required.

## What makes it look like a real rose

- **Golden-angle phyllotaxis** — 44 petals placed 137.5° apart, spiralling from a tight centre outward, exactly how a real bloom is organised.
- **Three petal zones** — inner petals wrap tightly (convolute bud), middle petals are cupped and lean inward, outer petals open wide with the rim rolled back and rippled.
- **Real petal shape** — narrow claw at the base, broad rounded tip with a small notch, cross-section wrap, lengthwise bend, hand-painted vein texture + bump map.
- **Baked ambient occlusion** in vertex colours (deep inside the bloom is darker), plus real shadow-casting between petals.
- **Calyx and hip** — swollen receptacle with five reflexed, tapering sepals (two fringed, as on real roses).
- **Petal realism** — irregular hand-made outlines (no two petals alike), lopsided heart-shaped notch, layered edge ripples, rolled rims, and a paler, satin outer face versus the velvety inner face.
- **Leaf realism** — ovate leaflets with drawn-out tips, forward-pointing serrations, curved lateral veins, glossy upper side and a paler matte underside, 7 leaflets on lower leaves and 5 higher up.
- **Stem and foliage** — tapered, colour-graded stem; hooked, flattened prickles; compound leaves with five serrated, veined leaflets, rachis and stipules; younger leaves bronze-tinted; 2/5 leaf arrangement.
- **Dew droplets** — transmissive glass drops on the upper petals.
- **Image-based lighting** (RoomEnvironment) plus key, rim and fill lights.

The model is still procedural, not a scan. For absolute photorealism, swap in a GLB scan and keep the scene, lighting and animation.

## Requirements

- Node.js 20.19+ or 22.12+
- A modern browser with WebGL enabled

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

The production output is generated in `dist/`.

## Camera presets

Append `?view=top`, `?view=side`, `?view=close` or `?view=full` to the URL (add `&still` to pause the breeze).

## Tuning the bloom

All in `src/main.js`: `PETALS` (count), `phi` (how open each petal is), `wrap` / `bendTotal` / `roll` in `createPetal` (cupping, curl, rolled rim), and the `petalMap` gradient stops for colour. Change the seed in `mulberry32(...)` for a different but still repeatable rose.

## Controls

- Drag: orbit around the flower
- Mouse wheel / trackpad: zoom
- **Replay lifecycle**: start again from the seedling
- **Pause lifecycle**: hold the current stage
- **Pause breeze**: the wind eases out and the plant settles
- **Reset view**: glide back to the initial camera angle

The breeze is a smooth, gusting wind field (shared with the lily page). The stem bends from the soil like a real stem rather than rotating as a block, and the head and each leaf respond through their own damped springs. When the bloom is over, petals peel away from the outside in, drift downwind and settle on the soil and ground. Then the scene fades and the cycle restarts. Visitors who prefer reduced motion see a still, open bloom, and the buttons let them start the motion.

## Lily lifecycle page (`/flower-lifecycle`)

A second study: a procedural pink lily that moves through five stages (bud, opening, bloom, wilting, seeds) in an adjustable breeze. Open `http://localhost:5173/flower-lifecycle` (or follow the link on the rose page).

- **Lifecycle**: stage cards, play/pause, previous/next, restart, speed (0.5×–3×), loop, and a scrubbable timeline. Every pose is a pure function of one value `t` (0–4), so stages can be visited in any order. The seed stage shows the ovary swelling into a three-valved capsule that dries, splits and sheds flat papery seeds.
- **Wind**: on/off, Calm / Gentle / Strong presets, intensity, gusts and direction. The stem bends from its anchored base, and leaves and petals respond through their own damped springs with tip flutter.
- **Appearance**: daylight or warm sunset lighting, three backdrops, four petal palettes, petal colour variation, optional pollen motes or drifting petals, and Low / Medium / High quality (the default is picked from the device and stepped down automatically if frames stay slow).
- **Keyboard**: Space plays/pauses, ←/→ change stage. Reduced-motion users start on a still bloom with the wind off. A message replaces the scene if WebGL 2 is unavailable.
- **URL options**: `?stage=bud|opening|bloom|wilting|seeds`, `?t=0..4`, `?paused`, `?still`, `?wind=calm|gentle|strong`, `?light=daylight|sunset`, `?bg=garden|mist|night`, `?palette=stargazer|blush|magenta|coral`, `?particles=none|pollen|petals`, `?quality=low|medium|high`, `?speed=0.5..3`.

The page is a second Vite entry (`flower-lifecycle/index.html`, registered in `vite.config.js`), and its code lives in `src/flower-lifecycle/`. When deploying `dist/`, serve `flower-lifecycle/index.html` for `/flower-lifecycle`. Most static hosts do this by redirecting to the trailing-slash URL, and `vite.config.js` does the same for `npm run dev` and `npm run preview`.

## Project structure

```text
threejs-realistic-rose/
├── index.html                      # rose study (/)
├── flower-lifecycle/index.html     # lily lifecycle (/flower-lifecycle/)
├── vite.config.js                  # registers both pages
├── package.json
├── README.md
└── src/
    ├── main.js                     # rose
    ├── style.css
    └── flower-lifecycle/
        ├── main.js                 # page bootstrap: renderer, camera, loop, thumbnails
        ├── lifecycle.js            # stages, computePose(t), playback controller
        ├── wind.js                 # wind presets and gusting wind field
        ├── environment.js          # lighting presets, backdrop, ground, grass, particles
        ├── textures.js             # procedural canvas textures and palettes
        ├── ui.js                   # control panels and timeline bindings
        ├── utils.js                # seeded random, easing, noise, springs
        ├── flower-lifecycle.css
        └── lily/
            ├── Lily.js             # stem spine, leaves, tepals, stamens, capsule, seeds
            ├── geometry.js         # deformable grid and tube geometry
            └── materials.js        # shared materials with lifecycle colour shaders
```

## Performance

The renderer caps pixel ratio at 2 and uses a lightweight procedural model. If performance is poor, change `Math.min(devicePixelRatio, 2)` to `Math.min(devicePixelRatio, 1.25)` and set the shadow map size to `1024`.

## Troubleshooting

- If the canvas is blank, update your GPU driver and enable hardware acceleration in the browser.
- If Google Fonts are unavailable, the page falls back to system fonts.
- Three.js and Vite are installed from npm, so the first install needs an internet connection.
