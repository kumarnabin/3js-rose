---
name: ai-visual-asset-engineer
description: Turns natural-language prompts and reference images into real, production-ready visual assets for React and other web projects, including generated PNG images (photos, illustrations, transparent cutouts, textures, sprites), optimised WebP and AVIF variants, hand-authored SVG (icons, logos, illustrations, diagrams, patterns), animated SVG, and typed React SVG components. Detects which image-generation tools the current agent actually has (built-in, MCP or API key) and never fakes a generated image. Converts and resizes with sharp, ImageMagick, cwebp or ffmpeg, preserves transparency, verifies format, dimensions, alpha and browser rendering, saves into the project's asset folders without overwriting, and wires assets into components on request. Use when the user asks to create, generate, edit, vectorise, convert, optimise or integrate images, icons, logos, illustrations, textures, sprites, favicons, OG images or SVG animations.
---

# AI Visual Asset Engineer

Produce **real asset files** in the user's project, choosing the right medium (generated raster, SVG, CSS, canvas) for each request, then verify and report what actually exists.

`<skill-dir>` below means the directory containing this SKILL.md. The scripts need Node 18+ and have no npm dependencies of their own; sharp and Playwright are used when the project has them.

## Non-negotiable rules

1. **Honesty.** Generate rasters only through a tool or API that is actually available here. Never claim, describe or reference an image that wasn't produced. If generation is unavailable, say so and follow [references/image-generation-integrations.md](references/image-generation-integrations.md) §11.
2. **No fakes.** No placeholder images, stock URLs, invented file paths, text descriptions instead of assets, or base64 blobs in source code, unless the user explicitly asks for one of those.
3. **No overwriting.** Never replace an existing file without explicit permission. The scripts write `-v2`, `-v3`… automatically.
4. **Paid calls need approval.** API generation costs money and sends prompts and reference images to a third party. Show the dry-run plan, get a yes, then run with `--confirm`.
5. **True vectors.** When SVG is requested, write vector markup. Never wrap a raster in `<image>` and call it SVG.
6. **Report only what you verified.** Every listed file was checked to exist, and every claimed check was actually run.

## Workflow

Copy this checklist into your notes and work through it:

```
- [ ] 1. Inspect project      node <skill-dir>/scripts/detect-environment.mjs [project]
- [ ] 2. Decide output medium (table below); confirm only if ambiguity changes the deliverable
- [ ] 3. Detect generation capability (own tool list → API keys → none)
- [ ] 4. Produce the master asset (generate / author SVG / CSS / canvas)
- [ ] 5. Convert + size variants   node <skill-dir>/scripts/convert-image.mjs …
- [ ] 6. Save in the project's asset dir with descriptive, versioned names
- [ ] 7. Integrate into components (only when requested)
- [ ] 8. Validate                  verify-asset.mjs + render-preview.mjs + build; look at the result
- [ ] 9. Report files, formats, locations, steps, verification (template in validation guide)
```

### 1. Inspect the project

Run the detector to get the framework, bundler, TypeScript/Tailwind/SVGR, existing asset directories, converters and API keys present. Read existing components that will use the asset and copy their conventions: import vs `public/` URL, icon library, naming.

### 2. Decide the output medium

| Request | Medium |
|---|---|
| Photo, realistic render, painterly illustration, texture, sprite | **Generated raster** → PNG master → WebP/AVIF |
| Transparent product/object cutout | Raster with real alpha (provider transparency or background removal) |
| Icon, logo, flat illustration, diagram, pattern, divider | **SVG** written by you ([references/svg-authoring.md](references/svg-authoring.md)) |
| Loader, animated icon, line-draw reveal | **Animated SVG** (CSS/SMIL) or React component with motion |
| Gradient glow, blob, simple decorative background | **CSS**, or SVG |
| Generative or particle art | **Canvas/WebGL** at runtime, or rendered to PNG/WebP |
| Themeable or reusable graphic in React | **React SVG component** ([references/react-integration-workflow.md](references/react-integration-workflow.md)) |
| Mixed (e.g. hero photo + SVG wave divider + icon set) | Combine, each part in its best medium |

### 3. Detect generation capability

Check your **own tool list** first:

- **Codex**: the built-in `image_gen` tool or `$imagegen` skill.
- **Antigravity**: the built-in Gemini image tool.
- **Any agent**: an MCP image server.
- **Claude Code**: no built-in generator.

Otherwise use `scripts/generate-image.mjs` with an available key (OpenAI, Gemini, Replicate). Read [references/image-generation-integrations.md](references/image-generation-integrations.md) for each provider's capabilities, such as which ones support transparency, references and SVG, and for how to connect one.

### 4. Produce the master asset

- **Raster:** build the prompt from [references/prompt-templates.md](references/prompt-templates.md). Use the nearest supported size or aspect ratio, and pass reference images for edits or consistency. Dry-run, get approval, then generate. Save the PNG (or the provider's native format) as the master and keep the `.asset.json` sidecar. Refine one change at a time.
- **SVG:** fill in the SVG spec template, then write clean markup: a `viewBox`, `xmlns`, prefixed ids, `<defs>`/`<use>` for repetition, a `<title>` or `aria-hidden`, and no rasters or scripts.
- **Built-in agent tools:** copy their output from wherever the tool saved it into the project before continuing.

### 5–6. Convert, size, save

Follow [references/asset-conversion-workflow.md](references/asset-conversion-workflow.md). Typical command:

```bash
node <skill-dir>/scripts/convert-image.mjs public/assets/hero-coffee-v1.png --format webp --widths 640,1280,1920 --out-dir public/assets
```

Alpha is preserved automatically, images are never upscaled, and collisions get versioned names. Save into the directory the project already uses, otherwise `public/assets/` for URL-referenced files and `src/assets/` for imported ones. Use kebab-case names: `{feature}-{subject}-{variant}`.

### 7. Integrate (when requested)

Use the project's existing image or icon components. Otherwise use the `ResponsiveImage` and typed icon patterns in the React workflow. Set intrinsic `width`/`height`, real `alt` text, and priority loading only for the LCP image. Update every old reference, and leave old files in place unless asked.

### 8. Validate

```bash
node <skill-dir>/scripts/verify-asset.mjs <files…> [--expect-alpha] [--expect-format webp] [--max-bytes N]
node <skill-dir>/scripts/render-preview.mjs <files…> --out asset-preview.png     # then LOOK at the screenshot
```

Then run the project's typecheck and build if code changed. Use [references/validation-and-troubleshooting.md](references/validation-and-troubleshooting.md) for checks per asset type and fixes. If a check can't run (e.g. no Playwright), say so in the report.

### 9. Report

List each file with its **actual** format, dimensions, size, alpha and location. Then describe the generation, conversion and integration steps with the commands run, the verification results, anything not verified, and licence or watermark notes. The template is in the validation guide §4.

## Scripts

| Script | Purpose |
|---|---|
| `scripts/detect-environment.mjs [dir] [--json]` | Project conventions, converters, API-key presence (names only), agent hints |
| `scripts/generate-image.mjs --provider openai\|gemini\|replicate …` | Dry-run by default; `--confirm` to call; `--list-models`; refs, transparency, sizes; never overwrites; writes `.asset.json` |
| `scripts/convert-image.mjs <input> --format webp\|avif\|png\|jpeg …` | sharp → ImageMagick → cwebp → ffmpeg; width ladders; alpha preserved; versioned outputs |
| `scripts/verify-asset.mjs <files…>` | Real format, dimensions, alpha incl. fake-transparency detection, size budget; SVG well-formedness and accessibility |
| `scripts/render-preview.mjs <files…>` / `--rasterize` | Chromium render on light/dark/checkerboard with load and console checks; SVG → transparent PNG |

Run scripts. Read their source only when debugging them.

## Reference files: read only what the task needs

| File | Read when |
|---|---|
| [references/image-generation-integrations.md](references/image-generation-integrations.md) | Any raster generation, or the user asks how to enable it |
| [references/prompt-templates.md](references/prompt-templates.md) | Writing generation prompts or SVG/icon/animation specs |
| [references/svg-authoring.md](references/svg-authoring.md) | Writing or fixing SVG, icons, logos, diagrams, animated SVG |
| [references/asset-conversion-workflow.md](references/asset-conversion-workflow.md) | Converting, resizing, transparency, favicons, naming |
| [references/react-integration-workflow.md](references/react-integration-workflow.md) | Wiring assets into React/Next/Vite, SVG components |
| [references/validation-and-troubleshooting.md](references/validation-and-troubleshooting.md) | Validating, reporting, or anything failing |
