# Asset Conversion Workflow

Turning source images (generated, supplied or rasterised from SVG) into optimised web deliverables. The bundled scripts do the work: `scripts/convert-image.mjs` (conversion, resizing, variants) and `scripts/verify-asset.mjs` (checks). Run them from the project root, and pass `--project <dir>` to `convert-image.mjs` if you run it from elsewhere, so it finds the project's sharp.

## Contents

1. Pipeline overview
2. Choosing formats
3. Choosing sizes
4. Converter engines and installing one
5. Commands
6. Transparency: preserving and creating it
7. SVG rasterisation and favicons
8. Naming, versioning and no-overwrite rules
9. Quality settings and size budgets
10. Checklist

---

## 1. Pipeline overview

```
source (PNG from generator, PNG/JPEG from user, SVG)
  → keep the original as the master  (e.g. public/assets/hero-coffee-v1.png or a src-assets/ folder)
  → [optional] background removal / crop / trim
  → convert + resize into delivery variants (WebP, AVIF, PNG fallback when needed)
  → verify each output (format, dimensions, alpha, size budget)
  → render-preview (browser check)
  → reference from code
```

Keep the master: it's the source for future variants. If the project mustn't ship masters, store them outside `public/` (e.g. `design/` or `assets-src/`) and ask before committing large binaries.

## 2. Choosing formats

| Content | Deliver | Notes |
|---|---|---|
| Photo / realistic render, opaque | **WebP** (q 75–85), optional AVIF | JPEG only if a target explicitly needs it |
| Photo cutout with transparency | **WebP with alpha** (alpha quality 100) | Keep a PNG master |
| Flat illustration, UI screenshot, text in image | WebP **lossless** or PNG | Lossy WebP smears hard edges and text |
| Icon, logo, simple illustration | **SVG** | Rasterise only for favicons, OG images and emails |
| Animated content | Animated SVG / CSS / Lottie; video (`webm`/`mp4`) for long footage | Animated WebP/GIF only for small, short loops |
| Social/OG image | PNG or JPEG at 1200×630 | Many crawlers don't support WebP or AVIF |
| Email | PNG/JPEG | Email clients have weak WebP/SVG support |

All evergreen browsers support WebP. Add AVIF when its extra savings matter (large photos), and serve it with `<picture>` and a WebP fallback.

## 3. Choosing sizes

- Find the **maximum rendered CSS width** from the layout (e.g. hero spans 100vw up to 1440 px; card image ~360 px).
- Produce widths for 1× and 2× density: `[rendered, 2×rendered]`, or a ladder for fluid images: `640, 1280, 1920` (add `2560` only for full-bleed heroes on large screens).
- Don't upscale. `convert-image.mjs` never enlarges, and it skips duplicate widths.
- Match the aspect ratio to the layout slot. Crop deliberately rather than letting `object-fit: cover` cut off the subject. Generate at a ratio close to the slot.

## 4. Converter engines and installing one

`convert-image.mjs` tries **sharp → ImageMagick → cwebp → ffmpeg** and reports which one it used.

| Engine | Install | Notes |
|---|---|---|
| sharp (recommended) | `npm i -D sharp` in the project | Fast and accurate; WebP, AVIF, PNG, JPEG; resolved from the project's `node_modules` |
| ImageMagick 7 | OS package (`winget install ImageMagick.ImageMagick`, `brew install imagemagick`, `apt install imagemagick`) | Command is `magick`. On Windows, `convert` is a **system disk utility**: never call it |
| libwebp `cwebp` | `brew install webp`, `apt install webp`, or Google's libwebp binaries | WebP only |
| ffmpeg | Often already installed | WebP via `libwebp` (needs a build that includes it), PNG; no AVIF in this script |

Run `node scripts/detect-environment.mjs` to see which are available. Installing a dev dependency changes the project: say so and ask, unless the user has already approved adding tools.

## 5. Commands

```bash
# Responsive WebP ladder from a master PNG (lossy, alpha kept automatically if present)
node scripts/convert-image.mjs public/assets/hero-coffee-v1.png --format webp --widths 640,1280,1920 --out-dir public/assets

# Lossless WebP for a flat illustration or cutout with hard edges
node scripts/convert-image.mjs src/assets/onboarding-illustration.png --format webp --lossless --out src/assets/onboarding-illustration.webp

# AVIF + WebP pair for <picture>
node scripts/convert-image.mjs public/assets/team-photo.png --format avif --widths 800,1600 --out-dir public/assets
node scripts/convert-image.mjs public/assets/team-photo.png --format webp --widths 800,1600 --out-dir public/assets

# Verify everything produced
node scripts/verify-asset.mjs public/assets/hero-coffee-*.webp --expect-format webp --max-bytes 350000
```

Output names: `<base>-<width>w.<ext>` for ladders, or the exact `--out` path. Use `--name` to change the base.

Manual equivalents, if the script can't run:

```bash
# sharp (Node)
node -e "require('sharp')('in.png').resize({width:1280,withoutEnlargement:true}).webp({quality:82,alphaQuality:100,effort:5}).toFile('out-1280w.webp')"
# ImageMagick 7
magick in.png -resize "1280x>" -quality 82 -define webp:alpha-quality=100 -define webp:method=5 out-1280w.webp
# cwebp
cwebp -q 82 -alpha_q 100 -m 5 -resize 1280 0 in.png -o out-1280w.webp
# ffmpeg (add -pix_fmt yuva420p to keep alpha)
ffmpeg -n -i in.png -vf scale=1280:-2 -c:v libwebp -quality 82 -pix_fmt yuva420p out-1280w.webp
```

## 6. Transparency: preserving and creating it

**Preserving:** WebP, AVIF and PNG keep alpha. JPEG can't hold alpha, so `convert-image.mjs` flattens onto white and warns. After conversion, the script checks alpha in the output header and prints `alpha preserved` or `LOST`. Then run `verify-asset.mjs --expect-alpha` on PNG masters. It decodes pixels and fails on fake transparency, such as an opaque checkerboard or an alpha channel with no transparent pixels.

**Creating it** when the generator can't output transparency:

1. Generate on a flat chroma background (see the prompt templates: solid `#00FF00`, no shadow or floor).
2. Remove the background with whatever is actually available:
   - `rembg` (Python CLI): `rembg i input.png output.png`
   - `@imgly/background-removal-node` (npm, ML model, runs locally): check its current API and licence (AGPL) before adding it to a project
   - ImageMagick flood fill for truly flat backgrounds: `magick in.png -fuzz 12% -fill none -draw "color 0,0 floodfill" out.png`, followed by defringing
   - A hosted API (e.g. remove.bg) only with the user's key and consent, because it uploads the image
   - Alternatively, a generator **edit** request asking for a transparent background, if the provider supports it
3. Check the edges: render on dark **and** light backgrounds (render-preview shows both plus a checkerboard). Look for green or white halos, and fix them by eroding the edge 1 px or re-running removal at higher quality.
4. Verify: `verify-asset.mjs cutout.png --expect-alpha`. Corners should be transparent.

## 7. SVG rasterisation and favicons

Rasterise SVG through a real browser so the output matches what users see:

```bash
node scripts/render-preview.mjs src/assets/logo-mark.svg --rasterize --width 512 --out public/icon-512.png
node scripts/render-preview.mjs src/assets/logo-mark.svg --rasterize --width 192 --out public/icon-192.png
node scripts/render-preview.mjs src/assets/logo-mark.svg --rasterize --width 180 --out public/apple-touch-icon.png
```

sharp can also rasterise SVG (`sharp('in.svg', { density: 300 })`), but its renderer (librsvg) differs from browsers for filters, fonts and CSS in SVG. Check the result.

## 8. Naming, versioning and no-overwrite rules

- Use descriptive kebab-case: `{page-or-feature}-{subject}-{variant}.{ext}`, e.g. `pricing-hero-team-collab.webp`, `icon-upload.svg`, `empty-state-inbox-dark.svg`.
- Width suffix for ladders: `-1280w`. Theme suffix: `-light`, `-dark`. Density suffix only when not using `w` descriptors: `@2x`.
- **Never overwrite** an existing file without the user's explicit permission. The scripts write `-v2`, `-v3`… instead. When replacing is approved, keep the old file until the new one is verified.
- Use the directory the project already uses (detect-environment lists them). The default convention:
  - `public/assets/` (or `public/images/`) for files referenced by URL, OG images and favicons at the `public/` root
  - `src/assets/` for files imported by components (bundler fingerprints them)
  - `src/components/icons/` or `src/assets/icons/` for SVG icons and their React components

## 9. Quality settings and size budgets

| Asset | Starting setting | Typical budget |
|---|---|---|
| Full-bleed hero photo, 1920w WebP | q 80–82 | ≤ 250–350 KB |
| Content image, 1280w WebP | q 78–82 | ≤ 150 KB |
| Card / thumbnail, ≤ 640w | q 75–80 | ≤ 60 KB |
| Cutout with alpha | q 82, alpha q 100 | ≤ 150 KB at 1280w |
| Flat illustration | lossless | varies; compare with SVG |
| Icon SVG | after SVGO | ≤ 2 KB |
| Illustration SVG | after SVGO | ≤ 30–60 KB, or reconsider raster |

Raise quality if banding (gradients, skies) or ringing around text appears; inspect the preview at 100%. Lower it only while the output still looks right. "Without unnecessarily degrading quality" means visually checking, not just hitting a number.

## 10. Checklist

```
- [ ] Master kept (PNG/original), outside public/ if it shouldn't ship
- [ ] Format chosen for content type (table §2)
- [ ] Widths derived from layout; no upscaling
- [ ] Converted with a real engine (report which)
- [ ] verify-asset: format, dimensions, alpha (--expect-alpha for cutouts), size budget
- [ ] render-preview: renders on light/dark/checkerboard; looked at the screenshot
- [ ] No existing file overwritten without permission
- [ ] Prompt/settings recorded in the sidecar manifest for generated assets
```
