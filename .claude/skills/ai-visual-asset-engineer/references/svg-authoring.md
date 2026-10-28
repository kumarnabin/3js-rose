# SVG Authoring

Standards for hand-authored or code-generated SVG: illustrations, icons, logos, diagrams, decorative graphics and animated SVG.

## Contents

1. When SVG is the right output
2. File skeleton
3. Geometry and structure
4. Colour, theming and gradients
5. Accessibility
6. Icons
7. Logos and wordmarks
8. Diagrams
9. Decorative backgrounds and patterns
10. Animated SVG
11. Optimising with SVGO
12. Raster → vector requests

---

## 1. When SVG is the right output

| Request | Output |
|---|---|
| Icon, logo mark, UI glyph, simple illustration, diagram, chart decoration, pattern, divider | **SVG** (hand-authored) |
| Animated loader, animated icon, line-drawing reveal, morphing shape | **Animated SVG** (CSS or SMIL), or a React component with Motion |
| Gradient blob, glow, mesh-like background | **CSS** (`radial-gradient`, `conic-gradient`, `filter: blur`) or SVG; prefer CSS if it's a page background |
| Generative, particle or noise art, or thousands of shapes | **Canvas / WebGL** rendered at runtime, or exported to PNG/WebP |
| Photographic or painterly image, complex textures, realistic product | **Raster** from an image generator |
| "Vector-style" illustration the user will edit in Figma/Illustrator | **SVG** authored as clean shapes. Not a raster with a vector look. |

Never wrap a raster in an `<image>` element and call it a vector asset. If true vector output isn't feasible (photoreal detail), say so and offer a raster or a simplified vector interpretation.

## 2. File skeleton

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" width="480" height="320"
     role="img" aria-labelledby="empty-inbox-title empty-inbox-desc">
  <title id="empty-inbox-title">Empty inbox</title>
  <desc id="empty-inbox-desc">An open envelope with a paper plane flying out of it.</desc>
  <defs>
    <linearGradient id="empty-inbox-paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#E8ECF3"/>
    </linearGradient>
  </defs>
  <g id="envelope">…</g>
  <g id="plane">…</g>
</svg>
```

Rules:

- Always `xmlns` (needed when used via `<img>`, CSS or as a file) and a `viewBox`. Add `width` and `height` as the intrinsic size so `<img>` without CSS has dimensions. Drop them in React components and size with CSS.
- `viewBox` origin at `0 0` with round numbers. Keep content inside it with deliberate padding.
- Prefix ids with the asset name (`empty-inbox-…`). Ids are global once SVGs are inlined, so two inline SVGs both using `id="a"` will break each other's gradients.
- Group logically (`<g id="plane">`) so the file stays editable and parts can be animated.
- Put reusable shapes, gradients, clip paths and markers in `<defs>`, and reuse them with `<use href="#…">`.
- No embedded rasters, fonts loaded from URLs, `<script>` or `on*` handlers in static assets.
- Convert text to paths only for logos. For diagrams and labels keep real `<text>` (accessible, translatable) and use system font stacks.

## 3. Geometry and structure

- Prefer primitives (`rect`, `circle`, `ellipse`, `line`, `polyline`) when they express the shape; use `path` otherwise.
- Use 0–2 decimal places, and align strokes to the pixel grid (odd stroke widths on .5 coordinates) for crisp icons.
- Avoid deep `transform` nesting. Apply transforms to coordinates where practical so editors show sensible values.
- Use `vector-effect="non-scaling-stroke"` when strokes must stay constant while the graphic scales (diagrams).
- Keep the path count proportional to what's actually visible. 30 well-made paths beat 3,000 traced ones.

## 4. Colour, theming and gradients

- Single-colour icons: `currentColor`, so they inherit the CSS `color`. This only works for **inline** SVG or React components. Through `<img>` or CSS `background`, `currentColor` resolves to black. Ship a coloured file, or inline it.
- Multi-colour themable illustrations: use CSS custom properties with fallbacks: `fill="var(--illus-primary, #4F46E5)"`. Custom properties also only apply to inline SVG.
- For dark mode, either ship two files (`*-light.svg`, `*-dark.svg`) and switch with `<picture>` + `prefers-color-scheme`, or inline the SVG and theme it with variables.
- Gradients: define them in `<defs>` with prefixed ids. `gradientUnits="userSpaceOnUse"` gives predictable results across shapes.
- Filters (`feGaussianBlur`, `feDropShadow`) are expensive on large areas and render differently across tools. Use sparingly. For UI shadows, prefer CSS `filter: drop-shadow()` on the element.

## 5. Accessibility

| Usage | Markup |
|---|---|
| Meaningful standalone graphic | `role="img"` + `<title>` (+ `<desc>` if needed) linked with `aria-labelledby` |
| Used via `<img>` | The `alt` attribute on `<img>` is the name; a `<title>` in the file is a fallback |
| Decorative | `aria-hidden="true"` (inline) or `alt=""` (img); no title |
| Icon inside a labelled button | Icon `aria-hidden="true"`; the button carries `aria-label` |
| Diagram with information | Real `<text>` labels, a `<title>`/`<desc>`, and the data or explanation also available as HTML |

Check contrast of strokes and fills against the backgrounds they appear on (3:1 for meaningful graphics).

## 6. Icons

- 24×24 `viewBox` (or the existing set's grid), 2 px padding, consistent stroke width, round caps and joins for outline sets.
- `fill="none" stroke="currentColor"` on the root for outline icons, so children inherit.
- No `<title>`, ids or hard-coded colours in the icon files. The React wrapper adds accessible names and colour.
- Before drawing a new icon, check whether the project's icon library (Lucide, Phosphor, Heroicons) already has it. Use that for consistency, and draw custom icons only for gaps, matching its style.

## 7. Logos and wordmarks

- Draw only logos the user owns or is creating. Never recreate a third-party brand's logo.
- Deliver: full-colour, single-colour (`currentColor`), reversed (for dark backgrounds), and a mark-only version for favicons.
- Convert wordmark text to outlined paths, and keep an editable source version with live text if the font licence allows.
- Favicon set: an SVG favicon (`<link rel="icon" href="/favicon.svg" type="image/svg+xml">`) with a dark-mode `@media` block inside, plus PNG fallbacks (32, 180 for apple-touch-icon, 192/512 for the manifest), rasterised with `render-preview.mjs --rasterize`.

## 8. Diagrams

- Simple structure: boxes as `rect` with `rx`, connectors as `path` with a shared `marker-end` arrow in `<defs>`, labels as `<text>` with `text-anchor="middle"` and `dominant-baseline="middle"`.
- Use a grid (e.g. 8 px), consistent box sizes, and connectors routed orthogonally.
- For data-driven or frequently changing diagrams, generate them from data (Mermaid, D3, or React rendering SVG) instead of hand-editing coordinates.

## 9. Decorative backgrounds and patterns

- `<pattern>` for repeating motifs; keep the tile small.
- Blobs: a single path with smooth cubic curves, sized via `viewBox`, placed with CSS (`position: absolute; inset: …; z-index: -1`), and `aria-hidden="true"`.
- Consider whether CSS alone (gradients, `mask-image`) achieves it with less markup.

## 10. Animated SVG

Pick the technique by how the SVG is delivered:

| Delivery | Technique | Notes |
|---|---|---|
| Standalone file via `<img>` / CSS | CSS `@keyframes` inside `<style>` in the SVG, or SMIL (`<animate>`) | JS never runs in `<img>`; the animation runs but can't be controlled |
| Inline SVG / React component | CSS classes, Motion (`motion.path`), or GSAP | Full control: play on hover or in view, pause, reduced motion |
| Lottie / Rive | Use those formats when designers author complex timelines | Out of scope for hand-written SVG |

CSS animation inside an SVG file:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-labelledby="spinner-title">
  <title id="spinner-title">Loading</title>
  <style>
    .spinner-arc { transform-box: fill-box; transform-origin: center; animation: spinner-rotate 0.9s linear infinite; }
    @keyframes spinner-rotate { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner-arc { animation-duration: 2.4s; } }
  </style>
  <circle cx="24" cy="24" r="18" fill="none" stroke="#E5E7EB" stroke-width="4"/>
  <path class="spinner-arc" d="M24 6a18 18 0 0 1 18 18" fill="none" stroke="#4F46E5" stroke-width="4" stroke-linecap="round"/>
</svg>
```

Line-drawing reveal: give the path `pathLength="1"`, `stroke-dasharray: 1` and animate `stroke-dashoffset` from `1` to `0`. With Motion on inline SVG, `<motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />`.

Rules:

- `transform-box: fill-box; transform-origin: center` for rotating or scaling individual elements. Without it, the origin is the SVG's top-left corner.
- Animate `transform` and `opacity`. Animating `d` (path morphing) needs compatible paths, and filter animation is expensive.
- Always include a `prefers-reduced-motion` rule (stop, slow down or show the final state). Loops on a page lasting more than 5 s need a pause control (WCAG 2.2.2).
- Keep class and keyframe names prefixed (`spinner-…`) so inlined SVGs don't collide.

## 11. Optimising with SVGO

```bash
npx svgo@latest input.svg -o output.svg          # or a project-installed svgo
npx svgo@latest -f src/assets/icons -o src/assets/icons-optimized
```

- Check the SVGO version's defaults before relying on them. Recent majors changed what `preset-default` removes, and the integrations guide records the current behaviour.
- Use a `svgo.config.mjs` that keeps `viewBox`, `<title>`/`<desc>` on illustrations, and the ids that animations or `<use>` reference. Prefix ids (`prefixIds`) when SVGs will be inlined together.
- Never run SVGO over animated SVGs or files with ids referenced from CSS/JS without checking the output renders and animates the same (render-preview).
- Write optimised output to a new file, or overwrite only with permission.

## 12. Raster → vector requests

"Convert this PNG logo to SVG":

1. If it's a simple flat logo or icon, redraw it by hand as clean shapes (best quality), and compare the two side by side with render-preview.
2. Automatic tracing (potrace, vtracer, Inkscape Trace Bitmap) works for flat graphics. Only use a tracer that's actually installed, and clean up the output.
3. Photos can't be meaningfully vectorised. Say so, and offer an optimised raster or a stylised vector illustration.
4. Confirm the user owns or has rights to the logo.
