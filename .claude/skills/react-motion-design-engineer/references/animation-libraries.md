# Animation Libraries

How to choose and use each animation tool in React. Package names, imports and licence notes were checked on 2026-10-28 (see [resource-catalog.md](resource-catalog.md)). APIs change, so confirm against the official docs or the installed package's types before writing code.

## Contents

1. Decision guide
2. CSS transitions and keyframes
3. Motion for React
4. GSAP
5. React Spring
6. Anime.js
7. AutoAnimate
8. Theatre.js
9. Rive
10. Lottie / dotLottie
11. Combining libraries safely

---

## 1. Decision guide

Work down the list and stop at the first tool that does the job.

| Requirement | Tool | Why |
|---|---|---|
| Hover, focus, colour or opacity change; simple keyframe loop | **CSS** | No JavaScript, runs on the compositor, easy reduced-motion handling |
| List items added, removed or reordered, with no design spec | **AutoAnimate** | One hook, zero configuration |
| Enter/exit, layout and shared-element transitions, gestures (hover, tap, drag), scroll reveals, staggers, springs | **Motion for React** | React-native API, `AnimatePresence`, `layout`/`layoutId`, motion values |
| Multi-step timelines, scroll pinning and scrubbing, SVG morphing, split-text choreography, precise sequencing | **GSAP** (+ ScrollTrigger, SplitText, etc.) | Timeline control, mature scroll tooling, plugins |
| Interactions whose character is physics (drag release, gesture-driven cards) in a codebase already using it | **React Spring** | Spring-first API; with `@use-gesture` |
| Lightweight imperative animation of DOM/SVG/JS objects outside React's model | **Anime.js** | Small, flexible timeline engine |
| Designer-authored, interactive, state-driven vector animation (animated icons, characters, onboarding) | **Rive** | State machines and runtime inputs |
| Designer-authored playback animation exported from After Effects | **Lottie / dotLottie** | Large ecosystem of files |
| Visual keyframe editing of complex sequences, especially 3D cameras | **Theatre.js** (legacy) | Studio editor, but development has stalled. See §8 |

If the project already uses one of these, prefer extending it over adding another. Do not add GSAP for something Motion already in the project can do, or the reverse.

## 2. CSS transitions and keyframes

```css
.card {
  transition: transform var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard);
}
@media (hover: hover) {
  .card:hover { transform: translateY(-2px); }
}
```

- List the transitioned properties; never `transition: all`.
- Tailwind: `transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none`.
- `@starting-style` and `transition-behavior: allow-discrete` can animate elements entering from `display: none` in modern browsers; use as progressive enhancement.

## 3. Motion for React

- Site and docs: https://motion.dev/docs/react
- Install `motion` (v14 on 2026-10-28; supports React 18 and 19) and import from `motion/react`. Other entry points are `motion/react-m` (for LazyMotion), `motion/react-mini` and `motion/react-client` (for Next.js server-component files). The `framer-motion` package is the older name for the same library. Projects already on `framer-motion` can keep it; migrating is a separate, explicit change.
- Licence: MIT. Motion+ is a separate paid offering with extra components and examples.

Core API:

```tsx
import { motion, AnimatePresence, MotionConfig, useReducedMotion, useScroll, useTransform,
  useMotionValue, useSpring, useInView, LayoutGroup, stagger, animate } from "motion/react";

<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} />
<motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} />
<motion.li layout />                         // animate own layout changes (FLIP)
<motion.span layoutId="indicator" />         // shared element between renders
<motion.div drag="x" dragConstraints={{ left: -100, right: 0 }} />
<motion.section whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.3 }} />
```

- Variants propagate through children; stagger with `transition: { delayChildren: stagger(0.06) }` on the parent (current docs) or `staggerChildren` in older versions.
- Wrap custom components with `motion.create(Component)`; the component must forward its ref.
- `AnimatePresence` needs a direct child with a stable, unique `key` per state. Use `mode="wait"` for sequential swaps and `mode="popLayout"` together with `layout` lists.
- Springs: `{ type: "spring", stiffness, damping }`, or `{ type: "spring", visualDuration, bounce }`, which is easier to reason about.
- Motion values (`useMotionValue`, `useTransform`, `useSpring`, `useScroll`) update styles without re-rendering React.
- Reduced motion: `<MotionConfig reducedMotion="user">` at the root disables transform and layout animation and keeps opacity and colour.
- Bundle size: `LazyMotion` + `m` components. See [implementation-patterns.md](implementation-patterns.md) §13.

Pitfalls: animating `height: "auto"` works, but it lays out every frame, so keep it to small elements. Avoid `layout` on huge subtrees. Elements with `layout` inside scrollable containers need `layoutScroll` on the container. Elements inside fixed containers need `layoutRoot`.

## 4. GSAP

- Site and docs: https://gsap.com/docs/v3/ — React guide: https://gsap.com/resources/React/
- Install `gsap` and `@gsap/react`. All plugins ship in the public `gsap` npm package, and the old private registry is no longer maintained. `import gsap from "gsap"` (or `import { gsap } from "gsap"`), `import { ScrollTrigger } from "gsap/ScrollTrigger"`, `import { useGSAP } from "@gsap/react"`, then `gsap.registerPlugin(useGSAP, ScrollTrigger)`.
- Licence: since Webflow acquired GSAP, all of it, including formerly paid "Club" plugins such as SplitText, MorphSVG, ScrollSmoother and DrawSVG, is free under GSAP's own "standard no-charge" licence. That licence is **not** an OSI open-source licence and restricts some uses. Read https://gsap.com/standard-license before using GSAP in a product that competes with Webflow, such as a visual animation builder.

React rules:

- Always create tweens inside `useGSAP(() => { … }, { scope })`. It reverts them on unmount and handles StrictMode's double effects.
- Pass `dependencies` and `revertOnUpdate: true` when a tween must rebuild after props change.
- Event handlers that create tweens use `contextSafe` from `useGSAP`.
- Use selector strings scoped by `scope`, or refs. Never query the whole document.
- Reduced motion and breakpoints: `gsap.matchMedia()` inside `useGSAP`.
- Do not let GSAP and Motion (or CSS transitions) animate the same property on the same element. Remove CSS `transition` from elements GSAP tweens.

Useful plugins: ScrollTrigger (pin and scrub), SplitText (text reveals; keep accessible text), Flip (layout transitions outside Motion), MorphSVG and DrawSVG (SVG), Observer (normalised wheel, touch and pointer input). Examples: [scroll-and-transitions.md](scroll-and-transitions.md) and [implementation-patterns.md](implementation-patterns.md) §12.

## 5. React Spring

- Docs: https://www.react-spring.dev/
- Package `@react-spring/web` for the DOM (v10 on 2026-10-28; peers cover React 16.8 through 19). It provides `animated` components plus `useSpring`, `useSprings`, `useTrail`, `useTransition` and `useChain`.
- Pairs with `@use-gesture/react` for drag and pinch interactions.

```tsx
import { animated, useSpring } from "@react-spring/web";
const [style, api] = useSpring(() => ({ x: 0, config: { tension: 300, friction: 26 } }));
<animated.div style={style} onPointerDown={() => api.start({ x: 100 })} />
```

- Reduced motion: `Globals.assign({ skipAnimation: true })` when the user prefers reduced motion, or the library's reduced-motion hook if the installed version has one.
- Use React Spring when the project already does, or when physics-driven interaction is central. Otherwise Motion's springs cover most needs.

## 6. Anime.js

- Docs: https://animejs.com/documentation/ — v4 uses named ES module exports: `import { animate, createTimeline, stagger, createScope } from "animejs"`. Snippets for v3 (`anime({...})` default export) are outdated.
- In React, create animations inside `useEffect` using `createScope({ root: ref })` and call `scope.revert()` in the cleanup.
- Licence: MIT.
- Choose it for small, imperative effects in projects that do not already use Motion or GSAP. Otherwise use the library that is already installed.

## 7. AutoAnimate

- Docs: https://auto-animate.formkit.com/
- `import { useAutoAnimate } from "@formkit/auto-animate/react"`, then `const [parent] = useAutoAnimate(); <ul ref={parent}>…</ul>`.
- Animates add, remove and move for direct children. It respects `prefers-reduced-motion` by default.
- Use it for todo lists, filters and form field arrays. Don't combine it with Motion `layout` on the same list.

## 8. Theatre.js

- Site: https://www.theatrejs.com/
- Packages: `@theatre/core` (runtime), `@theatre/studio` (editor, dev only), `@theatre/r3f` (R3F integration).
- It gives you a visual timeline editor for keyframing DOM, three.js or R3F properties. You export state as JSON and play it back with core.
- **Maintenance (checked 2026-10-28): stalled.** All packages were last released at 0.7.2 in May 2024. `@theatre/r3f` requires `@react-three/fiber` ^8, so it doesn't work with R3F v9 or React 19. Don't adopt it in new projects unless the user explicitly wants it and accepts that risk. Use GSAP timelines (or hand-authored `useFrame` sequences for 3D) instead. Keep it only where it already exists.
- Licence: core is Apache-2.0 and studio is AGPL-3.0, so ship only core in production.

## 9. Rive

- Site: https://rive.app/ — React runtime docs: https://rive.app/docs/runtimes/react/react
- Renderer packages: `@rive-app/react-canvas`, `@rive-app/react-canvas-lite` and `@rive-app/react-webgl2`. All three share the `useRive` API. Current Rive docs examples use `react-webgl2` and explain the trade-offs on a "Choosing a Renderer" page, so read that page before picking one. The example below uses `react-canvas`. To use another renderer, change only the import path.

```tsx
import { useRive, useStateMachineInput } from "@rive-app/react-canvas";
const { rive, RiveComponent } = useRive({ src: "/anim/toggle.riv", stateMachines: "Main", autoplay: true });
const isOn = useStateMachineInput(rive, "Main", "isOn");
<RiveComponent aria-hidden="true" className="size-12" />
```

- Licence: the runtimes are MIT. The Rive editor is a commercial SaaS. Every `.riv` file has its own licence (check community files).
- Lazy-load the runtime. Under reduced motion, pause and show a static state. Expose a real button for any interaction the animation responds to.

## 10. Lottie / dotLottie

- Site: https://lottiefiles.com/
- Default React player for new work: `@lottiefiles/dotlottie-react`, LottieFiles' own dotLottie player. It plays `.lottie` and `.json` files and also has `/webgl` and `/webgpu` entry points.

```tsx
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
<DotLottieReact src="/anim/success.lottie" loop={false} autoplay={!reduced} />
```

- `lottie-react`, a wrapper around `lottie-web`, is still maintained and supports React 18 and 19. Keep it when the project already uses it.
- Lottie files can be large and CPU-heavy (SVG renderer). Prefer dotLottie (compressed), keep animations short, and lazy-load the player.
- Every animation on LottieFiles has its own licence. Check it per file before commercial use.
- Under reduced motion, show the final frame and don't autoplay.

## 11. Combining libraries safely

- One owner per element and property. Motion owns component enter, exit and layout. GSAP owns pinned or scrubbed sections. CSS owns hover and colour.
- GSAP and Motion can share a page, but not an element's `transform`.
- Remove CSS `transition` from any element a JS library animates.
- Lenis with GSAP: drive Lenis from `gsap.ticker` (see [scroll-and-transitions.md](scroll-and-transitions.md) §6).
- Load heavy or rare libraries (GSAP plugins, Rive, Lottie, Theatre) only on the routes that use them.
- Write down the ownership in the motion spec ([templates/animation-specification.md](../templates/animation-specification.md)).
