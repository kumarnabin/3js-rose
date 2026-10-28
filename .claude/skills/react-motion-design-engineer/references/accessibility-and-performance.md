# Accessibility and Performance

Read this for every Audit and before reporting any animated or 3D work as done.

## Contents

1. Reduced motion strategy
2. Motion-related WCAG criteria
3. Keyboard, focus and semantics
4. Colour, contrast and readable motion
5. Animation performance rules
6. React rendering performance
7. Loading and bundle performance
8. Measuring (what to actually run)
9. Verification script for Playwright

---

## 1. Reduced motion strategy

`prefers-reduced-motion: reduce` means "minimise non-essential motion", not "remove all feedback".

| Original effect | Reduced alternative |
|---|---|
| Slide / scale / rotate entrance | Opacity fade ≤ 200 ms, or instant |
| Parallax, scroll-scrubbed transforms | Static layout |
| Pinned scroll storytelling | Normal-flow sections showing each step's end state |
| Auto-playing carousel / marquee | Paused, with manual controls |
| Animated counters | Final value immediately |
| Page transitions | Crossfade or instant |
| Background video / ambient 3D motion | Poster frame or static render; user can opt in |
| Smooth scrolling (Lenis) | Native scrolling |
| Hover lift / tilt | Colour or outline change |

Implementation by system:

- **Motion**: `<MotionConfig reducedMotion="user">` at the root. Per-component logic: `useReducedMotion()`.
- **GSAP**: create tweens inside `gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", …)`.
- **CSS**: `@media (prefers-reduced-motion: reduce)` or Tailwind `motion-safe:` / `motion-reduce:` variants.
- **R3F / canvas**: read the preference; set `frameloop="demand"` and stop ambient `useFrame` motion.
- **Lenis**: do not initialise when reduced.
- **Lottie / Rive / video**: do not autoplay; show first or last frame.

Essential motion (e.g. a progress indicator) may remain but should be simplified.

## 2. Motion-related WCAG criteria

| Criterion | Requirement | Typical failure |
|---|---|---|
| 2.2.2 Pause, Stop, Hide (A) | Anything that moves for > 5 s alongside other content needs a pause/stop/hide control | Infinite marquees, looping hero animations |
| 2.3.1 Three Flashes (A) | Nothing flashes more than 3 times per second | Strobing glitch effects |
| 2.3.3 Animation from Interactions (AAA, but treat as required) | Interaction-triggered motion can be disabled | Parallax with no reduced-motion path |
| 2.4.7 / 2.4.11 Focus Visible / Not Obscured | Focus is visible and not hidden by sticky or animated layers | Sticky headers covering focused items |
| 1.4.3 / 1.4.11 Contrast | 4.5:1 text, 3:1 large text and UI components | Text over animated gradients or video |
| 2.5.7 Dragging Movements (AA) | Every drag action has a single-pointer alternative | Drag-only reorder or bottom sheet |
| 2.5.8 Target Size (AA) | Targets ≥ 24×24 CSS px | Tiny icon buttons |

## 3. Keyboard, focus and semantics

- Buttons are `<button>`, links are `<a href>`. Never put click handlers on `div`s.
- Dialogs, drawers, menus, popovers, tabs, comboboxes: use Radix / shadcn primitives — they handle focus trap, `Esc`, arrow keys, `aria-*` and focus return.
- Focus moves into a dialog on open and returns to the trigger on close. After a route change, move focus to the new `<h1>` or `<main>`.
- Content hidden off-canvas or mid-animation must not be focusable (`inert` or unmount).
- Every animated region still has a meaningful reading order without CSS.
- Icon-only buttons need `aria-label`; decorative icons and canvases need `aria-hidden="true"`.
- Status changes animated visually (toast, saved tick) also need an `aria-live` announcement.
- 3D / canvas content: provide an accessible equivalent (text description, controls as real buttons, data in a table).

## 4. Colour, contrast and readable motion

- Check contrast for every state: hover, disabled, selected, text over images or gradients — at the darkest *and* lightest frame of any animated background.
- Do not encode meaning only by colour or only by motion.
- Text must never animate letter-by-letter so slowly that reading is delayed; split-text reveals finish within ~600 ms and the full text is in the DOM for screen readers (`aria-label` on the container or `aria-hidden` on the split spans plus a visually hidden copy).

## 5. Animation performance rules

- Animate compositor-friendly properties: `transform`, `opacity`, `filter` (sparingly), `clip-path` (moderately).
- Avoid animating `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size`, `box-shadow` on many or large elements. Use Motion's `layout` prop (FLIP) for size and position changes.
- Large `backdrop-filter: blur()` areas and big blurred gradients are GPU-expensive, especially on low-end mobile; limit their size and count.
- Do not read layout (`getBoundingClientRect`, `offsetHeight`) and write styles in the same frame in a loop (layout thrashing). Batch reads, then writes.
- `will-change` only on elements about to animate; remove afterwards.
- Pause offscreen work: IntersectionObserver for loops, `frameloop="demand"` or unmounting for offscreen canvases, `document.visibilityState` for background tabs.
- Scroll listeners: passive only, or use Motion `useScroll` / GSAP ScrollTrigger which batch for you.
- Test on a throttled CPU (DevTools 4× slowdown) — a 60 fps laptop hides problems a mid-range phone will show.

## 6. React rendering performance

- Never put per-frame values in React state. Use `useMotionValue`, `useTransform`, `useSpring`, refs, CSS variables, or R3F `useFrame` mutation.
- Keep animated leaf components small so a parent re-render does not reset or re-trigger animation.
- Stable `key`s on animated lists; index keys break exit and layout animations.
- Memoise expensive children only after measuring with the React Profiler; don't sprinkle `memo` blindly.
- Context that changes often (pointer position, scroll) must not wrap large trees.

## 7. Loading and bundle performance

- Code-split heavy features: `const Scene = lazy(() => import("./scene"))`, Lottie/Rive players, GSAP plugins used on one page.
- Do not block LCP with entrance animations; the LCP element should render visible immediately.
- Reserve space for lazy media (aspect-ratio boxes) to avoid CLS.
- Compress 3D assets (glTF + Draco/Meshopt, KTX2 textures), size textures to their on-screen use.
- Fonts: subset, `font-display: swap`, preload only the one or two critical files.
- Check the bundle: `npx vite-bundle-visualizer` or `rollup-plugin-visualizer` (verify current package before installing).
- INP: keep event handlers light; animation start must not wait on heavy synchronous work.

## 8. Measuring (what to actually run)

Use what exists in the project first (`npm run build`, `npm run typecheck`, `npm test`, `npx playwright test`). Then, when a browser is available:

1. DevTools Performance panel: record a scroll and an interaction; look for long tasks, forced reflows, frames over 16 ms.
2. Rendering panel: Paint flashing, Layer borders, FPS meter; emulate `prefers-reduced-motion`.
3. Lighthouse (mobile) for LCP, CLS, TBT; note it does not measure animation smoothness.
4. React DevTools Profiler: confirm animations don't trigger component re-renders.
5. For R3F: `r3f-perf` or `stats-gl` overlay (dev only) for draw calls, triangles, GPU time.

Report the actual numbers or observations. If a check could not be run, say so.

## 9. Verification script for Playwright

```ts
// e2e/motion-a11y.spec.ts — adapt URL and selectors
import { test, expect } from "@playwright/test";

test.describe("motion & a11y smoke", () => {
  test("no console errors, desktop + mobile", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await page.mouse.wheel(0, 4000);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `test-results/home-${viewport.width}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });

  test("reduced motion renders final state", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("opacity", "1");
  });

  test("keyboard reaches primary CTA", async ({ page }) => {
    await page.goto("/");
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const name = await page.evaluate(() => document.activeElement?.textContent?.trim());
      if (name && /get started|start/i.test(name)) return;
    }
    throw new Error("Primary CTA not reachable by keyboard within 15 tabs");
  });
});
```

For automated a11y rules add `@axe-core/playwright` (verify the current package name) and assert no serious violations.
