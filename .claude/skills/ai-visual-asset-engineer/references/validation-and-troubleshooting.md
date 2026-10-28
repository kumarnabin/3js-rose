# Validation and Troubleshooting

## Contents

1. What to validate, per asset type
2. Validation commands
3. Visual review (look at the result)
4. Report template
5. Troubleshooting: generation
6. Troubleshooting: transparency and edges
7. Troubleshooting: conversion and tools
8. Troubleshooting: SVG
9. Troubleshooting: React / bundler integration

---

## 1. What to validate, per asset type

| Check | Raster (PNG/WebP/AVIF/JPEG) | Cutout (alpha) | SVG | React component |
|---|---|---|---|---|
| File exists at the reported path | ✅ | ✅ | ✅ | ✅ |
| Real format matches extension (magic bytes) | ✅ | ✅ | ✅ | — |
| Dimensions match the plan (≥ required, ≤ budget) | ✅ | ✅ | viewBox | — |
| Alpha channel present **and** really used (transparent pixels, transparent corners) | — | ✅ | — | — |
| File size within budget | ✅ | ✅ | ✅ | — |
| Well-formed XML, xmlns, viewBox, no duplicate/undefined ids, no embedded raster | — | — | ✅ | ✅ (markup) |
| Accessible name or `aria-hidden` | alt in code | alt in code | ✅ | ✅ |
| Renders in a browser (no load error, no console errors) | ✅ | ✅ on light + dark | ✅ | ✅ in the page |
| Typecheck / build pass | — | — | — | ✅ |
| Looked at visually | ✅ | ✅ (edges/halo) | ✅ | ✅ |

## 2. Validation commands

```bash
# Format, dimensions, alpha, size budgets (any mix of files)
node <skill-dir>/scripts/verify-asset.mjs public/assets/hero-*.webp --expect-format webp --min-width 640 --max-bytes 350000
node <skill-dir>/scripts/verify-asset.mjs src/assets/mug-cutout.png --expect-alpha
node <skill-dir>/scripts/verify-asset.mjs src/assets/icons/*.svg
node <skill-dir>/scripts/verify-asset.mjs public/assets/x.png --json       # machine-readable

# Browser rendering + contact sheet (light / dark / checkerboard)
node <skill-dir>/scripts/render-preview.mjs src/assets/mug-cutout.webp src/assets/icons/upload.svg --out asset-preview.png

# Project checks after integration (use the project's scripts)
npm run typecheck   # or: npx tsc --noEmit
npm run build
```

What `verify-asset.mjs` checks:

- **Raster:** reads headers itself for PNG, WebP, JPEG, GIF and AVIF.
- **Pixel-level alpha:** decoded for 8-bit, non-interlaced PNGs (gray+alpha and RGBA). For other inputs only the alpha flag is reported; for a pixel-level check, convert to PNG first, or use sharp (`.stats()` / `.raw()`) or ImageMagick (`magick identify -format "%[opaque]" f`).
- **SVG:** runs XML and accessibility heuristics. It's not a full SVG schema validator. For complete certainty, render it (`render-preview.mjs`) and open it in a browser.

Exit codes: `0` passes, `1` failed checks, `2` bad usage. `render-preview.mjs` returns `3` when Playwright isn't available. Report that as "browser rendering not verified".

## 3. Visual review (look at the result)

Automated checks don't judge quality. After rendering, open the screenshot (agents that can read images should view it) and check:

- Subject, composition and crop match the prompt and the layout slot. Text space is where it was planned.
- No artefacts: extra fingers, warped text, melted geometry, duplicated objects, watermark-like marks.
- Cutouts: no halo on dark **and** light backgrounds, hair and fine edges intact, no leftover background patches.
- Compression: no banding in gradients, no ringing around edges at 100% zoom.
- SVG: crisp at the smallest and largest intended sizes, strokes aligned, colours correct in light and dark themes.
- Consistency: variants in a set share the same style, lighting and palette.

If it's not good enough, refine the prompt or the asset and regenerate (with approval for paid calls). Don't ship it with a note saying it "should look fine".

## 4. Report template

```markdown
## Assets
| File | Format (actual) | Size | Dimensions | Alpha | Source |
|---|---|---|---|---|---|
| public/assets/hero-coffee-v1.png | PNG | 2.1 MB | 1536×1024 | no | OpenAI gpt-image-2 (prompt in .asset.json) |
| public/assets/hero-coffee-1280w.webp | WebP | 142 KB | 1280×853 | no | converted (sharp, q82) |

## Steps
1. Generated with … (dry-run approved by user, then --confirm) / Authored SVG by hand / Converted user-supplied file
2. Converted: `node …/convert-image.mjs … --widths 640,1280,1920` (engine: sharp 0.35)
3. Integrated: src/pages/home/hero.tsx now uses <ResponsiveImage …> (old: /hero.jpg)

## Verification
- verify-asset: PASS ×4 (output summary)
- render-preview: rendered OK; screenshot reviewed. Edges clean on dark/light.
- npm run build: success
- Not verified: <anything skipped and why, e.g. "Playwright not installed: browser rendering unchecked">

## Notes
- Existing files untouched; new versions used -v2 suffix where names collided
- Licence/watermark notes (e.g. Gemini SynthID)
```

## 5. Troubleshooting: generation

| Symptom | Likely cause | Fix |
|---|---|---|
| `model not found` / 404 | Model id renamed, retired, or not enabled for this key | `generate-image.mjs --provider X --list-models`, then pass `--model` |
| OpenAI 400 on `size` | Unsupported size for that model | Use `1024x1024`, `1536x1024`, `1024x1536` or `auto`, or a custom size that meets the model's rules (multiples of 16, ratio ≤ 3:1); resize locally afterwards |
| OpenAI 400 on `background` / `input_fidelity` | Parameter unsupported by the chosen model | Drop the parameter or choose a model that supports it; for transparency fall back to chroma-key + removal |
| 401 / 403 | Key missing, wrong env var, no billing, org not verified | `detect-environment.mjs` shows which variables are set; check the provider console |
| 429 | Rate limit or quota | Wait and retry later; reduce `n`; don't loop retries automatically |
| Gemini returns text only, no image | Prompt read as a question, safety block, or model without image output | Start the prompt with "Generate an image of …"; check `finishReason` in the error; use an image model from `--list-models` |
| Content-policy refusal | Prompt touches restricted content | Rephrase to remove it; never try to get around the policy |
| Output extension differs from `--out` | Provider returned another format | The script saves with the real extension and warns; update references accordingly |
| Text in the image is garbled | Generators are weak at text | Remove text from the prompt; add text in HTML/SVG |
| Inconsistent style across a set | Prompts drifted | Reuse one fixed style block; pass the approved image as a reference |
| Codex image is "missing" | Built-in outputs live in `$CODEX_HOME/generated_images` | Copy into the project, then convert and verify |

## 6. Troubleshooting: transparency and edges

| Symptom | Cause | Fix |
|---|---|---|
| `alpha channel present but 0 transparent pixels` | Fake transparency: a checkerboard or solid background painted in | Generate with a transparency-capable provider, or remove the background (conversion workflow §6) |
| `no alpha channel` after converting | JPEG output, or ffmpeg without `-pix_fmt yuva420p` | Use WebP/PNG/AVIF; `convert-image.mjs` adds the alpha pixel format automatically |
| Green or white fringe around the cutout | Chroma spill or matting | Re-run removal with alpha matting (`rembg -a`), erode the edge 1 px, or use a background colour farther from the subject |
| Halo only visible on dark pages | Semi-transparent edge pixels keep the old background colour | Preview on dark; decontaminate colour (removal tools with matting) or add a subtle CSS drop-shadow |
| Corners not transparent | Background removal missed areas | Inspect the preview; re-run removal or clean up manually |

## 7. Troubleshooting: conversion and tools

| Symptom | Cause | Fix |
|---|---|---|
| `convert` does something unexpected on Windows | `C:\Windows\System32\convert.exe` is the FAT→NTFS disk tool | Never call `convert` on Windows. Use `magick` (ImageMagick 7); the scripts verify the binary |
| sharp install fails or "Could not load the sharp module" | Platform binary missing, or Node too old (needs ≥ 20.9) | `npm i -D sharp` on the target platform, check Node version, don't copy `node_modules` between OSes |
| sharp found "outside project" | Node resolved it from a parent directory | Install it in the project (`npm i -D sharp`) so builds are reproducible |
| `no converter available` | No sharp, ImageMagick, cwebp or ffmpeg with libwebp | Install sharp in the project (ask first), or ImageMagick |
| `npm i` changed a parent folder's `package.json` | npm installs into the nearest ancestor with a `package.json` when the current folder has none | Only install in the project root (which has `package.json`); for scratch tests run `npm init -y` in a dedicated folder first |
| WebP larger than the PNG | Flat graphics, tiny images, or lossless on photos | Use lossless for flat art and lossy for photos; or keep SVG/PNG when it really is smaller |
| Banding in gradients | Quality too low | Raise `--quality` (85–90) or use lossless for that asset |
| Output silently got `-v2` | Target already existed (no-overwrite rule) | Expected. Ask the user before replacing, then use `--overwrite` |

## 8. Troubleshooting: SVG

| Symptom | Cause | Fix |
|---|---|---|
| SVG renders in the editor but not via `<img>` | Missing `xmlns`, malformed XML, or external resources (blocked in `<img>`) | Add `xmlns="http://www.w3.org/2000/svg"`, run `verify-asset.mjs`, inline external refs |
| Icon is black / invisible on dark backgrounds via `<img>` | `currentColor` resolves to black outside inline SVG | Inline it (React component / SVGR) or ship a coloured file |
| Gradients vanish when two copies are on a page | Duplicate ids across inline SVGs | Prefix ids; in React derive them from `useId()` |
| Rotation spins around the top-left corner | Default `transform-origin` for SVG elements | `transform-box: fill-box; transform-origin: center` |
| Animation stopped after optimising | SVGO renamed or removed ids/classes used by CSS/JS | Configure SVGO to keep them (`cleanupIds: false`, preserve classes); re-run render-preview |
| `viewBox` or `<title>` missing after SVGO | Older SVGO defaults or custom config | SVGO v4's preset-default keeps `viewBox` and `<title>`; check the config for `removeViewBox`/`removeTitle` |
| Huge SVG (hundreds of KB) | Auto-traced or generated paths, too much precision | SVGO with lower precision, simplify shapes, or use a raster if it's really photographic |
| `<image>` error from verify-asset | Raster embedded in SVG | Redraw as vectors; use `--allow-raster-in-svg` only if the user explicitly wants a raster wrapper |

## 9. Troubleshooting: React / bundler integration

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module './x.webp'` (TS) | Missing asset type declarations | Ensure `/// <reference types="vite/client" />` in `src/vite-env.d.ts` (Vite) |
| `import X from './x.svg?react'` fails | SVGR plugin not installed or configured | Add `vite-plugin-svgr` (with the user's OK), plus its `client` types; or write a TSX component |
| Image 404 in production but fine in dev | Wrong `public/` URL or app served under a sub-path | Use imports for `src/` assets; prefix public URLs with `import.meta.env.BASE_URL` |
| Layout shift when the image loads | No `width`/`height`/aspect-ratio | Set the intrinsic size (ResponsiveImage requires it) |
| Blurry on retina screens | Only 1× variant served | Add a 2× width to the ladder and correct `sizes` |
| Hero loads late (poor LCP) | Lazy-loaded LCP image | `priority` / `loading="eager"` + `fetchPriority="high"` on that one image |
| JSX errors on pasted SVG (`stroke-width`, `class`) | SVG attributes not converted to JSX | camelCase attributes (`strokeWidth`, `className`), or convert with SVGR |
| `next/image` error for remote URL | Remote host not allowed | Add it to `images.remotePatterns`, or save the asset locally |
