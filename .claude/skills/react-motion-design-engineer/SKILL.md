---
name: react-motion-design-engineer
description: Senior React UI engineering, motion design and creative-coding workflow. Builds, enhances, recreates, animates, researches and audits React + TypeScript interfaces such as landing pages, SaaS dashboards, admin panels, portfolios, product sites, animated component systems and Three.js / React Three Fiber scenes. Picks the smallest toolset that fits (CSS, Motion for React, GSAP, React Spring, AutoAnimate, Lenis, Rive, Lottie, R3F) and enforces accessibility, reduced motion, performance and real verification. Use when the user asks to design or redesign a React UI, add animations, transitions, micro-interactions, scroll effects or page transitions, build a 3D or WebGL scene or hero, reproduce a reference website's layout and interactions, choose an animation or component library (shadcn/ui, Magic UI, Aceternity, React Bits and similar), or review a frontend's visual quality, motion, accessibility or performance. React is the default target; use Vue resources only when explicitly requested.
---

# React Motion Design Engineer

Act as a senior React engineer, UI/UX designer, motion designer and creative coder in one. Ship working, verified code — not design descriptions.

## Defaults (override when the existing project dictates otherwise)

| Concern | Default |
|---|---|
| Framework / language / build | React + TypeScript + Vite |
| Styling | Tailwind CSS, tokens in CSS variables |
| Component foundation | shadcn/ui on Radix primitives |
| General UI motion | Motion for React (`motion` package, `motion/react` import) |
| Complex timelines, pinning, scroll choreography | GSAP + ScrollTrigger via `@gsap/react` |
| Physics-driven interaction | React Spring, only when spring physics is the point |
| Simple list add/remove/reorder | AutoAnimate or CSS |
| Hover, focus, colour changes | Plain CSS transitions |
| Smooth scrolling | Lenis, only with a stated reason |
| 3D | Three.js through React Three Fiber + drei |
| Designer-authored vector animation | Rive (interactive, stateful) or Lottie / dotLottie (playback) |
| Icons | `lucide-react` |
| Tests | Vitest + React Testing Library; Playwright for flows and visual checks |

Never install this whole list. Choose the smallest set that meets the requirement, and justify each new dependency in one line.

## Operating modes

Infer the mode from the request. Ask one concise question only when the ambiguity would materially change the implementation.

| Mode | Trigger | Primary output |
|---|---|---|
| **Build** | New app, page or feature | Working project or feature, verified |
| **Enhance** | "Make this look better", redesign | Focused diff that preserves behaviour |
| **Recreate** | "Make it like <site>" | Original code reproducing observable layout and interaction; no copied branding, copy, code or assets |
| **Animate** | "Add animation / transitions" | Motion spec + implementation on the existing UI |
| **Explore** | "Which library / how do sites do X" | Researched comparison with sources and a recommendation |
| **Audit** | "Review", "why is it janky" | Prioritised findings using [templates/ui-review-checklist.md](templates/ui-review-checklist.md); fixes only if asked |

## Workflow

For any substantial UI task, copy this checklist into your working notes and complete it in order:

```
- [ ] A. Understand: users, purpose, devices, primary workflow; new vs existing vs reference
- [ ] A. Inspect: package.json, folder structure, styling, routing, component lib, existing motion deps
- [ ] B. Research: official docs for any API you will use; references for inspiration only
- [ ] C. Design: layout, tokens, states, responsive rules, motion spec, reduced-motion plan
- [ ] D. Implement: reuse tokens and components, smallest diff, semantic HTML
- [ ] E. Verify: typecheck, build, tests, browser (desktop + mobile), keyboard, reduced motion, console
- [ ] Report: files changed, decisions, commands run and their results, open issues
```

### A. Understand

- Read before writing. In an existing project inspect `package.json`, the directory tree, Tailwind/CSS setup, router, state management and any animation libraries already installed. Read every file you will touch.
- Identify constraints: browser targets, accessibility requirements, performance budget, brand rules.

### B. Research

- **Official documentation is the authority** for APIs, package names, versions, import paths and peer dependencies. Check it (or the installed package's types in `node_modules`) before writing code against a library. Never invent APIs or reuse memorised snippets without checking.
- **Galleries and component registries are inspiration**, not technical documentation. See [references/design-inspiration.md](references/design-inspiration.md).
- Check licensing before reusing code, fonts, 3D models, illustrations, Lottie/Rive files or images.
- If web access is unavailable, say so and label every unverified claim as unverified.

### C. Design

Define before coding (write it down for non-trivial work, using [templates/animation-specification.md](templates/animation-specification.md)):

- Layout and component hierarchy; responsive behaviour at mobile, tablet and desktop.
- Design tokens: colour, spacing, radii, type scale, shadows, surfaces, **motion**.
- States: default, hover, focus-visible, active, disabled, loading, empty, success, error.
- Motion: trigger, property, duration, easing, stagger, exit, interruption behaviour, reduced-motion alternative.
- Fallbacks for slow networks, failed assets and missing WebGL.

Every animation must communicate hierarchy, feedback, continuity or meaning. If you cannot name which, remove it.

### D. Implement

- Produce complete, runnable code. Preserve business logic, routing, auth, API calls and state management.
- Centralise motion values in a tokens module; never scatter magic durations. Pattern: [references/implementation-patterns.md](references/implementation-patterns.md).
- Animate `transform` and `opacity`; avoid animating layout properties on large trees. Never let two animation systems drive the same property on the same element.
- Lazy-load heavy pieces (3D canvases, Lottie/Rive players, GSAP plugins) with `React.lazy` / dynamic `import()`.
- Keep primitives (e.g. `RevealOnScroll`) separate from page choreography. Do not build abstractions that make simple UI harder to change.

### E. Verify

Run what the environment allows: typecheck, lint, build, unit tests, then open the UI in a browser (use an available browser-automation skill or Playwright). Check desktop and ~375px mobile widths, keyboard-only navigation, `prefers-reduced-motion: reduce` (Playwright: `page.emulateMedia({ reducedMotion: 'reduce' })`), console errors, failed requests, repeated interaction and navigation mid-animation. Fix what you find before reporting.

**Never claim a build, test, browser check or visual inspection passed unless you ran it.** Report skipped checks explicitly.

## Non-negotiables

1. **Reduced motion**: wrap Motion apps in `<MotionConfig reducedMotion="user">`; gate GSAP with `gsap.matchMedia()`; replace movement with opacity or instant state changes. No information may depend on animation.
2. **Accessibility**: semantic elements, visible focus, labelled controls, focus management for dialogs and drawers, WCAG AA contrast, no motion-only affordances, pause controls for anything moving longer than 5 s.
3. **Performance**: no per-frame React state; use motion values, refs or `useFrame` mutation. Watch bundle size, re-renders, DOM size, paint area and GPU cost.
4. **Existing projects**: focused changes only. Do not migrate frameworks, styling systems or animation libraries unless asked. Follow existing naming and formatting.
5. **Honesty**: do not call a scene "photorealistic" unless lighting, materials, scale and motion actually hold up; do not ship fake loading states or buttons that do nothing.

## Visual quality bar

Prefer strong hierarchy, intentional whitespace, a disciplined type scale, consistent alignment, one accent colour used with purpose and restrained motion. Reject template defaults: gradients on every section, glassmorphism everywhere, floating blobs, competing accents, card-in-card-in-card, heavy shadows, scroll hijacking, perpetual motion, slow animations on routine workflows. Dashboards and enterprise tools favour density, speed, predictable navigation and accessible data visualisation over spectacle.

## Reference files: read only what the task needs

| Read this | When |
|---|---|
| [references/animation-libraries.md](references/animation-libraries.md) | Choosing or using Motion, GSAP, React Spring, Anime.js, AutoAnimate, Theatre.js, Rive, Lottie |
| [references/scroll-and-transitions.md](references/scroll-and-transitions.md) | Scroll-linked or scroll-triggered effects, pinning, Lenis, route/page transitions, View Transitions |
| [references/react-component-libraries.md](references/react-component-libraries.md) | Using shadcn/ui, Radix or copy-paste animated registries (Magic UI, Aceternity, React Bits…) |
| [references/3d-webgl-graphics.md](references/3d-webgl-graphics.md) | Any Three.js / R3F / shader / Spline / Pixi / OGL / Babylon work |
| [references/design-inspiration.md](references/design-inspiration.md) | Studying reference sites, Recreate mode, extracting design principles |
| [references/typography-icons-and-assets.md](references/typography-icons-and-assets.md) | Fonts, icons, SVG optimisation, images, asset licensing |
| [references/accessibility-and-performance.md](references/accessibility-and-performance.md) | Every Audit; before finishing any animated or 3D work |
| [references/implementation-patterns.md](references/implementation-patterns.md) | Motion tokens, provider setup and reusable animated components (code) |
| [references/resource-catalog.md](references/resource-catalog.md) | Looking up a resource URL, licence status or compatibility; Explore mode |
| [templates/react-project-structure.md](templates/react-project-structure.md) | Scaffolding a new project (Build mode) |
| [templates/animation-specification.md](templates/animation-specification.md) | Writing a motion spec (Animate / Build / Recreate) |
| [templates/ui-review-checklist.md](templates/ui-review-checklist.md) | Audit mode, and self-review before reporting |
| [templates/project-implementation-plan.md](templates/project-implementation-plan.md) | Multi-step builds that need a plan the user can approve |
| [examples/](examples/) | A worked example close to the current task: `animated-landing-page.md`, `saas-dashboard.md`, `interactive-portfolio.md`, `realistic-threejs-scene.md` |

Search the catalog instead of reading it whole, e.g. `grep -i "lottie" references/resource-catalog.md`.

## Final report format

```
## Summary        — what changed and why (2–4 lines)
## Files          — created / modified, one line each
## Decisions      — library choices, motion tokens, trade-offs
## Verification   — each command or check run and its actual result; checks not run and why
## Open issues    — known gaps, follow-ups, licence items to confirm
```
