# Example: Animated SaaS Landing Page (Build mode)

## Request

> "Build a landing page for Tidewater, a tool that syncs Postgres to analytics warehouses. Make it feel premium with nice animations. React + Tailwind."

## A. Understand

- Audience: data engineers evaluating tools. They skim, distrust fluff, want proof (speed, connectors, pricing).
- Primary workflow: understand value → see it working → start free trial.
- New project → Build mode. No brand assets given → original placeholder wordmark, user to supply logo.
- Devices: desktop first in usage, but must be solid on mobile.

## B. Research

- Inspiration (checked live if browsing is available): developer-tool sites on Godly/Land-book. Extracted principles: dark neutral base, one vivid accent, product UI as the hero visual, monospace accents, sparse motion focused on product demo.
- Docs checked: Motion `whileInView`, `useScroll`; shadcn/ui Vite install; Tailwind v4 Vite plugin. (If offline: say so and mark versions unverified.)

## C. Design decisions

- Sections: Nav → Hero (headline, sub, CTA, animated sync diagram) → Logos → 3 features with live mini-demos → Benchmark numbers → Pricing → FAQ → Footer CTA.
- Type: Inter Variable (UI) + JetBrains Mono (code/metrics). Scale 1.25. Hero `clamp(2.5rem, 1.6rem + 3.6vw, 4.25rem)`.
- Colour: zinc neutrals, teal accent for CTA and sync lines only.
- Motion budget: **one hero moment** (rows flowing source → warehouse), scroll reveals for section headings only, counters for benchmark numbers, press feedback on buttons, pricing toggle indicator. No parallax, no smooth-scroll library — nothing here justifies Lenis.
- Libraries: `motion`, `lucide-react`, shadcn/ui (`button`, `accordion`, `tabs`). GSAP rejected: no pinning or complex timelines needed.

Motion spec (excerpt — full table per [templates/animation-specification.md](../templates/animation-specification.md)):

| Element | Trigger | Effect | Tokens | Purpose | Reduced |
|---|---|---|---|---|---|
| Hero text | load | none — renders immediately (LCP) | — | — | — |
| Sync diagram rows | load, then loop every 3 s while in view | row chips travel along path | linear, 1.6 s | narrative: shows what the product does | static diagram with labelled arrows |
| Section headings | in view 30% | fade + y 16 | emphasized · enter | hierarchy | fade |
| Benchmark numbers | in view 60% | count up | 1.2 s · enter | emphasis | final value |
| Pricing toggle | click | `layoutId` pill | spring.snappy | continuity | instant |

## D. Implementation highlights

```tsx
// src/pages/home/sections/hero.tsx (excerpt)
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
      <div>
        <h1 className="text-balance text-[clamp(2.5rem,1.6rem+3.6vw,4.25rem)] font-semibold leading-[1.05] tracking-tight">
          Postgres to your warehouse in seconds, not nightly.
        </h1>
        <p className="mt-5 max-w-[52ch] text-lg text-muted-foreground">
          Change-data-capture pipelines with schema drift handling, backfills and per-table SLAs.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <AnimatedButton>Start free trial</AnimatedButton>
          <a href="#how" className="inline-flex items-center px-4 py-2 text-sm font-medium underline-offset-4 hover:underline">
            See how it works
          </a>
        </div>
      </div>
      <SyncDiagram />
    </section>
  );
}

function SyncDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const animateRows = inView && !reduce;

  return (
    <div ref={ref} role="img" aria-label="Rows flow from Postgres through Tidewater into Snowflake, BigQuery and Redshift" className="relative aspect-[4/3] rounded-xl border bg-card">
      {/* static SVG paths + labels always rendered */}
      {animateRows && (
        // track spans the path; each runner is track-wide with its dot at the right end,
        // so translating the runner from -100% to 0% moves the dot along the track (transform only)
        <div aria-hidden="true" className="absolute inset-x-[12%] top-1/2 h-2 -translate-y-1/2 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0"
              animate={{ x: ["-100%", "0%"], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.6, ease: "linear", repeat: Infinity, repeatDelay: 1.4, delay: i * 0.5 }}
            >
              <span className="absolute right-0 top-0 size-2 rounded-full bg-primary" />
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}
```

Notes: the loop only runs while in view; under reduced motion the diagram is static but complete; the hero text is not animated so LCP is immediate. `AnimatedButton`, `RevealOnScroll` and `AnimatedCounter` come from [references/implementation-patterns.md](../references/implementation-patterns.md).

## E. Verification (illustrative: shows what to run and how to report it)

1. `npm run typecheck` → 0 errors. `npm run build` → success; initial JS 142 KB gz.
2. Browser (Playwright): 1440 and 375 px screenshots reviewed; fixed pricing cards overflowing at 375 px.
3. `page.emulateMedia({ reducedMotion: "reduce" })`: diagram static, counters show final values, headings visible.
4. Keyboard: tab order nav → CTA → … → FAQ accordion; focus ring visible on dark background after raising ring contrast.
5. Console: no errors. Lighthouse mobile: LCP 1.9 s, CLS 0.01.

(Numbers are illustrative of the report format — always report real results.)

## Report (shape)

```
## Summary — Built Tidewater landing page: 8 sections, one hero motion moment, reduced-motion paths.
## Files — src/lib/motion-tokens.ts, src/app/providers.tsx, src/pages/home/sections/*.tsx, …
## Decisions — Motion only (no GSAP/Lenis: no pinning/smooth-scroll need); teal accent restricted to CTA + sync lines.
## Verification — typecheck ✅, build ✅, Playwright screenshots ✅ (1440/375), reduced motion ✅, keyboard ✅, Lighthouse mobile LCP 1.9 s.
## Open issues — Real logo and customer logos needed; benchmark numbers are placeholders pending real data.
```
