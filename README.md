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
- **Pause breeze**: stop the plant and petal motion
- **Reset view**: restore the initial camera angle

## Project structure

```text
threejs-realistic-rose/
├── index.html
├── package.json
├── README.md
└── src/
    ├── main.js
    └── style.css
```

## Performance

The renderer caps pixel ratio at 2 and uses a lightweight procedural model. If performance is poor, change `Math.min(devicePixelRatio, 2)` to `Math.min(devicePixelRatio, 1.25)` and set the shadow map size to `1024`.

## Troubleshooting

- If the canvas is blank, update your GPU driver and enable hardware acceleration in the browser.
- If Google Fonts are unavailable, the page falls back to system fonts.
- Three.js and Vite are installed from npm, so the first install needs an internet connection.
