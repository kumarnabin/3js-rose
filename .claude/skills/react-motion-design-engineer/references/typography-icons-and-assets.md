# Typography, Icons and Assets

## Contents

1. Choosing typefaces
2. Loading fonts in Vite / React
3. Type scale and responsive type
4. Icons
5. SVG optimisation
6. Images and video
7. Asset licensing checklist

---

## 1. Choosing typefaces

- Start from the product's voice: neutral grotesk for tools and dashboards, a characterful display face + readable text face for marketing and portfolios, a monospace for developer products.
- Two families maximum (plus mono if code appears). Prefer one variable font with a weight axis over many static files.
- Check: language/script coverage, tabular figures (`font-variant-numeric: tabular-nums`) for dashboards, legibility at 12–14 px, distinct `Il1` and `0O`.
- Sources:
  - **Google Fonts** (https://fonts.google.com/) — open licences (mostly SIL OFL); self-host for performance and privacy.
  - **Fontshare** (https://fontshare.com/) — free fonts from Indian Type Foundry under its own licence; read the licence for the specific use.
  - Paid foundries — only if the user has a licence for web use.

## 2. Loading fonts in Vite / React

Prefer self-hosting over the Google Fonts CDN:

```bash
npm i @fontsource-variable/inter   # verify the package exists for the chosen family
```

```ts
// src/main.tsx
import "@fontsource-variable/inter";
```

```css
@theme {
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
}
```

For fonts not on Fontsource, put `woff2` files in `src/assets/fonts/` and declare `@font-face` with `font-display: swap`. Preload only the one or two files used above the fold. Use `size-adjust` / `ascent-override` on a fallback face if layout shift is visible on font swap.

## 3. Type scale and responsive type

- Choose a ratio: 1.2 (dense UI), 1.25 (balanced), 1.333+ (editorial / marketing).
- Use `clamp()` for display sizes only; keep body text fixed (16–18 px) for readability.
  `font-size: clamp(2.5rem, 1.5rem + 4vw, 4.5rem);`
- Line-height: ~1.5 for body, 1.1–1.2 for large headings. Negative tracking (−0.01 to −0.03em) on large headings; never on small text.
- Measure: 60–75 characters per line for prose (`max-width: 65ch`).
- `text-wrap: balance` for headings, `text-wrap: pretty` for paragraphs where supported (progressive enhancement).

## 4. Icons

| Library | Package | Notes |
|---|---|---|
| Lucide (default) | `lucide-react` | Consistent 24 px stroke icons; tree-shakeable named imports; shadcn/ui default |
| Phosphor | `@phosphor-icons/react` | Six weights (thin → fill, duotone); good for more expressive UIs |

Rules: one icon family per product; match stroke width to text weight; icon-only buttons get `aria-label`; decorative icons `aria-hidden="true"`; size with `size` prop or `className="size-4"`, not mixed. Import named icons (`import { Search } from "lucide-react"`) — never the whole set or dynamic icon maps in production bundles.

## 5. SVG optimisation

- Run exported SVGs through SVGO (CLI: `npx svgo file.svg`) or SVGOMG, a browser GUI for SVGO that processes files locally: https://svgomg.net/, or Jake Archibald's original at https://jakearchibald.github.io/svgomg/.
- Keep `viewBox`; remove fixed `width`/`height` so CSS controls size; use `currentColor` for fills/strokes that should inherit text colour.
- For animated SVG (path drawing, morphing), keep the IDs/classes you target — configure SVGO to preserve them.
- Inline small, frequently styled icons as React components (`vite-plugin-svgr` if the project uses it); load large illustrations as `<img>`.

## 6. Images and video

- Formats: AVIF/WebP with fallback; PNG only for UI screenshots that need sharp text; SVG for vector.
- Always set `width`/`height` or `aspect-ratio`; `loading="lazy"` below the fold; `fetchpriority="high"` on the LCP image only.
- Use `srcset`/`sizes` for responsive images.
- Background/hero video: muted, `playsInline`, short loop, poster image, compressed (≤ 2–3 MB), paused under reduced motion, with a pause control.
- 3D assets: see [3d-webgl-graphics.md](3d-webgl-graphics.md) (glTF, Draco/Meshopt, KTX2).

## 7. Asset licensing checklist

Before using any font, icon set, illustration, photo, video, 3D model, HDRI, Lottie or Rive file, record:

```
Asset:        <name / url>
Licence:      <exact licence name + link>   (verified: yes / no)
Commercial use allowed:   yes / no / unclear
Attribution required:     yes (how) / no
Modification allowed:     yes / no
Redistribution in source: yes / no   (matters for open-source repos)
```

If any field is "unclear", flag it in the final report instead of assuming. Common open sources: Google Fonts (OFL), Poly Haven HDRIs/models/textures (CC0), Unsplash (Unsplash licence — not CC0), LottieFiles free animations (check each animation's licence on its page).
