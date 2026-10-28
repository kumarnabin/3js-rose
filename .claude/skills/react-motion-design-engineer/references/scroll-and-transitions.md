# Scroll Effects and Transitions

## Contents

1. Choosing a scroll technique
2. Scroll-triggered reveals (Motion)
3. Scroll-linked values and parallax (Motion)
4. Pinning and scrubbed timelines (GSAP ScrollTrigger)
5. CSS scroll-driven animations
6. Smooth scrolling with Lenis (only when justified)
7. Route and page transitions
8. View Transitions API
9. Shared-element / layout transitions
10. Scroll hijacking rules

---

## 1. Choosing a scroll technique

| Need | Use |
|---|---|
| Element fades/slides in once when visible | Motion `whileInView` (or IntersectionObserver + CSS class) |
| Value follows scroll position (progress bar, gentle parallax) | Motion `useScroll` + `useTransform`, or CSS scroll-driven animation |
| Section pins while a multi-step timeline scrubs | GSAP ScrollTrigger (`pin`, `scrub`) |
| Snap between full-screen panels | CSS `scroll-snap-type` first; JS only if needed |
| Smoother wheel/trackpad feel for scrubbed sequences | Lenis, integrated with ScrollTrigger |
| Horizontal scroll section driven by vertical scroll | GSAP ScrollTrigger pin + `x` tween; provide a non-pinned mobile layout |

Default to the simplest row that works. Do not combine Motion `useScroll` and ScrollTrigger on the same element.

## 2. Scroll-triggered reveals (Motion)

Use `RevealOnScroll` / `StaggeredList` from [implementation-patterns.md](implementation-patterns.md). Guidelines:

- `viewport={{ once: true, amount: 0.2–0.4 }}` — reveal once; repeated reveals while scrolling up are distracting.
- Animate small offsets (8–24 px) and opacity; no rotation/scale on body content.
- Never hide content needed for SEO/no-JS behind initial `opacity: 0` in SSR apps without a fallback.

## 3. Scroll-linked values and parallax (Motion)

```tsx
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useRef } from "react";

export function ParallaxImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-8%", "8%"]);

  return (
    <div ref={ref} className="relative aspect-[16/10] overflow-hidden rounded-xl">
      <motion.img src={src} alt={alt} style={{ y, scale: 1.18 }} className="absolute inset-0 size-full object-cover" />
    </div>
  );
}
```

- Motion values update outside React render — no re-renders while scrolling.
- Keep parallax subtle (≤ 10% travel). Scale the image up so edges never show.
- Reading progress bar: `const { scrollYProgress } = useScroll();` → `<motion.div style={{ scaleX: scrollYProgress, transformOrigin: "0% 50%" }} />`.

## 4. Pinning and scrubbed timelines (GSAP ScrollTrigger)

```tsx
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function FeatureStory() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        const steps = gsap.utils.toArray<HTMLElement>("[data-step]");
        const tl = gsap.timeline({
          scrollTrigger: { trigger: root.current, start: "top top", end: `+=${steps.length * 100}%`, pin: true, scrub: 0.5 },
        });
        steps.forEach((step, i) => {
          if (i > 0) tl.from(step, { autoAlpha: 0, y: 40 }, i);
          if (i < steps.length - 1) tl.to(step, { autoAlpha: 0, y: -40 }, i + 0.8);
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative md:h-svh">
      {/* Each step is a normal stacked block on mobile / reduced motion, and absolutely layered on desktop. */}
      <div className="md:relative md:h-full">
        <article data-step className="md:absolute md:inset-0 …">…</article>
        <article data-step className="md:absolute md:inset-0 …">…</article>
        <article data-step className="md:absolute md:inset-0 …">…</article>
      </div>
    </section>
  );
}
```

Rules:

- Build the non-pinned layout first (mobile + reduced motion); pinning is an enhancement layered on with `matchMedia`.
- `useGSAP` reverts triggers on unmount. After layout changes (images load, fonts swap, accordion opens) call `ScrollTrigger.refresh()`.
- Do not pin inside containers with `transform` (breaks `position: fixed`) unless using `pinReparent` deliberately.
- Use `markers: true` only while developing.
- Total pinned distance per section ≤ ~3 viewports; users must not feel trapped.
- Keyboard and screen-reader users must still reach every step's content in DOM order.

## 5. CSS scroll-driven animations

`animation-timeline: view()` / `scroll()` runs scroll-linked animation off the main thread. Browser support is incomplete, so treat it as progressive enhancement:

```css
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .reveal {
      animation: reveal linear both;
      animation-timeline: view();
      animation-range: entry 0% cover 30%;
    }
  }
}
@keyframes reveal { from { opacity: 0; translate: 0 24px; } to { opacity: 1; translate: 0 0; } }
```

Check current support on MDN / caniuse before relying on it.

## 6. Smooth scrolling with Lenis (only when justified)

Justified: scrubbed or pinned storytelling where native wheel stepping looks choppy; immersive portfolio/editorial sites. Not justified: dashboards, docs, forms, e-commerce, most SaaS marketing.

Requirements when used: disable under reduced motion; keep native scroll on touch devices (Lenis' default); verify keyboard scrolling, anchor links, `position: sticky`, nested scroll containers (modals, code blocks) and browser find-in-page.

```tsx
// src/app/smooth-scroll.tsx — verify the API against https://lenis.dev/ and the lenis README.
// The package is `lenis`; the old `@studio-freight/react-lenis` is deprecated.
import { ReactLenis, type LenisRef } from "lenis/react";
import "lenis/dist/lenis.css";
import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMotionPreference } from "@/providers/motion-preference";

gsap.registerPlugin(ScrollTrigger);

export function SmoothScroll({ children }: { children: ReactNode }) {
  const { reduced } = useMotionPreference();
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    if (reduced) return;
    // drive Lenis from GSAP's ticker so ScrollTrigger and Lenis share one clock
    const update = (time: number) => lenisRef.current?.lenis?.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    const lenis = lenisRef.current?.lenis;
    lenis?.on("scroll", ScrollTrigger.update);
    return () => {
      gsap.ticker.remove(update);
      lenis?.off("scroll", ScrollTrigger.update);
    };
  }, [reduced]);

  if (reduced) return <>{children}</>;
  return (
    <ReactLenis root options={{ autoRaf: false }} ref={lenisRef}>
      {children}
    </ReactLenis>
  );
}
```

Without GSAP, omit the ticker code and leave `autoRaf` at its default.

## 7. Route and page transitions

- Prefer short crossfades (enter ≤ 300 ms, exit ≤ 150 ms). Users navigate a lot; slow transitions are a tax.
- Motion + React Router: `AnimatedOutlet` pattern in [implementation-patterns.md](implementation-patterns.md) (`AnimatePresence mode="wait"` + frozen outlet).
- After navigation: scroll to top (or restore on back), move focus to the new `<h1>`, update `document.title`.
- Do not animate the persistent layout (header/sidebar) — only the outlet.
- In Next.js App Router, exit animations need extra work; prefer the View Transitions API or enter-only animations.

## 8. View Transitions API

Browser-native snapshots and crossfades between DOM states, including shared-element morphs via `view-transition-name`.

```ts
import { flushSync } from "react-dom";

function navigateWithTransition(update: () => void) {
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }
  document.startViewTransition(() => flushSync(update));
}
```

- React Router supports a `viewTransition` prop on `Link`/`NavLink` in recent versions (check the installed version's docs).
- React's own `<ViewTransition>` component has been experimental; check its status in the React docs before using it.
- Style with `::view-transition-old(root)` / `::view-transition-new(root)`; name shared elements uniquely per page.
- Always feature-detect; unsupported browsers just update instantly.

## 9. Shared-element / layout transitions

- Motion `layoutId`: the same ID on two elements animates between them (tab indicators, card → detail). Wrap independent groups in `<LayoutGroup id>`.
- Motion `layout` on an element animates its own size/position changes via transforms (FLIP). Add `layout="position"` when only position should animate (avoids text distortion). Children that distort can take their own `layout` prop.
- Exit + layout: wrap conditionally rendered items in `<AnimatePresence mode="popLayout">` so siblings reflow smoothly.

## 10. Scroll hijacking rules

Do not: override native scroll speed by default, block scrolling during intros, require scroll-scrubbing to read content, convert vertical scroll to horizontal on mobile, or hide the scrollbar. If a pinned or scroll-driven sequence exists, it must be skippable (content readable without completing it), disabled on reduced motion, and simplified on touch devices.
