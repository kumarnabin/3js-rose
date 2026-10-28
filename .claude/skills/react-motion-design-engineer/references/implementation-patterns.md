# Implementation Patterns

Reusable building blocks for animated React + TypeScript UIs. Adapt names, paths and styling to the host project. Before pasting, confirm the installed `motion` version exposes the APIs used here (check `node_modules/motion/package.json` and the official docs at https://motion.dev/docs/react).

## Contents

1. Motion tokens (TS + CSS)
2. MotionPreferenceProvider (system + user override)
3. AnimatedButton
4. RevealOnScroll
5. StaggeredList
6. AnimatedCounter
7. AnimatedModal (Radix Dialog + Motion)
8. AnimatedDrawer
9. PageTransition (React Router)
10. SpotlightCard (pointer-driven, no React state)
11. Animated navigation indicator (shared layout)
12. GSAP timeline inside React
13. Bundle-size options (LazyMotion)
14. Anti-patterns

---

## 1. Motion tokens

One module owns every duration, easing curve, spring and stagger step. Components import from it; nothing hard-codes `0.37`.

```ts
// src/lib/motion-tokens.ts
import type { Transition } from "motion/react";

type Bezier = [number, number, number, number];

/** Seconds — Motion uses seconds, CSS uses ms (see tokens.css). */
export const duration = {
  instant: 0.1,    // state toggles, checkbox ticks
  fast: 0.15,      // hover/press feedback
  base: 0.25,      // standard UI transitions (menus, tabs, tooltips)
  emphasized: 0.4, // entrances, modals, page sections
  slow: 0.6,       // hero / storytelling only — never on routine workflows
} as const;

export const ease: Record<"standard" | "enter" | "exit" | "linear", Bezier> = {
  standard: [0.2, 0, 0, 1],      // most transitions
  enter: [0.05, 0.7, 0.1, 1],    // decelerate into place
  exit: [0.3, 0, 0.8, 0.15],     // accelerate away
  linear: [0, 0, 1, 1],          // scroll-linked / progress only
};

export const spring = {
  press: { type: "spring", stiffness: 600, damping: 35 },          // buttons, toggles
  snappy: { type: "spring", stiffness: 400, damping: 32 },         // layout shifts, indicators
  gentle: { type: "spring", visualDuration: 0.45, bounce: 0.15 },  // cards, drag release
} satisfies Record<string, Transition>;

/** Seconds between siblings. Keep total stagger under ~0.5s. */
export const staggerStep = { tight: 0.03, base: 0.06, loose: 0.1 } as const;

export const transition = {
  fast: { duration: duration.fast, ease: ease.standard },
  base: { duration: duration.base, ease: ease.standard },
  enter: { duration: duration.emphasized, ease: ease.enter },
  exit: { duration: duration.base, ease: ease.exit },
} satisfies Record<string, Transition>;
```

Mirror the values for CSS transitions so CSS and JS motion feel like one system:

```css
/* src/styles/tokens.css */
:root {
  --dur-instant: 100ms;
  --dur-fast: 150ms;
  --dur-base: 250ms;
  --dur-emphasized: 400ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-enter: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-exit: cubic-bezier(0.3, 0, 0.8, 0.15);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-fast: 0ms;
    --dur-base: 0ms;
    --dur-emphasized: 0ms;
  }
}
/* User override set by MotionPreferenceProvider */
:root[data-motion="reduce"] {
  --dur-fast: 0ms;
  --dur-base: 0ms;
  --dur-emphasized: 0ms;
}
```

With Tailwind v4 the easing curves can also live in `@theme` (`--ease-standard: cubic-bezier(...)` produces an `ease-standard` utility). Keep durations as CSS variables and use `duration-(--dur-fast)` (v4 syntax) or the project's existing convention.

## 2. MotionPreferenceProvider

`<MotionConfig reducedMotion="user">` makes every Motion component follow the OS setting: transform and layout animations are disabled while opacity and colour still animate. The provider below adds an optional in-app override and exposes the result to non-Motion code (GSAP, canvas, CSS).

```tsx
// src/providers/motion-preference.tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { transition } from "@/lib/motion-tokens";

type Preference = "system" | "reduce" | "full";

type Ctx = {
  preference: Preference;
  setPreference: (p: Preference) => void;
  /** Effective answer for non-Motion code (GSAP, canvas loops, autoplay video). */
  reduced: boolean;
};

const MotionPreferenceContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "motion-preference";

function readStored(): Preference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "reduce" || v === "full" ? v : "system";
  } catch {
    return "system";
  }
}

export function MotionPreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<Preference>(readStored);
  const systemReduced = useReducedMotion() ?? false;
  const reduced = preference === "reduce" || (preference === "system" && systemReduced);

  const setPreference = (p: Preference) => {
    setPreferenceState(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* storage unavailable — keep in memory only */
    }
  };

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduce" : "full";
  }, [reduced]);

  const value = useMemo(() => ({ preference, setPreference, reduced }), [preference, reduced]);

  return (
    <MotionPreferenceContext.Provider value={value}>
      <MotionConfig
        reducedMotion={preference === "system" ? "user" : preference === "reduce" ? "always" : "never"}
        transition={transition.base}
      >
        {children}
      </MotionConfig>
    </MotionPreferenceContext.Provider>
  );
}

export function useMotionPreference() {
  const ctx = useContext(MotionPreferenceContext);
  if (!ctx) throw new Error("useMotionPreference must be used inside MotionPreferenceProvider");
  return ctx;
}
```

If the product has no settings UI, skip the context and just wrap the app in `<MotionConfig reducedMotion="user">`.

## 3. AnimatedButton

CSS handles colour and shadow; Motion adds press feedback only. With shadcn/ui, wrap the existing `Button` instead of creating a new one.

```tsx
// src/components/motion/animated-button.tsx
import { motion, type HTMLMotionProps } from "motion/react";
import { spring } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

type AnimatedButtonProps = HTMLMotionProps<"button"> & { loading?: boolean };

export function AnimatedButton({ className, loading = false, disabled, children, ...props }: AnimatedButtonProps) {
  const inactive = disabled || loading;
  return (
    <motion.button
      whileTap={inactive ? undefined : { scale: 0.97 }}
      transition={spring.press}
      disabled={inactive}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 font-medium",
        "bg-primary text-primary-foreground transition-colors duration-(--dur-fast)",
        "hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
```

Wrapping a shadcn component instead: `const MotionButton = motion.create(Button);` (the component must forward its ref — shadcn components do).

## 4. RevealOnScroll

```tsx
// src/components/motion/reveal-on-scroll.tsx
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { transition } from "@/lib/motion-tokens";

type RevealOnScrollProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Distance in px the element travels upward. Ignored under reduced motion. */
  offset?: number;
  once?: boolean;
};

export function RevealOnScroll({ children, className, delay = 0, offset = 16, once = true }: RevealOnScrollProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: offset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.3 }}
      transition={{ ...transition.enter, delay }}
    >
      {children}
    </motion.div>
  );
}
```

Rules: never wrap above-the-fold content (it delays LCP and flashes on load); never wrap content that must be readable when JS fails in an SSR app; keep `offset` small (8–24 px).

## 5. StaggeredList

Current Motion docs stagger children via `delayChildren: stagger(step)` on the parent variant. Older code uses `staggerChildren: step`; prefer the documented form for the installed version.

```tsx
// src/components/motion/staggered-list.tsx
import { motion, stagger, type Variants } from "motion/react";
import type { ReactNode } from "react";
import { staggerStep, transition } from "@/lib/motion-tokens";

const list: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: stagger(staggerStep.base) } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transition.enter },
};

export function StaggeredList<T>({
  items,
  getKey,
  renderItem,
  className,
}: {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  className?: string;
}) {
  return (
    <motion.ul className={className} variants={list} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
      {items.map((it) => (
        <motion.li key={getKey(it)} variants={item}>
          {renderItem(it)}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

Stagger only the first ~8–12 visible items; long lists should appear at once. For add/remove/reorder in live data, use `layout` + `AnimatePresence`, or AutoAnimate.

## 6. AnimatedCounter

Motion values update the DOM without re-rendering React. Screen readers get the final value immediately.

```tsx
// src/components/motion/animated-counter.tsx
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { ease } from "@/lib/motion-tokens";

const defaultFormat = (n: number) => Math.round(n).toLocaleString();

export function AnimatedCounter({ value, format = defaultFormat, durationSec = 1.2 }: {
  value: number;
  format?: (n: number) => string;
  durationSec?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, format);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: durationSec, ease: ease.enter });
    return () => controls.stop();
  }, [inView, reduce, value, durationSec, mv]);

  return (
    <span ref={ref} className="tabular-nums">
      <motion.span aria-hidden="true">{text}</motion.span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
```

`tabular-nums` prevents width jitter while digits change.

## 7. AnimatedModal (Radix Dialog + Motion)

If the project uses shadcn/ui, its `Dialog` already animates via `data-state` CSS classes — use it as is and only tune the classes. Do not layer Motion over it. Use the pattern below only when Motion-driven exit animations are required.

Radix ships both as scoped packages (`@radix-ui/react-dialog`) and a unified `radix-ui` package; match whichever the project already uses.

```tsx
// src/components/motion/animated-modal.tsx
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { transition } from "@/lib/motion-tokens";

export function AnimatedModal({ open, onOpenChange, title, description, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition.base}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed left-1/2 top-1/2 w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background p-6 shadow-lg focus:outline-none"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1, transition: transition.enter }}
                exit={{ opacity: 0, scale: 0.98, transition: transition.exit }}
              >
                <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                {description && <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description>}
                <div className="mt-4">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
```

Caveat: Motion animates `transform`, which overrides Tailwind's `-translate-*` classes on the same element. Centre with a flex wrapper or `inset-0 m-auto h-fit` instead if positioning breaks. Radix supplies focus trap, `Esc`, scroll lock and focus return — keep them.

## 8. AnimatedDrawer

Same structure as the modal; animate `x` from `"100%"` to `0` on a `fixed inset-y-0 right-0` panel. Under reduced motion Motion skips the slide and keeps the fade. For mobile bottom sheets with drag-to-dismiss use `drag="y"`, `dragConstraints={{ top: 0 }}` and close in `onDragEnd` when `info.offset.y` or `info.velocity.y` passes a threshold. Always keep a visible close button; drag is never the only way out. If the project uses shadcn's `Drawer` (built on Vaul) or `Sheet`, use those.

## 9. PageTransition (React Router)

Exiting routes must keep rendering their *old* outlet, so freeze it per mount:

```tsx
// src/components/motion/animated-outlet.tsx
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useLocation, useOutlet } from "react-router";
import { transition } from "@/lib/motion-tokens";

function FrozenOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

export function AnimatedOutlet() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0, transition: transition.enter }}
        exit={{ opacity: 0, transition: { duration: 0.12 } }}
      >
        <FrozenOutlet />
      </motion.div>
    </AnimatePresence>
  );
}
```

Import from `react-router-dom` on React Router v6. Keep route transitions short (exit ≤ 150 ms) so navigation never feels slow. After navigation, move focus to the new page's `<h1>` (or `main`) and restore scroll. The View Transitions API is an alternative — see [scroll-and-transitions.md](scroll-and-transitions.md).

## 10. SpotlightCard

Pointer position goes into CSS variables, so moving the mouse never re-renders React.

```tsx
// src/components/motion/spotlight-card.tsx
import type { PointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
  }
  return (
    <div
      onPointerMove={onPointerMove}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-6",
        "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-(--dur-base)",
        "before:bg-[radial-gradient(320px_circle_at_var(--spot-x)_var(--spot-y),color-mix(in_oklab,var(--color-primary)_14%,transparent),transparent_70%)]",
        "hover:before:opacity-100", // Tailwind v4 `hover:` only applies on (hover: hover) devices; on v3 add that media guard
        className,
      )}
    >
      {children}
    </div>
  );
}
```

Decorative only: the card must look complete without the spotlight, which never appears on touch-only devices.

## 11. Animated navigation indicator

```tsx
import { motion } from "motion/react";
import { spring } from "@/lib/motion-tokens";

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="relative flex gap-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className="relative px-3 py-1.5 text-sm"
        >
          {active === t.id && (
            <motion.span layoutId="tab-indicator" transition={spring.snappy} className="absolute inset-0 -z-10 rounded-md bg-muted" />
          )}
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

Full ARIA tabs also need arrow-key navigation and `tabpanel` wiring — prefer Radix/shadcn `Tabs` and add only the `layoutId` indicator. If two instances render at once, wrap each in `<LayoutGroup id="...">` so `layoutId`s do not collide.

## 12. GSAP timeline inside React

```tsx
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function HeroIntro() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ defaults: { ease: "power3.out", duration: 0.6 } })
          .from("[data-anim=title]", { y: 24, opacity: 0 })
          .from("[data-anim=sub]", { y: 16, opacity: 0 }, "-=0.35")
          .from("[data-anim=cta]", { y: 12, opacity: 0, stagger: 0.08 }, "-=0.3");
      });
      // Reduced motion: no tweens; elements render in their final state.
    },
    { scope },
  );

  return (
    <div ref={scope}>
      <h1 data-anim="title">…</h1>
      <p data-anim="sub">…</p>
      <a data-anim="cta" href="#start">Start</a>
    </div>
  );
}
```

`useGSAP` reverts every tween created inside it on unmount (StrictMode-safe). Selector strings are scoped to `scope`. For event-handler animations use `const { contextSafe } = useGSAP({ scope })` and wrap handlers in `contextSafe`.

## 13. Bundle-size options

Motion's `motion` component includes all features. For bundle-sensitive pages, use `LazyMotion` with the `m` component and load `domAnimation` (or `domMax` for drag/layout) — see https://motion.dev/docs/react-reduce-bundle-size for current import paths. Adopt it project-wide or not at all; with `strict`, any leftover `motion.*` throws.

## 14. Anti-patterns

- `useState` updated in `requestAnimationFrame`, scroll or pointer handlers to drive styles → use motion values, CSS variables or refs.
- Motion and GSAP (or CSS transitions) on the same property of the same element.
- `transition: all` in CSS — list the properties.
- `will-change` left permanently on many elements.
- Animating `width`, `height`, `top`, `left` or `box-shadow` on large or many elements — animate `transform`/`opacity`, or use Motion `layout`.
- Entrance animations on every element of every section.
- Re-running intro animations on every route visit (`once: true`, or animate only on first load).
- Wrapping a whole page in one giant `motion.div` with `layout`.
