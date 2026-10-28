# Template: Animation Specification

Fill this in before implementing non-trivial motion. Keep it in the PR description, a `docs/motion.md`, or the working notes. Every row must name a **purpose**; rows without one are deleted.

## 1. Context

```
Surface:            <page / component>
Product character:  <e.g. calm enterprise tool | expressive portfolio>
Motion budget:      <e.g. one hero moment + feedback only>
Libraries:          <CSS | Motion | GSAP | …> and why each is needed
Devices / targets:  <e.g. mid-range Android, Safari iOS 17+, desktop Chrome>
```

## 2. Tokens used

| Token | Value | Used for |
|---|---|---|
| `duration.fast` | 150 ms | hover / press |
| `duration.base` | 250 ms | menus, tabs, tooltips |
| `duration.emphasized` | 400 ms | entrances, modals |
| `ease.standard` | cubic-bezier(0.2, 0, 0, 1) | default |
| `ease.enter` | cubic-bezier(0.05, 0.7, 0.1, 1) | entrances |
| `ease.exit` | cubic-bezier(0.3, 0, 0.8, 0.15) | exits |
| `spring.snappy` | stiffness 400, damping 32 | layout / indicator |
| `staggerStep.base` | 60 ms | list reveals |

(Replace with the project's actual tokens.)

## 3. Motion inventory

| # | Element | Trigger | Property / effect | Duration · easing | Stagger / sequence | Exit | Interruptible? | Purpose | Reduced-motion alternative | Library |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Hero heading | page load | opacity 0→1, y 24→0 | emphasized · enter | first in sequence | — | n/a | hierarchy: first read | fade only | Motion |
| 2 | Feature cards | enter viewport (30%) | opacity, y 16→0 | emphasized · enter | 60 ms, max 6 | — | — | grouping | fade only | Motion |
| 3 | Primary CTA | press | scale 1→0.97 | spring.press | — | — | yes | feedback | none needed (colour change stays) | Motion |
| 4 | Pricing toggle | click | indicator slides (layoutId) | spring.snappy | — | — | yes | continuity | instant | Motion |
| 5 | Story section | scroll 0→100% | pinned, steps crossfade | scrubbed | 3 steps | — | n/a | narrative | static stacked steps | GSAP ScrollTrigger |

Purpose vocabulary: **feedback**, **hierarchy**, **continuity** (where did it come from / go), **orientation** (where am I), **narrative**, **delight** (allowed once or twice per page, never on routine tasks).

## 4. Choreography notes

- Order of first paint and what must be visible without animation (LCP element).
- What happens if the user scrolls fast / clicks mid-animation / navigates away.
- Which animations run once vs every time.

## 5. Accessibility and performance

- [ ] Reduced-motion alternatives defined for every row
- [ ] Nothing loops > 5 s without a pause control
- [ ] No information conveyed only by motion
- [ ] Only `transform` / `opacity` animated on large or numerous elements (exceptions listed)
- [ ] Heavy libraries / scenes lazy-loaded
- [ ] Mobile behaviour defined (simplified or disabled effects)

## 6. Acceptance checks

- [ ] Verified in browser at desktop and 375 px
- [ ] Verified with `prefers-reduced-motion: reduce`
- [ ] No console errors; no jank at 4× CPU throttle on key interactions
- [ ] Keyboard path unchanged or improved
