# Resource Catalog

This catalog lists places to start looking. Being listed does **not** mean a resource is current, free, open source, React-compatible or production-ready. Before recommending or installing anything, check its availability, current API, compatibility, maintenance and licence.

Search it instead of reading it whole:

```bash
grep -i "lottie" references/resource-catalog.md
grep -i "| inspiration" references/resource-catalog.md
```

## Verification legend

Last checked on **2026-10-28**, using live HTTP fetches and npm registry data.

- **✅ verified**: the site was reachable and the licence or pricing statement was seen on the site or on npm.
- **◐ partial**: the site was reachable, but the licence or pricing was not stated or not readable. Treat the licence as **unverified**.
- **⚠ changed**: the URL redirects, moved or blocks automated access. See the notes column.

Licences can change, and the pricing columns summarise what the sites said. Re-check before any commercial use.

## Contents

1. Animation and motion
2. React UI and animated components
3. Design inspiration
4. 3D, WebGL, shaders and graphics
5. Typography, icons and assets
6. Discovery directories
7. Foundations and tooling (official docs)
8. npm package snapshot

---

## 1. Animation and motion

| Resource | URL | What it is | React fit | Licence / pricing | Status | Notes |
|---|---|---|---|---|---|---|
| Motion | https://motion.dev/ | Animation library for JS, React and Vue (formerly Framer Motion) | Native: `motion/react` | MIT; Motion+ is a paid add-on | ✅ | Default for UI motion |
| GSAP | https://gsap.com/ | Timeline animation engine and plugins (ScrollTrigger, SplitText…) | `@gsap/react` `useGSAP` | Free under the GSAP Standard "no charge" licence, **not** MIT; restricts visual builders that compete with Webflow | ✅ | All plugins are on public npm |
| React Spring | https://www.react-spring.dev/ | Spring-physics animation | Native: `@react-spring/web` | MIT | ✅ | v10 supports React 19 |
| Anime.js | https://animejs.com/ | Lightweight JS animation engine | Imperative; use `createScope` in effects | MIT | ✅ | v4 uses named ESM imports |
| AutoAnimate | https://auto-animate.formkit.com/ | Zero-config list and layout transitions | `@formkit/auto-animate/react` | MIT | ✅ | Respects reduced motion |
| Lenis | https://lenis.dev/ | Smooth scrolling | `lenis/react` | MIT | ⚠ changed | `lenis.darkroom.engineering` redirects to `lenis.dev`; `@studio-freight/react-lenis` is deprecated |
| Theatre.js | https://www.theatrejs.com/ | Visual keyframe editor and runtime | `@theatre/r3f` supports R3F v8 only | Core Apache-2.0; Studio AGPL-3.0 | ✅ reachable | **Stalled**: last release 0.7.2 in May 2024 |
| Rive | https://rive.app/ | Interactive state-machine vector animation (editor and runtimes) | `@rive-app/react-canvas` / `react-webgl2` | Runtimes MIT; editor free and paid tiers | ✅ | Every `.riv` file has its own licence |
| LottieFiles | https://lottiefiles.com/ | Lottie marketplace, editor and players | `@lottiefiles/dotlottie-react` | Free and paid; each animation has its own licence | ✅ | Check every file's licence |

## 2. React UI and animated components

| Resource | URL | What it is | React fit | Licence / pricing | Status | Notes |
|---|---|---|---|---|---|---|
| shadcn/ui | https://ui.shadcn.com/ | Copy-into-your-code components on Radix or Base UI + Tailwind | Native, through the CLI | MIT | ✅ | Default foundation |
| React Bits | https://reactbits.dev/ | Animated text, backgrounds and components (JS/TS × CSS/Tailwind) | Native | Open-source free tier, plus a paid Pro at pro.reactbits.dev | ✅ | Some components pull in three/ogl/gsap |
| Magic UI | https://magicui.design/ | Animated landing-page components and templates | Native, shadcn registry | MIT, plus a paid Pro | ✅ | Use effects sparingly |
| Aceternity UI | https://ui.aceternity.com/ | Showy copy-paste effects (React + Tailwind + Motion) | Native | Free tier (100+ components), plus a paid All-Access | ◐ | Check the licence terms on the site before commercial use |
| Animate UI | https://animate-ui.com/ | Animated primitives for Radix, Base UI and React Aria, built with Motion | Native, shadcn CLI | **Not stated: unverified** | ◐ | Check the repository licence |
| Motion Primitives | https://motion-primitives.com/ | Open-source motion component kit (beta) | Native | Open source, with some pro mentions | ◐ | Check the exact licence in its repo |
| Animata | https://animata.design/ | Free copy-paste animated components | Native | MIT | ✅ | Review quality per snippet |
| 21st.dev | https://21st.dev/ | Marketplace of 12k+ community React + Tailwind components and shadcn themes | Native | Free browsing; paid plans; **each component has its own licence** | ◐ | Treat each item as third-party code |
| Hover.dev | https://www.hover.dev/ | Animated React + Tailwind components and templates | Native | A few free, most paid | ✅ | Confirm the licence of the paid components |
| Uiverse | https://uiverse.io/ | Community HTML/CSS/Tailwind UI elements | Needs conversion to React | MIT (free to copy) | ✅ | Add accessibility when converting |

## 3. Design inspiration

These are for inspiration only. They are not technical documentation.

| Resource | URL | What it is | Licence / pricing | Status | Notes |
|---|---|---|---|---|---|
| Awwwards | https://www.awwwards.com/ | Website awards and gallery | Free to browse; paid submissions and pro membership | ✅ | Award winners aren't always accessible or performant |
| Godly | https://godly.website/ | Web design inspiration gallery | Free | ⚠ changed | Redirects to https://recent.design/ ("Recent — Design Inspiration") |
| Codrops | https://tympanus.net/codrops/ | Creative-coding tutorials and demos | Free; check each demo's licence | ✅ | Strong on WebGL and text effects |
| Land-book | https://land-book.com/ | Landing-page gallery | Free, plus Pro | ✅ | |
| Lapa Ninja | https://www.lapa.ninja/ | 7,300+ landing-page examples | Free, plus Pro and templates | ✅ | |
| SiteInspire | https://www.siteinspire.com/ | Curated web design showcase | Not stated | ◐ | Blocks some automated requests (HTTP 429) |
| Minimal Gallery | https://minimal.gallery/ | Minimal web design inspiration | Free, plus premium templates | ✅ | |
| Httpster | https://httpster.net/ | Website inspiration gallery | Free | ✅ | |
| CodePen | https://codepen.io/ | Front-end playground and community | Free, plus PRO | ✅ | Every pen has its own licence |

## 4. 3D, WebGL, shaders and graphics

| Resource | URL | What it is | React fit | Licence / pricing | Status | Notes |
|---|---|---|---|---|---|---|
| three.js | https://threejs.org/ | WebGL/WebGPU 3D library | Through R3F | MIT | ✅ | |
| React Three Fiber (pmndrs docs) | https://r3f.docs.pmnd.rs/ | React renderer for three.js; the docs hub covers the pmndrs libraries | Native | MIT | ✅ | R3F 9 needs React 19 (<19.4 at last check) |
| Spline | https://spline.design/ | In-browser 3D design tool with web runtime | `@splinetool/react-spline` | Free and paid tiers | ✅ | Heavy runtime; use `/next` entry for Next.js |
| OGL | https://oframe.github.io/ogl/ | Minimal WebGL library | Imperative in effects | Unlicense (public domain) | ✅ | Good for lightweight effects |
| Babylon.js | https://www.babylonjs.com/ | Full web 3D engine | `react-babylonjs` (maintained, slow releases) | Apache-2.0 | ✅ | |
| PixiJS | https://pixijs.com/ | 2D WebGL/WebGPU renderer | `@pixi/react` v8 (`extend` API, React 19) | MIT | ✅ | |
| Unicorn Studio | https://www.unicorn.studio/ | No-code WebGL effects | Embed | Free plan, plus paid | ✅ | Proprietary SaaS |
| Shadertoy | https://www.shadertoy.com/ | GLSL shader community | Port the code | Free site; shaders default to CC BY-NC-SA 3.0 unless the author states otherwise | ⚠ changed | Blocks automated fetches (HTTP 403); browser access not verified |
| The Book of Shaders | https://thebookofshaders.com/ | GLSL fundamentals book | Learning | Free | ⚠ changed | Use the bare domain; the `www.` host failed |

## 5. Typography, icons and assets

| Resource | URL | What it is | React fit | Licence / pricing | Status | Notes |
|---|---|---|---|---|---|---|
| Google Fonts | https://fonts.google.com/ | Font catalogue | Self-host through Fontsource | Open licences (mostly OFL) | ✅ | |
| Fontshare | https://fontshare.com/ | Free fonts from Indian Type Foundry | Self-host | ITF free licence: **unverified**, read it per font | ◐ | Site renders client-side |
| Lucide | https://lucide.dev/ | Icon set (shadcn default) | `lucide-react` (v1.x) | ISC | ✅ | Default icons |
| Phosphor | https://phosphoricons.com/ | Icon family with 6 weights | `@phosphor-icons/react` | MIT | ✅ | |
| SVGOMG | https://svgomg.net/ | Browser GUI for SVGO (local processing) | Tooling | Free | ✅ | The original lives at https://jakearchibald.github.io/svgomg/ |

## 6. Discovery directories

| Resource | URL | What it is | Status |
|---|---|---|---|
| Designeer | https://designeer.org/ | Directory of about 420 design and frontend tools | ✅ |
| Taste (11xui) | https://taste.11xui.com/ | Curated index of UI, motion and WebGL libraries | ✅ |
| ShinUI (Shinozaki Design) | https://www.shinozaki.design/browse | Searchable index of UI libraries, motion tools, shaders and icons, tagged free, open source or paid | ✅ |
| BoringUI inspiration | https://boringui.dev/inspiration/ | Catalogue of UI, motion and design-engineering references | ✅ |
| JS Library Gallery | https://www.jslibrarygallery.com/ | JS libraries with live previews | ✅ |
| UINice Motion | https://uinice.com/motion | 40 hand-picked motion libraries with code | ✅ |

## 7. Foundations and tooling (official docs)

| Tool | Docs |
|---|---|
| React | https://react.dev/ |
| Vite | https://vite.dev/guide/ |
| Tailwind CSS (Vite) | https://tailwindcss.com/docs/installation/using-vite |
| shadcn/ui (Vite) | https://ui.shadcn.com/docs/installation/vite |
| Radix Primitives | https://www.radix-ui.com/primitives |
| Base UI | https://base-ui.com/ |
| Motion for React | https://motion.dev/docs/react |
| GSAP React guide | https://gsap.com/resources/React/ |
| R3F | https://r3f.docs.pmnd.rs/ |
| drei | https://drei.docs.pmnd.rs/ |
| Vitest | https://vitest.dev/ |
| Testing Library | https://testing-library.com/docs/react-testing-library/intro/ |
| Playwright | https://playwright.dev/ |
| MDN `prefers-reduced-motion` | https://developer.mozilla.org/docs/Web/CSS/@media/prefers-reduced-motion |
| WCAG 2.2 | https://www.w3.org/TR/WCAG22/ |

The drei, Base UI and MDN links were not fetched on 2026-10-28. They are well-known official URLs, but treat them as unverified until opened.

## 8. npm package snapshot

Snapshot from 2026-10-28, taken from registry.npmjs.org. Versions move quickly, so run `npm view <pkg> version peerDependencies` before installing.

| Package | Version | Key peers / notes |
|---|---|---|
| `motion` | 14.7.1 | React ^18 or ^19; import `motion/react` (also `react-m`, `react-mini`, `react-client`) |
| `framer-motion` | 14.7.1 | Still published, same codebase; keep it only where already used |
| `gsap` | 3.15.0 | All plugins included (ScrollTrigger, SplitText, ScrollSmoother, MorphSVG, DrawSVG) |
| `@gsap/react` | 2.1.2 | gsap ^3.12.5, react >=17 |
| `@react-spring/web` | 10.1.2 | React 16.8–19 |
| `animejs` | 4.5.0 | Named ESM exports; subpaths such as `animejs/svg` and `animejs/text` |
| `@formkit/auto-animate` | 0.10.0 | Import from `@formkit/auto-animate/react` |
| `lenis` | 1.3.27 | react >=17; import from `lenis/react` and load `lenis/dist/lenis.css` |
| `@theatre/core`, `@theatre/studio`, `@theatre/r3f` | 0.7.2 | Last release 2024-05; r3f needs fiber ^8 |
| `@rive-app/react-canvas`, `-canvas-lite`, `-webgl2` | 4.38.0 | React 16.8–19 |
| `@lottiefiles/dotlottie-react` | 0.20.0 | React 17–19; `/webgl` and `/webgpu` entry points |
| `lottie-react` | 3.1.2 | Still maintained; React ^18.2 or ^19 |
| `three` | 0.186.1 | Add `@types/three` for TypeScript |
| `@react-three/fiber` | 9.8.2 | react >=19 <19.4, three >=0.156 |
| `@react-three/drei` | 10.7.9 | React ^19, fiber ^9 |
| `@react-three/postprocessing` | 3.2.2 | fiber >=9.7, postprocessing ^6.36 |
| `@splinetool/react-spline` | 4.1.0 | Needs `@splinetool/runtime`; `/next` entry for Next.js |
| `ogl` | 1.0.11 | Unlicense |
| `@babylonjs/core` | 9.32.1 | Apache-2.0 |
| `react-babylonjs` | 4.0.2 | React >=19, Babylon >=8.32 <10 |
| `pixi.js` | 8.22.0 | |
| `@pixi/react` | 8.0.5 | React >=19; register components with `extend()` |
| `lucide-react` | 1.63.0 | React 16.5–19, ISC |
| `@phosphor-icons/react` | 2.1.10 | MIT |
| `shadcn` (CLI) | 4.23.0 | `npx shadcn@latest init` / `add` |
| `tailwindcss`, `@tailwindcss/vite` | 4.3.3 | Vite ^5.2, ^6, ^7 or ^8 |
| `radix-ui` | 1.8.1 | Unified package; scoped `@radix-ui/react-*` packages also exist |
| `@base-ui/react` | 1.9.0 | Replaces the deprecated `@base-ui-components/react` |
| `vite` / `create-vite` | 8.3.5 / 9.3.3 | Template `react-ts` confirmed |
| `vitest` | 5.0.5 | Vite ^6.4, ^7 or ^8 |
| `@testing-library/react` | 16.3.3 | Also install `@testing-library/dom` ^10 |
| `@playwright/test` | 1.64.1 | |
| `jsdom` | 30.1.3 | |
