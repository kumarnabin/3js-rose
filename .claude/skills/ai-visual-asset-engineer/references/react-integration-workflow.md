# React Integration Workflow

Wiring generated or authored assets into React projects: raster images, SVG files, SVG React components and animated SVG. Detect the project's conventions first (`node scripts/detect-environment.mjs`), then follow the matching section.

## Contents

1. Integration steps
2. How the bundler resolves assets
3. Responsive raster images (`ResponsiveImage`)
4. Next.js `next/image`
5. CSS background images
6. SVG usage options: `<img>`, SVGR, hand-written component
7. Typed icon component
8. Themeable illustration component (collision-safe ids)
9. Animated SVG component
10. Updating existing components safely
11. Tests

---

## 1. Integration steps

```
- [ ] Find every place the new asset should appear (grep for old filenames, placeholder URLs, TODOs)
- [ ] Choose public URL vs import, per the project's existing pattern (§2)
- [ ] Use the project's existing image/icon component if there is one; extend it rather than adding a parallel one
- [ ] Set intrinsic width/height (or aspect-ratio) to avoid layout shift
- [ ] Meaningful alt text (or alt="" for decorative); icons labelled via the control
- [ ] loading/decoding/fetchpriority by position: LCP image eager + high priority, others lazy
- [ ] Typecheck, build, render the page in a browser at mobile + desktop widths
- [ ] Report the files changed and the old → new references
```

Only edit components when the user asked for integration. Otherwise deliver the files and show how to reference them.

## 2. How the bundler resolves assets

| Project | Files in `public/` | Files in `src/` |
|---|---|---|
| Vite | Reference as `/assets/hero.webp` (served as-is, not fingerprinted) | `import heroUrl from "@/assets/hero.webp"` → hashed URL string |
| Next.js | `/assets/hero.webp` | `import hero from "@/assets/hero.webp"` → `StaticImageData` with `src`, `width`, `height` (use with `next/image`) |
| CRA / webpack 5 | `%PUBLIC_URL%/…` or `/…` | `import url from "./hero.webp"` |

- Vite: respect `base` in `vite.config` for public URLs (`import.meta.env.BASE_URL + "assets/hero.webp"`) when the app isn't served from `/`.
- TypeScript: Vite types `*.webp`/`*.svg` imports through `vite/client`. Check `src/vite-env.d.ts` exists.
- Use `src/` imports for component-owned images (cache-busting, missing files fail the build). Use `public/` for files that need stable URLs (OG images, favicons, CMS-referenced assets).

## 3. Responsive raster images (`ResponsiveImage`)

```tsx
// src/components/responsive-image.tsx
import type { ImgHTMLAttributes } from "react";

type Source = { width: number; src: string };

export type ResponsiveImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "width" | "height"> & {
  /** WebP variants, any order. The largest is used as the fallback src. */
  webp: Source[];
  /** Optional AVIF variants for <picture>. */
  avif?: Source[];
  /** Intrinsic size of the largest variant, used for aspect ratio (prevents CLS). */
  width: number;
  height: number;
  alt: string;
  /** e.g. "(min-width: 1024px) 50vw, 100vw" — describe the rendered width. */
  sizes: string;
  /** true for the LCP image (above the fold): eager + high priority. */
  priority?: boolean;
};

const toSrcSet = (s: Source[]) => [...s].sort((a, b) => a.width - b.width).map((v) => `${v.src} ${v.width}w`).join(", ");

export function ResponsiveImage({ webp, avif, width, height, alt, sizes, priority = false, ...img }: ResponsiveImageProps) {
  const fallback = [...webp].sort((a, b) => b.width - a.width)[0];
  return (
    <picture>
      {avif?.length ? <source type="image/avif" srcSet={toSrcSet(avif)} sizes={sizes} /> : null}
      <source type="image/webp" srcSet={toSrcSet(webp)} sizes={sizes} />
      <img
        src={fallback.src}
        width={width}
        height={height}
        alt={alt}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        {...img}
      />
    </picture>
  );
}
```

Usage with Vite imports:

```tsx
import hero640 from "@/assets/hero-coffee-640w.webp";
import hero1280 from "@/assets/hero-coffee-1280w.webp";
import hero1920 from "@/assets/hero-coffee-1920w.webp";

<ResponsiveImage
  webp={[{ width: 640, src: hero640 }, { width: 1280, src: hero1280 }, { width: 1920, src: hero1920 }]}
  width={1920}
  height={1080}
  sizes="100vw"
  alt="Sage-green ceramic pour-over coffee dripper on an oak counter in morning light"
  priority
  className="h-auto w-full object-cover"
/>
```

`width` and `height` give the browser the aspect ratio. Keep CSS `height: auto` (or a fixed aspect-ratio box) so the image scales without distortion.

## 4. Next.js `next/image`

```tsx
import Image from "next/image";
import hero from "@/assets/hero-coffee-v1.png"; // master; Next generates WebP/AVIF variants itself

<Image src={hero} alt="…" sizes="100vw" placeholder="blur" className="h-auto w-full" />
```

- Next's optimiser produces modern formats and sizes on demand, so you don't need to pre-generate ladders unless images are exported statically (`output: "export"` disables the default optimiser).
- The prop for the LCP image differs between Next versions. Check the installed version's `next/image` docs (`priority` historically) before using it.
- Remote images need `images.remotePatterns` in `next.config`.

## 5. CSS background images

Use background images for decoration only. Content images belong in `<img>` with alt text.

```css
.hero-bg {
  background-image: image-set(url("/assets/texture-linen-1024w.avif") type("image/avif"), url("/assets/texture-linen-1024w.webp") type("image/webp"));
  background-size: 512px; /* tile textures at half their pixel size for 2× screens */
}
```

## 6. SVG usage options

| Option | When | Theming | Notes |
|---|---|---|---|
| `<img src={url} alt="…">` | Static illustrations, logos, anything not themed | No (`currentColor` → black) | Cached and simple; no ids clash; JS in SVG won't run |
| SVGR import (`import Logo from "./logo.svg?react"`) | Existing SVG files that need `currentColor` / CSS styling | Yes | Needs `vite-plugin-svgr` (or `@svgr/webpack` in Next/webpack); check it's configured before using the `?react` suffix |
| Hand-written TSX component | Icon systems, animated SVG, dynamic parts | Yes | Best control; typed props; collision-safe ids (§8) |
| Inline `dangerouslySetInnerHTML` | Avoid | — | Only for trusted, sanitised SVG strings |

Vite + SVGR setup (only if the user agrees to add it):

```ts
// vite.config.ts
import svgr from "vite-plugin-svgr";
export default defineConfig({ plugins: [react(), svgr()] });
```

```ts
// src/vite-env.d.ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
```

## 7. Typed icon component

```tsx
// src/components/icons/upload-icon.tsx
import { useId, type SVGProps } from "react";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Accessible name. Omit when the icon is decorative or the parent control is labelled. */
  title?: string;
  size?: number | string;
};

export function UploadIcon({ title, size = 24, strokeWidth = 2, ...props }: IconProps) {
  const titleId = useId();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-labelledby={title ? titleId : undefined}
      focusable="false"
      {...props}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </svg>
  );
}
```

Usage: `<button aria-label="Upload file"><UploadIcon /></button>` (decorative inside a labelled control), or `<UploadIcon title="Uploaded" className="size-4 text-emerald-600" />`.

For several icons, generate one component per icon from optimised SVG files (SVGR CLI: `npx @svgr/cli --typescript --icon --out-dir src/components/icons src/assets/icons`, after checking current flags), or share an `Icon` base that takes `children` paths. Before creating a set, check whether the project already uses lucide-react or similar. Custom icons should match that library's API (`size`, `strokeWidth`, `className`).

## 8. Themeable illustration component (collision-safe ids)

Gradients, clip paths and masks reference ids. Two instances of an inline SVG on one page would share ids and break each other, so derive ids from `useId()`. Strip characters that aren't valid in `url(#…)`, since the format of `useId` output has changed between React versions.

```tsx
// src/components/illustrations/empty-inbox.tsx
import { useId, type SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { title?: string };

export function EmptyInboxIllustration({ title = "Empty inbox", ...props }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = { title: `${uid}-title`, paper: `${uid}-paper` };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" role="img" aria-labelledby={ids.title} {...props}>
      <title id={ids.title}>{title}</title>
      <defs>
        <linearGradient id={ids.paper} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--illus-paper-top, #ffffff)" />
          <stop offset="1" stopColor="var(--illus-paper-bottom, #e8ecf3)" />
        </linearGradient>
      </defs>
      <rect x="120" y="120" width="240" height="150" rx="12" fill={`url(#${ids.paper})`} stroke="var(--illus-line, #94a3b8)" strokeWidth="2" />
      <path d="M120 132l120 78 120-78" fill="none" stroke="var(--illus-line, #94a3b8)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M300 80l60-24-20 64-14-26z" fill="var(--illus-accent, #4f46e5)" />
    </svg>
  );
}
```

Theme from CSS: `.dark { --illus-paper-top: #1e293b; --illus-paper-bottom: #0f172a; --illus-line: #475569; }`. In JSX, SVG attributes use camelCase (`stopColor`, `strokeWidth`, `strokeLinejoin`). When converting raw SVG, rename them, or let SVGR do it.

## 9. Animated SVG component

CSS-based (no dependency), with reduced motion respected:

```tsx
// src/components/illustrations/check-draw.tsx
import type { SVGProps } from "react";

export function CheckDraw(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" width={52} height={52} aria-hidden="true" {...props}>
      <style>{`
        .check-draw-circle, .check-draw-tick { stroke-dasharray: 1; stroke-dashoffset: 1; animation: check-draw 0.5s ease-out forwards; }
        .check-draw-tick { animation-delay: 0.35s; }
        @keyframes check-draw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) { .check-draw-circle, .check-draw-tick { animation: none; stroke-dashoffset: 0; } }
      `}</style>
      <circle className="check-draw-circle" cx="26" cy="26" r="24" pathLength={1} fill="none" stroke="currentColor" strokeWidth="3" />
      <path className="check-draw-tick" d="M15 27l7 7 15-15" pathLength={1} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

If the project already uses Motion: `<motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />` inside the SVG, with `MotionConfig reducedMotion="user"` at the app root. Don't mix CSS and Motion on the same element.

## 10. Updating existing components safely

- Grep for the old reference (`grep -rn "hero.jpg" src`) and update every usage, or explain why some were left.
- Keep the layout stable: same aspect ratio as the slot, `width`/`height` set, the same classes.
- Don't delete the old asset files unless asked. Report them as now unused.
- Keep business logic, props and exports unchanged. Change only how the image is rendered.
- Run the project's typecheck/build, then load the page and confirm the asset appears (network tab: 200, correct `content-type`; no console errors).

## 11. Tests

```tsx
// React Testing Library
render(<UploadIcon title="Upload" />);
expect(screen.getByRole("img", { name: "Upload" })).toBeInTheDocument();

render(<button aria-label="Upload file"><UploadIcon /></button>);
expect(screen.getByRole("button", { name: "Upload file" })).toBeInTheDocument();
```

Playwright: load the page, assert every `img` has `naturalWidth > 0`, and take a screenshot for visual review (see [validation-and-troubleshooting.md](validation-and-troubleshooting.md)).
