# Example: Interactive Portfolio (Recreate + Build modes)

## Request

> "I'm a motion designer. Build my portfolio. I love how <award-winning studio site> does the pinned case-study scroll and the big type. Use my projects from this JSON."

## A. Understand

- Audience: art directors and recruiters; they judge craft in the first 10 seconds, then skim case studies.
- Reference site → **Recreate** its observable *patterns* (pinned case-study sequence, oversized typography, cursor-following preview), not its branding, copy, fonts or assets.
- Content: `projects.json` with title, year, role, cover video, stills.

## B. Research

- Studied the reference live at 1440 and 390 px, with reduced motion on and off. Extracted:
  - Pinned section: each project's cover scales from a card to full-bleed as you scroll, title letters slide in, then unpins.
  - Huge display type (~14vw) with tight tracking; neutral off-white background; single black ink colour.
  - Mobile: pinning removed; simple stacked cards — a good pattern to keep.
  - Reduced motion: reference still pins and scrubs — **we will do better** with a static fallback.
- Implementation docs checked: GSAP ScrollTrigger (pin, scrub, `matchMedia`), `@gsap/react` `useGSAP`, Lenis + ScrollTrigger integration.
- Font: reference uses a commercial face → choose a licensed alternative of the same category (a grotesk from Fontshare or Google Fonts), recorded in the asset licence list.

## C. Design decisions

- Libraries: **GSAP + ScrollTrigger** for the pinned scrubbed sequence (Motion's scroll APIs can do scroll-linked values, but pin + scrub + multi-step timeline is GSAP's strength). **Motion** for UI pieces (nav overlay, cursor preview, page transitions). They never animate the same element.
- **Lenis**: justified here — scrubbed pinned sequences feel steppy with some wheel/trackpad input; integrate with ScrollTrigger and disable entirely under reduced motion and on touch devices.
- Page transitions between home and case study: short crossfade (≤ 300 ms) via `AnimatedOutlet`.
- Cursor preview: desktop with fine pointer only (`(hover: hover) and (pointer: fine)`), positions via motion values, never hides the native cursor.

## D. Implementation highlights

```tsx
// src/pages/home/sections/case-study-pin.tsx (excerpt)
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function CaseStudyPin({ project }: { project: Project }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({
            scrollTrigger: { trigger: root.current, start: "top top", end: "+=150%", pin: true, scrub: 0.6 },
          })
          .fromTo("[data-cover]", { scale: 0.55, borderRadius: 24 }, { scale: 1, borderRadius: 0, ease: "none" })
          .from("[data-title-line]", { yPercent: 110, stagger: 0.08, ease: "power3.out" }, 0.2);
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative h-svh overflow-hidden" aria-labelledby={`p-${project.slug}`}>
      <video data-cover className="absolute inset-0 size-full object-cover" src={project.cover} poster={project.poster} muted playsInline loop autoPlay={false} />
      <h2 id={`p-${project.slug}`} className="relative z-10 px-6 pt-[30svh] text-[clamp(3rem,14vw,12rem)] font-semibold leading-[0.9] tracking-[-0.04em]">
        {project.titleLines.map((l) => (
          <span key={l} className="block overflow-hidden">
            <span data-title-line className="block">{l}</span>
          </span>
        ))}
      </h2>
    </section>
  );
}
```

- Video plays only when in view and motion is allowed (IntersectionObserver + preference); a visible pause button sits on each case-study video.
- Lenis set up once in the root layout with GSAP's ticker driving it; see [references/scroll-and-transitions.md](../references/scroll-and-transitions.md).

## E. Verification

- Build + typecheck pass.
- Browser: scroll through all pinned sections at 1440 px with trackpad and keyboard (Space/PageDown) — keyboard scrolling still works with Lenis; at 390 px pins are off and layout stacks.
- Reduced motion: no pins, no scrub, no Lenis; covers shown at full size; titles visible.
- Navigated home → case study → back mid-scroll ten times: no orphaned ScrollTriggers (checked `ScrollTrigger.getAll().length` stays constant).
- Performance: 4× CPU throttle shows occasional dropped frames during cover scale with video playing → switched to poster image during the scrub, video starts after unpin.

## Report notes

- State clearly what was taken from the reference (patterns) and what is original (all code, type choice, content). List font licence.
